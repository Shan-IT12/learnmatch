import test from 'node:test'
import assert from 'node:assert/strict'
import { authorizeRoles, normalizeAdminRole, STAFF_ROLES } from '../middleware/authorizeRoles.js'
import { createAdminAccount, listAdminAccounts } from '../services/adminAccountService.js'
import { buildStaffLink } from '../services/staffEmailService.js'
import { getSystemErrorLogs, logSystemError } from '../services/systemErrorLogService.js'
import { createErrorHandler } from '../middleware/errorHandler.js'

function mockRes() {
  const res = {
    statusCode: 200,
    body: null,
    headersSent: false,
    status(code) { this.statusCode = code; return this },
    json(payload) { this.body = payload; this.headersSent = true; return this },
  }
  return res
}

test('normalizeAdminRole maps legacy admin to system_developer and preserves 3-tier roles', () => {
  assert.equal(normalizeAdminRole('admin'), STAFF_ROLES.SYSTEM_DEVELOPER)
  assert.equal(normalizeAdminRole('system_developer'), STAFF_ROLES.SYSTEM_DEVELOPER)
  assert.equal(normalizeAdminRole('system_admin'), STAFF_ROLES.SYSTEM_ADMIN)
  assert.equal(normalizeAdminRole('validator'), STAFF_ROLES.VALIDATOR)
})

test('authorizeRoles allows permitted roles and rejects unauthorized roles', () => {
  const devOnly = authorizeRoles(STAFF_ROLES.SYSTEM_DEVELOPER)

  let nextCalled = false
  devOnly({ admin: { role: 'system_developer' } }, mockRes(), () => { nextCalled = true })
  assert.equal(nextCalled, true)

  const forbiddenRes = mockRes()
  nextCalled = false
  devOnly({ admin: { role: 'system_admin' } }, forbiddenRes, () => { nextCalled = true })
  assert.equal(nextCalled, false)
  assert.equal(forbiddenRes.statusCode, 403)
})

test('logSystemError swallows DB errors so logging never crashes the server', async () => {
  const failingDb = {
    async query() { throw new Error('DB connection lost') },
  }
  const ok = await logSystemError(failingDb, {
    source: 'BACKEND',
    endpoint: 'GET /api/test',
    errorMessage: 'Boom',
  })
  assert.equal(ok, false)
})

test('getSystemErrorLogs strips stack_trace for system_admin and includes it for system_developer', async () => {
  const fakeDb = {
    async query(sql) {
      if (sql.includes('COUNT(*)')) return [[{ total: 1 }]]
      return [[{
        id: 7,
        source: 'BACKEND',
        endpoint: 'GET /api/admin/dashboard',
        error_message: 'Query failed',
        stack_trace: 'Error: Query failed\n    at server.js:10',
        user_id: 1,
        created_at: '2026-11-22T06:00:00.000Z',
      }]]
    },
  }

  const adminView = await getSystemErrorLogs(fakeDb, { includeStackTrace: false })
  assert.equal(adminView.logs[0].stack_trace, null)

  const devView = await getSystemErrorLogs(fakeDb, { includeStackTrace: true })
  assert.match(devView.logs[0].stack_trace, /Query failed/)
})

test('global errorHandler logs error to system_error_logs and returns clean JSON', async () => {
  const inserted = []
  const fakeDb = {
    async query(sql, params) {
      inserted.push({ sql, params })
      return [{ insertId: 1 }]
    },
  }
  const handler = createErrorHandler(fakeDb)
  const err = new Error('Unexpected failure')
  err.publicMessage = 'Clean public message'
  const res = mockRes()

  await handler(err, { method: 'GET', originalUrl: '/api/example', user: { userId: 42 } }, res, () => {})

  assert.equal(res.statusCode, 500)
  assert.deepEqual(res.body, { message: 'Clean public message' })
  assert.equal(inserted.length, 1)
  assert.equal(inserted[0].params[0], 'BACKEND')
  assert.equal(inserted[0].params[1], 'GET /api/example')
  assert.equal(inserted[0].params[2], 'Unexpected failure')
  assert.equal(inserted[0].params[4], 42)
})

test('system_admin cannot list or create system_developer accounts', async () => {
  const queries = []
  const fakeDb = {
    async query(sql, params) {
      queries.push({ sql, params })
      return [[{ admin_id: 2, full_name: 'Ops Admin', username: 'ops', email: 'ops@learnmatch.online', role: 'system_admin', created_at: '2026-11-22' }]]
    },
  }

  const list = await listAdminAccounts(fakeDb, { roleFilter: STAFF_ROLES.SYSTEM_ADMIN })
  assert.equal(list.length, 1)
  assert.equal(list[0].role, STAFF_ROLES.SYSTEM_ADMIN)
  assert.match(queries[0].sql, /WHERE role = \?/)

  await assert.rejects(
    () => createAdminAccount(fakeDb, {
      full_name: 'Sneaky Dev',
      username: 'sneaky',
      email: 'sneaky@learnmatch.online',
      role: STAFF_ROLES.SYSTEM_DEVELOPER,
    }, { actorRole: STAFF_ROLES.SYSTEM_ADMIN }),
    (err) => err.status === 403
  )
})

test('buildStaffLink generates a valid copy-pastable validator invite URL', () => {
  const token = 'a'.repeat(43)
  const url = buildStaffLink('validator_invite', token, { NODE_ENV: 'production' })
  assert.equal(url, `https://www.learnmatch.online/validator/account/invite#${token}`)
})
