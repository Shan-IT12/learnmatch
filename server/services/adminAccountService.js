import bcrypt from 'bcrypt'
import { STAFF_ROLES, normalizeAdminRole } from '../middleware/authorizeRoles.js'
import { deliverStaffToken, issueStaffToken } from './staffAccountService.js'
import { buildStaffLink } from './staffEmailService.js'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PENDING_PASSWORD_SENTINEL = '!pending_setup!'
const CREATABLE_ADMIN_ROLES = new Set([
  STAFF_ROLES.SYSTEM_DEVELOPER,
  STAFF_ROLES.SYSTEM_ADMIN,
])

export class AdminAccountError extends Error {
  constructor(message, status = 400) {
    super(message)
    this.status = status
  }
}

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : ''
}

export async function getAdminSelf(database, adminId) {
  const [rows] = await database.query(
    'SELECT admin_id, full_name, username, email, role, created_at FROM ADMIN WHERE admin_id = ? LIMIT 1',
    [adminId]
  )
  const admin = rows[0]
  if (!admin) return null
  return {
    adminId: admin.admin_id,
    fullName: admin.full_name,
    username: admin.username,
    email: admin.email,
    role: normalizeAdminRole(admin.role),
    createdAt: admin.created_at,
  }
}

export async function listAdminAccounts(database, { roleFilter = null } = {}) {
  const query = roleFilter
    ? `SELECT admin_id, full_name, username, email, role, created_at, (password_hash = ?) AS setup_pending
       FROM ADMIN
       WHERE role = ?
       ORDER BY admin_id ASC`
    : `SELECT admin_id, full_name, username, email, role, created_at, (password_hash = ?) AS setup_pending
       FROM ADMIN
       ORDER BY admin_id ASC`
  const [rows] = roleFilter
    ? await database.query(query, [PENDING_PASSWORD_SENTINEL, roleFilter])
    : await database.query(query, [PENDING_PASSWORD_SENTINEL])

  const pendingEmailByAdminId = new Map()
  if (rows.some((row) => row.setup_pending)) {
    try {
      const [tokens] = await database.query(
        `SELECT subject_key, email
         FROM VALIDATION_ACCOUNT_TOKEN
         WHERE purpose = 'admin_setup' AND consumed_at IS NULL`
      )
      for (const token of tokens) {
        pendingEmailByAdminId.set(String(token.subject_key), token.email)
      }
    } catch (error) {
      if (error?.code !== 'ER_NO_SUCH_TABLE') throw error
    }
  }

  return rows.map((row) => ({
    admin_id: row.admin_id,
    full_name: row.full_name,
    username: row.username,
    email: row.email || pendingEmailByAdminId.get(String(row.admin_id)) || null,
    role: normalizeAdminRole(row.role),
    setup_pending: Boolean(row.setup_pending),
    created_at: row.created_at,
  }))
}

export async function createAdminAccount(
  database,
  input,
  { actorRole = STAFF_ROLES.SYSTEM_DEVELOPER, actorAdminId = null, send = null } = {}
) {
  const fullName = cleanString(input?.full_name)
  const username = cleanString(input?.username)
  const email = cleanString(input?.email).toLowerCase()
  const requestedRole = cleanString(input?.role) || STAFF_ROLES.SYSTEM_ADMIN
  const normalizedActor = normalizeAdminRole(actorRole)

  if (normalizedActor === STAFF_ROLES.SYSTEM_ADMIN && requestedRole !== STAFF_ROLES.SYSTEM_ADMIN) {
    throw new AdminAccountError('System Admins can only create Co-Admin (System Admin) accounts.', 403)
  }
  const role = normalizedActor === STAFF_ROLES.SYSTEM_ADMIN ? STAFF_ROLES.SYSTEM_ADMIN : requestedRole

  if (!fullName || fullName.length > 100) {
    throw new AdminAccountError('Full name is required (max 100 characters).', 400)
  }
  if (!username || username.length < 3 || username.length > 50) {
    throw new AdminAccountError('Username must be between 3 and 50 characters.', 400)
  }
  if (!email || !EMAIL_RE.test(email) || email.length > 254) {
    throw new AdminAccountError('A valid email address is required.', 400)
  }
  if (!CREATABLE_ADMIN_ROLES.has(role)) {
    throw new AdminAccountError('Select a valid admin role (System Developer or System Admin).', 400)
  }

  const [existing] = await database.query(
    'SELECT admin_id, username, email FROM ADMIN WHERE email = ? OR username = ? LIMIT 1',
    [email, username]
  )
  if (existing.length > 0) {
    if (existing[0].email?.toLowerCase() === email) {
      throw new AdminAccountError('An admin account with this email already exists.', 409)
    }
    throw new AdminAccountError('An admin account with this username already exists.', 409)
  }

  const [pendingDup] = await database.query(
    `SELECT subject_key FROM VALIDATION_ACCOUNT_TOKEN
     WHERE purpose = 'admin_setup' AND email = ? AND consumed_at IS NULL AND expires_at > UTC_TIMESTAMP(6)
     LIMIT 1`,
    [email]
  )
  if (pendingDup.length > 0) {
    throw new AdminAccountError('An admin account setup invitation is already pending for this email.', 409)
  }

  const [result] = await database.query(
    `INSERT INTO ADMIN (full_name, username, email, password_hash, role)
     VALUES (?, ?, NULL, ?, ?)`,
    [fullName, username, PENDING_PASSWORD_SENTINEL, role]
  )

  const adminId = result.insertId
  const rawToken = await issueStaffToken(database, 'admin_setup', adminId, email, actorAdminId)
  const setupUrl = buildStaffLink('admin_setup', rawToken)
  const emailSent = typeof send === 'function'
    ? await deliverStaffToken(send, 'admin_setup', email, rawToken)
    : false

  return {
    account: {
      admin_id: adminId,
      full_name: fullName,
      username,
      email,
      role,
      setup_pending: true,
    },
    setupUrl,
    emailSent,
  }
}

export async function regenerateAdminSetupLink(
  database,
  targetAdminId,
  { actorRole = STAFF_ROLES.SYSTEM_DEVELOPER, actorAdminId = null, send = null } = {}
) {
  const adminId = Number(targetAdminId)
  if (!Number.isInteger(adminId) || adminId <= 0) {
    throw new AdminAccountError('Invalid admin account ID.', 400)
  }

  const [rows] = await database.query(
    `SELECT admin_id, full_name, username, email, role, password_hash
     FROM ADMIN
     WHERE admin_id = ?
     LIMIT 1`,
    [adminId]
  )
  const target = rows[0]
  if (!target) {
    throw new AdminAccountError('Admin account not found.', 404)
  }
  if (normalizeAdminRole(actorRole) === STAFF_ROLES.SYSTEM_ADMIN && normalizeAdminRole(target.role) !== STAFF_ROLES.SYSTEM_ADMIN) {
    throw new AdminAccountError('You do not have permission to manage this account.', 403)
  }
  if (target.email || target.password_hash !== PENDING_PASSWORD_SENTINEL) {
    throw new AdminAccountError('This admin account has already completed setup.', 409)
  }
  const [tokenRows] = await database.query(
    `SELECT email
     FROM VALIDATION_ACCOUNT_TOKEN
     WHERE purpose = 'admin_setup' AND subject_key = ?
     LIMIT 1`,
    [String(adminId)]
  )
  const email = tokenRows[0]?.email
  if (!email) {
    throw new AdminAccountError('No pending email found for this account.', 400)
  }

  const rawToken = await issueStaffToken(database, 'admin_setup', adminId, email, actorAdminId)
  const setupUrl = buildStaffLink('admin_setup', rawToken)
  const emailSent = typeof send === 'function'
    ? await deliverStaffToken(send, 'admin_setup', email, rawToken)
    : false

  return { email, setupUrl, emailSent }
}

export async function updateAdminAccount(database, targetAdminId, input, { actorRole = STAFF_ROLES.SYSTEM_DEVELOPER } = {}) {
  const adminId = Number(targetAdminId)
  if (!Number.isInteger(adminId) || adminId <= 0) {
    throw new AdminAccountError('Invalid admin account ID.', 400)
  }

  const [rows] = await database.query(
    'SELECT admin_id, full_name, username, email, role FROM ADMIN WHERE admin_id = ? LIMIT 1',
    [adminId]
  )
  const current = rows[0]
  if (!current) {
    throw new AdminAccountError('Admin account not found.', 404)
  }

  const normalizedActor = normalizeAdminRole(actorRole)
  const currentRole = normalizeAdminRole(current.role)
  if (normalizedActor === STAFF_ROLES.SYSTEM_ADMIN) {
    if (currentRole !== STAFF_ROLES.SYSTEM_ADMIN) {
      throw new AdminAccountError('You do not have permission to manage this account.', 403)
    }
    if (input?.role !== undefined && cleanString(input.role) !== STAFF_ROLES.SYSTEM_ADMIN) {
      throw new AdminAccountError('System Admins cannot assign developer roles.', 403)
    }
  }

  const fullName = input?.full_name !== undefined ? cleanString(input.full_name) : current.full_name
  const email = input?.email !== undefined ? cleanString(input.email).toLowerCase() : (current.email || '')
  const role = normalizedActor === STAFF_ROLES.SYSTEM_ADMIN
    ? STAFF_ROLES.SYSTEM_ADMIN
    : (input?.role !== undefined ? cleanString(input.role) : currentRole)
  const password = typeof input?.password === 'string' && input.password.length > 0 ? input.password : null

  if (!fullName || fullName.length > 100) {
    throw new AdminAccountError('Full name is required (max 100 characters).', 400)
  }
  if (email && (!EMAIL_RE.test(email) || email.length > 254)) {
    throw new AdminAccountError('Enter a valid email address.', 400)
  }
  if (!CREATABLE_ADMIN_ROLES.has(role)) {
    throw new AdminAccountError('Select a valid admin role (System Developer or System Admin).', 400)
  }
  if (password && (password.length < 8 || Buffer.byteLength(password) > 1024)) {
    throw new AdminAccountError('New password must be at least 8 characters.', 400)
  }

  if (normalizeAdminRole(current.role) === STAFF_ROLES.SYSTEM_DEVELOPER && role !== STAFF_ROLES.SYSTEM_DEVELOPER) {
    const [[devCount]] = await database.query(
      "SELECT COUNT(*) AS count FROM ADMIN WHERE role = 'system_developer'"
    )
    if (Number(devCount?.count || 0) <= 1) {
      throw new AdminAccountError('At least one System Developer account must remain active.', 409)
    }
  }

  if (email && email !== (current.email || '').toLowerCase()) {
    const [dup] = await database.query(
      'SELECT admin_id FROM ADMIN WHERE email = ? AND admin_id <> ? LIMIT 1',
      [email, adminId]
    )
    if (dup.length > 0) {
      throw new AdminAccountError('Another admin account already uses this email.', 409)
    }
  }

  if (password) {
    const passwordHash = await bcrypt.hash(password, 10)
    await database.query(
      'UPDATE ADMIN SET full_name = ?, email = ?, role = ?, password_hash = ? WHERE admin_id = ?',
      [fullName, email || null, role, passwordHash, adminId]
    )
  } else {
    await database.query(
      'UPDATE ADMIN SET full_name = ?, email = ?, role = ? WHERE admin_id = ?',
      [fullName, email || null, role, adminId]
    )
  }

  return {
    admin_id: adminId,
    full_name: fullName,
    username: current.username,
    email: email || null,
    role,
  }
}
