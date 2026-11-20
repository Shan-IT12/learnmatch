import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { createHash, randomBytes } from 'node:crypto'
import { ADMIN_JWT_AUDIENCE, jwtSignOptions, jwtVerifyOptions } from '../config/security.js'
import { PARENT_CLUSTERS } from '../config/recommendationConfig.js'
import { PRIVACY_NOTICE_VERSION, TERMS_VERSION } from '../shared/legalDocuments.js'
import { normalizeRegistrationEmail } from './registrationEmailService.js'
import { matchesPasswordSession, passwordSessionVersion } from './sessionVersionService.js'
import { parseJson } from './draftSourceService.js'
import { reviewImage } from './privateReviewImage.js'
import { withLocalLegacyCatalog } from './localLegacyCatalog.js'
import { buildStaffEmail, staffTokenLifetime } from './staffEmailService.js'
import { WorkflowError, workflowId, workflowText, workflowTransaction } from './workflowSupport.js'

const validatorAudience = 'learnmatch-validator'
const validatorApprovalAudience = 'learnmatch-validator-approval'
const digestToken = (token) => createHash('sha256').update(token).digest('hex')
const invalidLink = () => new WorkflowError('This link is invalid, expired, or already used. Request a new link.', 409)
export const staffEmail = normalizeRegistrationEmail
const requireEmail = (value) => {
  const email = staffEmail(value)
  if (!email) throw new WorkflowError('Enter a valid email address.')
  return email
}

export function staffPassword(input) {
  const password = input?.password
  if (typeof password !== 'string' || password.length < 8 || Buffer.byteLength(password) > 72 || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
    throw new WorkflowError('Use at least 8 characters, including an uppercase letter and a number, and at most 72 UTF-8 bytes.')
  }
  if (password !== input.confirmPassword) throw new WorkflowError('Passwords do not match.')
  return password
}

export function reviewClusters(input) {
  if (!Array.isArray(input) || !input.length || input.length > PARENT_CLUSTERS.length || input.some((value) => !PARENT_CLUSTERS.includes(value))) {
    throw new WorkflowError('Select one or more recognized expertise clusters.')
  }
  return [...new Set(input)].sort()
}

export async function issueStaffToken(database, purpose, subject, email, adminId = null) {
  const token = randomBytes(32).toString('base64url')
  const minutes = staffTokenLifetime(purpose)
  await database.execute(`INSERT INTO VALIDATION_ACCOUNT_TOKEN
    (purpose, subject_key, token_hash, email, issued_by, expires_at)
    VALUES (?, ?, ?, ?, ?, DATE_ADD(UTC_TIMESTAMP(6), INTERVAL ? MINUTE))
    ON DUPLICATE KEY UPDATE token_hash = VALUES(token_hash), email = VALUES(email), issued_by = VALUES(issued_by),
      created_at = CURRENT_TIMESTAMP(6), expires_at = VALUES(expires_at), consumed_at = NULL`,
  [purpose, String(subject), digestToken(token), email, adminId, minutes])
  return token
}

async function readToken(connection, purpose, raw, consume = false) {
  if (typeof raw !== 'string' || !/^[a-zA-Z0-9_-]{43}$/.test(raw)) throw invalidLink()
  const [rows] = await connection.execute(`SELECT subject_key, email, token_hash FROM VALIDATION_ACCOUNT_TOKEN
    WHERE purpose = ? AND token_hash = ? AND consumed_at IS NULL AND expires_at > UTC_TIMESTAMP(6)${consume ? ' FOR UPDATE' : ''}`, [purpose, digestToken(raw)])
  if (!rows.length) throw invalidLink()
  if (consume) {
    const [update] = await connection.execute(`UPDATE VALIDATION_ACCOUNT_TOKEN SET consumed_at = UTC_TIMESTAMP(6)
      WHERE token_hash = ? AND consumed_at IS NULL AND expires_at > UTC_TIMESTAMP(6)`, [rows[0].token_hash])
    if (update.affectedRows !== 1) throw invalidLink()
  }
  return rows[0]
}

export async function deliverStaffToken(send, purpose, email, token, env = process.env) {
  try {
    await send(buildStaffEmail(purpose, email, token, env))
    return true
  } catch {
    console.error('LearnMatch staff email delivery failed:', purpose)
    return false
  }
}

export async function inviteValidator(database, send, rawEmail, adminId) {
  const email = requireEmail(rawEmail)
  const raw = await workflowTransaction(database, async (connection) => {
    const raw = await issueStaffToken(connection, 'validator_invite', email, email, adminId)
    const [existing] = await connection.execute('SELECT validator_id FROM VALIDATOR_ACCOUNT WHERE email = ?', [email])
    if (existing.length) throw new WorkflowError('This email already has a validator application.', 409)
    return raw
  })
  if (!await deliverStaffToken(send, 'validator_invite', email, raw)) throw new WorkflowError('Email delivery failed. Send a new invitation to retry.', 503)
  return { message: 'Invitation sent.' }
}

export async function invitationEmail(database, raw) {
  const { email } = await readToken(database, 'validator_invite', raw)
  return { email, clusters: PARENT_CLUSTERS }
}

export async function registerValidator(database, send, input) {
  const email = requireEmail(input?.email)
  const profile = [
    workflowText(input.fullName, 'Full name', 150), workflowText(input.profession, 'Profession', 150),
    workflowText(input.affiliation, 'Affiliation', 255), workflowText(input.expertise, 'Field of expertise', 500),
    JSON.stringify(reviewClusters(input.clusters)),
  ]
  if (input.accepted !== true || input.termsVersion !== TERMS_VERSION || input.privacyVersion !== PRIVACY_NOTICE_VERSION) {
    throw new WorkflowError('Acknowledge the current terms and privacy notice.')
  }
  const contents = reviewImage(input.credential)
  const passwordHash = await bcrypt.hash(staffPassword(input), 10)
  const token = await workflowTransaction(database, async (connection) => {
    const invite = await readToken(connection, 'validator_invite', input.token, true)
    if (invite.email !== email) throw invalidLink()
    const [insert] = await connection.execute(`INSERT INTO VALIDATOR_ACCOUNT
      (email, password_hash, full_name, profession, affiliation, expertise, requested_clusters, terms_version, privacy_version, accepted_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(6))`,
    [email, passwordHash, ...profile, TERMS_VERSION, PRIVACY_NOTICE_VERSION])
    await connection.execute('INSERT INTO VALIDATOR_CREDENTIAL (validator_id, contents) VALUES (?, ?)', [insert.insertId, contents])
    return issueStaffToken(connection, 'validator_verify', insert.insertId, email)
  })
  const sent = await deliverStaffToken(send, 'validator_verify', email, token)
  return { message: sent ? 'Check your email to verify your application.' : 'Application saved. Request a new verification email from the sign-in page.' }
}

export async function verifyValidator(database, raw) {
  return workflowTransaction(database, async (connection) => {
    const token = await readToken(connection, 'validator_verify', raw, true)
    const [update] = await connection.execute(`UPDATE VALIDATOR_ACCOUNT SET status = 'pending', verified_at = UTC_TIMESTAMP(6)
      WHERE validator_id = ? AND email = ? AND status = 'unverified'`, [token.subject_key, token.email])
    if (update.affectedRows !== 1) throw invalidLink()
    const approvalToken = jwt.sign(
      { validatorId: workflowId(token.subject_key), purpose: 'validator-approval' },
      process.env.JWT_SECRET,
      jwtSignOptions(validatorApprovalAudience, '7d'),
    )
    return { message: 'Email verified. Your application is pending Administrator approval.', approvalToken }
  })
}

// This credential is issued only after email verification and can read one status.
export async function validatorApprovalStatus(database, authorization) {
  const unavailable = () => new WorkflowError('Sign in to check your application status.', 401)
  let validatorId
  try {
    const bearer = /^Bearer (\S+)$/i.exec(authorization || '')
    const claims = jwt.verify(bearer?.[1], process.env.JWT_SECRET, jwtVerifyOptions(validatorApprovalAudience))
    if (claims.purpose !== 'validator-approval' || !Number.isInteger(claims.validatorId) || claims.validatorId < 1) throw unavailable()
    validatorId = claims.validatorId
  } catch {
    throw unavailable()
  }
  const [[account]] = await database.execute(
    'SELECT status FROM VALIDATOR_ACCOUNT WHERE validator_id = ? AND verified_at IS NOT NULL',
    [validatorId],
  )
  if (!account) throw unavailable()
  return { status: account.status }
}

export async function requestStaffLink(database, send, role, action, rawEmail) {
  const message = { message: 'If the address is eligible, you will receive an email with the next step.' }
  const email = staffEmail(rawEmail)
  if (!email) return message
  const isAdmin = role === 'admin'
  const [rows] = await database.execute(isAdmin
    ? 'SELECT admin_id AS id FROM ADMIN WHERE email = ?'
    : `SELECT validator_id AS id FROM VALIDATOR_ACCOUNT WHERE email = ? AND status ${action === 'verify' ? "= 'unverified'" : "NOT IN ('unverified','deactivated')"}`, [email])
  if (rows.length) {
    const purpose = `${role}_${action}`
    const raw = await issueStaffToken(database, purpose, rows[0].id, email)
    await deliverStaffToken(send, purpose, email, raw)
  }
  return message
}

export async function finishStaffPassword(database, role, action, input) {
  const hash = await bcrypt.hash(staffPassword(input), 10)
  return workflowTransaction(database, async (connection) => {
    const token = await readToken(connection, `${role}_${action}`, input.token, true)
    const id = workflowId(token.subject_key)
    let update
    if (action === 'setup') {
      ;[update] = await connection.execute('UPDATE ADMIN SET email = ?, password_hash = ? WHERE admin_id = ? AND email IS NULL', [token.email, hash, id])
    } else if (role === 'admin') {
      ;[update] = await connection.execute('UPDATE ADMIN SET password_hash = ? WHERE admin_id = ? AND email = ?', [hash, id, token.email])
    } else {
      ;[update] = await connection.execute(`UPDATE VALIDATOR_ACCOUNT SET password_hash = ?
        WHERE validator_id = ? AND email = ? AND status NOT IN ('unverified','deactivated')`, [hash, id, token.email])
    }
    if (update.affectedRows !== 1) throw invalidLink()
    return { message: 'Password saved. Sign in with your email.' }
  })
}

export async function loginStaff(database, role, input) {
  const invalid = () => new WorkflowError('Invalid sign-in details.', 400)
  const isAdmin = role === 'admin'
  const legacy = isAdmin && typeof input?.username === 'string' ? input.username.trim() : ''
  const email = staffEmail(input?.email)
  const password = input?.password
  if ((!email && !legacy) || legacy.length > 254 || typeof password !== 'string' || !password || Buffer.byteLength(password) > 1024) throw invalid()
  const [rows] = isAdmin
    ? await withLocalLegacyCatalog(database, () => database.execute(email
      ? 'SELECT admin_id, username, password_hash FROM ADMIN WHERE email = ?'
      : 'SELECT admin_id, username, password_hash FROM ADMIN WHERE username = ? AND email IS NULL', [email || legacy]), () => {
      if (email) throw new WorkflowError('This local database supports existing username sign-in. Use the migrated demo for email sign-in.', 503)
      return database.execute('SELECT admin_id, username, password_hash FROM ADMIN WHERE username = ?', [legacy])
    }, 'ER_BAD_FIELD_ERROR')
    : await database.execute('SELECT validator_id, password_hash, status FROM VALIDATOR_ACCOUNT WHERE email = ?', [email])
  const row = rows[0]
  // The fixed dummy cost avoids a fast response for unknown addresses.
  const match = await bcrypt.compare(password, row?.password_hash || '$2b$10$CKfgQpHSo6lNzUHvSL38OeWdLVhUKETnyYYm9mukq4566mEiQBZVq')
  if (!row || !match) throw invalid()
  if (row.status === 'deactivated') throw invalid()
  if (row.status === 'unverified') throw new WorkflowError('Verify your email before signing in.', 403)
  const claims = isAdmin ? { adminId: row.admin_id, username: row.username } : { validatorId: row.validator_id }
  const token = jwt.sign({ ...claims, role, sessionVersion: passwordSessionVersion(row.password_hash) },
    process.env.JWT_SECRET, jwtSignOptions(isAdmin ? ADMIN_JWT_AUDIENCE : validatorAudience, '2h'))
  return { token, ...(isAdmin ? { username: row.username } : {}) }
}

export function createValidatorAuth(database) {
  return async (req, res, next) => {
    let decoded
    try {
      const bearer = /^Bearer (\S+)$/i.exec(req.headers.authorization || '')
      decoded = jwt.verify(bearer?.[1], process.env.JWT_SECRET, jwtVerifyOptions(validatorAudience))
      if (decoded.role !== 'validator' || !Number.isInteger(decoded.validatorId)) throw new Error()
    } catch { return res.status(401).json({ message: 'Sign in to the Validator portal.' }) }
    try {
      const [[account]] = await database.execute('SELECT validator_id, password_hash, status FROM VALIDATOR_ACCOUNT WHERE validator_id = ?', [decoded.validatorId])
      if (!account || ['unverified','deactivated'].includes(account.status) || !matchesPasswordSession(decoded.sessionVersion, account.password_hash)) {
        return res.status(401).json({ message: 'This Validator session has ended. Sign in again.' })
      }
      req.validator = { id: account.validator_id, sessionVersion: decoded.sessionVersion }
      return next()
    } catch { return res.status(503).json({ message: 'Session verification is temporarily unavailable.' }) }
  }
}

const accountFields = `v.validator_id, v.email, v.full_name, v.profession, v.affiliation, v.expertise, v.requested_clusters,
  v.approved_clusters, v.status, v.terms_version, v.privacy_version, v.accepted_at, v.verified_at, v.created_at,
  (SELECT MAX(credential_id) FROM VALIDATOR_CREDENTIAL c WHERE c.validator_id = v.validator_id) AS credential_id`
const decisionFields = 'decision_id, status, remarks, approved_clusters, credential_id, decided_at'
const decodeClusters = (row) => ({ ...row, requested_clusters: parseJson(row.requested_clusters), approved_clusters: parseJson(row.approved_clusters) || [] })
export async function staffApplication(database, id, { adminView = false } = {}) {
  const [[account]] = await database.execute(`SELECT ${accountFields} FROM VALIDATOR_ACCOUNT v WHERE v.validator_id = ?`, [id])
  if (!account) throw new WorkflowError('Application not found.', 404)
  const [decisions] = await database.execute(`SELECT ${decisionFields} FROM VALIDATOR_ACCOUNT_DECISION WHERE validator_id = ? ORDER BY decision_id DESC`, [id])
  const application = { ...decodeClusters(account), decisions: decisions.map(row => ({ ...row, approved_clusters: parseJson(row.approved_clusters) })) }
  if (adminView) {
    const [assignments] = await database.execute(`SELECT a.assignment_id, a.cluster_category, a.created_at,
      COUNT(*) AS total, SUM(i.decision = 'approved') AS approved,
      SUM(i.decision = 'pending') AS pending
      FROM COURSE_VALIDATION_ASSIGNMENT a JOIN COURSE_VALIDATION_ITEM i USING (assignment_id)
      WHERE a.validator_id = ? GROUP BY a.assignment_id, a.cluster_category, a.created_at ORDER BY a.assignment_id DESC`, [id])
    application.assignments = assignments
  }
  return application
}

export async function listValidatorAccounts(database) {
  const [accounts] = await database.query(`SELECT ${accountFields},
    (SELECT COUNT(*) FROM COURSE_VALIDATION_ASSIGNMENT a WHERE a.validator_id = v.validator_id) AS assignments
    FROM VALIDATOR_ACCOUNT v ORDER BY v.validator_id DESC`)
  const [invitations] = await database.query(`SELECT email, created_at, expires_at, consumed_at,
    CASE WHEN consumed_at IS NOT NULL THEN 'accepted' WHEN expires_at <= UTC_TIMESTAMP(6) THEN 'expired' ELSE 'open' END AS status
    FROM VALIDATION_ACCOUNT_TOKEN WHERE purpose = 'validator_invite' ORDER BY created_at DESC`)
  return { accounts: accounts.map(decodeClusters), invitations, clusters: PARENT_CLUSTERS }
}

export async function lockValidator(connection, id, sessionVersion) {
  const [[account]] = await connection.execute('SELECT * FROM VALIDATOR_ACCOUNT WHERE validator_id = ? FOR UPDATE', [id])
  if (!account || (sessionVersion && (!matchesPasswordSession(sessionVersion, account.password_hash) || account.status === 'deactivated'))) {
    throw new WorkflowError('Validator account unavailable.', sessionVersion ? 401 : 404)
  }
  return decodeClusters(account)
}

export async function decideValidator(database, adminId, id, input) {
  const status = input?.decision
  if (!['approved', 'correction', 'rejected', 'deactivated'].includes(status)) throw new WorkflowError('Select a valid application decision.')
  const clusters = status === 'approved' ? reviewClusters(input.clusters) : null
  const remarks = workflowText(input.remarks, 'Feedback', 2500, status !== 'approved')
  return workflowTransaction(database, async (connection) => {
    const account = await lockValidator(connection, id)
    const [[credential]] = await connection.execute('SELECT MAX(credential_id) AS id FROM VALIDATOR_CREDENTIAL WHERE validator_id = ?', [id])
    const allowed = status === 'deactivated' ? account.status !== 'deactivated' : account.status === 'pending'
    if (!allowed || credential.id !== input.credentialId) throw new WorkflowError('The application changed. Reload before deciding.', 409)
    if (clusters?.some(cluster => !account.requested_clusters.includes(cluster))) throw new WorkflowError('Approve only clusters requested by this applicant.')
    await connection.execute('UPDATE VALIDATOR_ACCOUNT SET status = ?, approved_clusters = ? WHERE validator_id = ?', [status, clusters ? JSON.stringify(clusters) : null, id])
    await connection.execute(`INSERT INTO VALIDATOR_ACCOUNT_DECISION (validator_id, admin_id, credential_id, status, remarks, approved_clusters)
      VALUES (?, ?, ?, ?, ?, ?)`, [id, adminId, credential.id, status, remarks, clusters ? JSON.stringify(clusters) : null])
    return { status }
  })
}

export async function correctCredential(database, validator, input) {
  const contents = reviewImage(input?.credential)
  return workflowTransaction(database, async (connection) => {
    const account = await lockValidator(connection, validator.id, validator.sessionVersion)
    if (account.status !== 'correction') throw new WorkflowError('Credential correction is unavailable in the current application state.', 409)
    await connection.execute('INSERT INTO VALIDATOR_CREDENTIAL (validator_id, contents) VALUES (?, ?)', [validator.id, contents])
    await connection.execute("UPDATE VALIDATOR_ACCOUNT SET status = 'pending' WHERE validator_id = ?", [validator.id])
    return { status: 'pending' }
  })
}

export async function privateCredential(database, validatorId, credentialId) {
  const [[credential]] = await database.execute('SELECT contents FROM VALIDATOR_CREDENTIAL WHERE validator_id = ? AND credential_id = ?', [validatorId, credentialId])
  if (!credential) throw new WorkflowError('Credential not found.', 404)
  return credential.contents
}
