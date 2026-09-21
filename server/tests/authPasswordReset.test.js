import test from 'node:test'
import assert from 'node:assert/strict'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import pool from '../config/db.js'
import authenticateToken from '../middleware/authenticateToken.js'
import {
  forgotPassword,
  resetPassword,
  verifyPasswordResetOtp,
} from '../controllers/authController.js'

const originalQuery = pool.query
const originalGetConnection = pool.getConnection
const originalFetch = global.fetch
const originalSecret = process.env.JWT_SECRET
const originalResendKey = process.env.RESEND_API_KEY
const originalResendFrom = process.env.RESEND_FROM_EMAIL

const invoke = async (handler, body) => {
  const response = {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this },
    json(payload) { this.body = payload; return this },
  }
  await handler({ body }, response)
  return { status: response.statusCode, body: response.body }
}

const restoreGlobals = () => {
  pool.query = originalQuery
  pool.getConnection = originalGetConnection
  global.fetch = originalFetch
  if (originalSecret === undefined) delete process.env.JWT_SECRET
  else process.env.JWT_SECRET = originalSecret
  if (originalResendKey === undefined) delete process.env.RESEND_API_KEY
  else process.env.RESEND_API_KEY = originalResendKey
  if (originalResendFrom === undefined) delete process.env.RESEND_FROM_EMAIL
  else process.env.RESEND_FROM_EMAIL = originalResendFrom
}

test.afterEach(restoreGlobals)

test('forgot-password returns the same generic response for missing and active accounts', async () => {
  process.env.RESEND_API_KEY = 'test-key'
  process.env.RESEND_FROM_EMAIL = 'test@example.com'
  const sentEmails = []
  global.fetch = async (_url, options) => {
    sentEmails.push(JSON.parse(options.body))
    return { ok: true, json: async () => ({ id: 'email-1' }) }
  }

  pool.query = async () => [[]]
  const missing = await invoke(forgotPassword, { email: 'missing@example.com' })

  const calls = []
  pool.query = async (sql, values) => {
    calls.push({ sql, values })
    if (/SELECT user_id, email/.test(sql)) return [[{ user_id: 7, email: 'student@example.com' }]]
    if (/DELETE FROM OTP_VERIFICATION WHERE user_id/.test(sql)) return [{ affectedRows: 1 }]
    if (/INSERT INTO OTP_VERIFICATION/.test(sql)) return [{ insertId: 31 }]
    throw new Error(`Unexpected SQL: ${sql}`)
  }
  const existing = await invoke(forgotPassword, { email: ' Student@Example.com ' })

  assert.equal(missing.status, 200)
  assert.equal(existing.status, 200)
  assert.deepEqual(existing.body, missing.body)
  assert.equal(sentEmails.length, 1)
  assert.deepEqual(calls[0].values, ['student@example.com'])
  assert.match(calls[1].sql, /DELETE FROM OTP_VERIFICATION/)
  assert.match(calls[2].sql, /INSERT INTO OTP_VERIFICATION/)
  assert.match(calls[2].values[1], /^\d{6}$/)
  assert.ok(calls[2].values[2] instanceof Date)
})

test('forgot-password cleans up only its new OTP if Resend fails and keeps a generic response', async () => {
  process.env.RESEND_API_KEY = 'test-key'
  process.env.RESEND_FROM_EMAIL = 'test@example.com'
  global.fetch = async () => ({ ok: false, status: 503, text: async () => 'unavailable' })
  const calls = []
  pool.query = async (sql, values) => {
    calls.push({ sql, values })
    if (/SELECT user_id, email/.test(sql)) return [[{ user_id: 7, email: 'student@example.com' }]]
    if (/INSERT INTO OTP_VERIFICATION/.test(sql)) return [{ insertId: 44 }]
    return [{ affectedRows: 1 }]
  }

  const result = await invoke(forgotPassword, { email: 'student@example.com' })

  assert.equal(result.status, 200)
  assert.match(result.body.message, /If an account exists/)
  assert.deepEqual(calls.at(-1).values, [44, 7])
})

test('OTP verification issues a short-lived purpose-scoped reset token for an active account', async () => {
  process.env.JWT_SECRET = 'password-reset-test-secret'
  pool.query = async () => [[{
    otp_id: 19,
    user_id: 7,
    otp_code: '123456',
    expires_at: new Date(Date.now() + 60_000),
  }]]

  const result = await invoke(verifyPasswordResetOtp, {
    email: 'student@example.com',
    otpCode: '123456',
  })

  assert.equal(result.status, 200)
  const decoded = jwt.verify(result.body.resetToken, process.env.JWT_SECRET)
  assert.equal(decoded.userId, 7)
  assert.equal(decoded.otpId, 19)
  assert.equal(decoded.purpose, 'password-reset')
  assert.ok(decoded.exp - decoded.iat <= 600)
})

test('OTP verification rejects incorrect and expired codes without issuing a token', async () => {
  process.env.JWT_SECRET = 'password-reset-test-secret'
  pool.query = async () => [[{
    otp_id: 19,
    user_id: 7,
    otp_code: '123456',
    expires_at: new Date(Date.now() - 1_000),
  }]]

  const expired = await invoke(verifyPasswordResetOtp, { email: 'student@example.com', otpCode: '123456' })
  const incorrect = await invoke(verifyPasswordResetOtp, { email: 'student@example.com', otpCode: '654321' })

  assert.equal(expired.status, 400)
  assert.equal(incorrect.status, 400)
  assert.equal(expired.body.resetToken, undefined)
  assert.deepEqual(expired.body, incorrect.body)
})

test('reset rejects a normal login JWT and mismatched passwords before accessing the database', async () => {
  process.env.JWT_SECRET = 'password-reset-test-secret'
  const loginToken = jwt.sign({ userId: 7, username: 'student' }, process.env.JWT_SECRET)
  pool.getConnection = async () => { throw new Error('database should not be accessed') }

  const wrongPurpose = await invoke(resetPassword, {
    resetToken: loginToken,
    password: 'NewPassword1',
    confirmPassword: 'NewPassword1',
  })
  const mismatch = await invoke(resetPassword, {
    resetToken: 'unused',
    password: 'NewPassword1',
    confirmPassword: 'Different1',
  })

  assert.equal(wrongPurpose.status, 401)
  assert.equal(mismatch.status, 400)
  assert.equal(mismatch.body.message, 'Passwords do not match')
})

test('normal authentication middleware rejects password-reset JWTs', async () => {
  process.env.JWT_SECRET = 'password-reset-test-secret'
  const resetToken = jwt.sign(
    { userId: 7, otpId: 19, purpose: 'password-reset' },
    process.env.JWT_SECRET,
    { expiresIn: '10m' }
  )
  let nextCalled = false
  const result = await new Promise((resolve) => {
    const response = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this },
      json(body) { resolve({ status: this.statusCode, body }) },
    }
    authenticateToken(
      { headers: { authorization: `Bearer ${resetToken}` } },
      response,
      () => { nextCalled = true; resolve({ status: 200 }) }
    )
  })

  assert.equal(result.status, 403)
  assert.equal(nextCalled, false)

  const loginToken = jwt.sign({ userId: 7, username: 'student' }, process.env.JWT_SECRET)
  const loginResult = await new Promise((resolve) => {
    const request = { headers: { authorization: `Bearer ${loginToken}` } }
    const response = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this },
      json(body) { resolve({ status: this.statusCode, body }) },
    }
    authenticateToken(request, response, () => resolve({ status: 200, user: request.user }))
  })
  assert.equal(loginResult.status, 200)
  assert.equal(loginResult.user.userId, 7)
})

test('reset atomically hashes the password and consumes the referenced OTP once', async () => {
  process.env.JWT_SECRET = 'password-reset-test-secret'
  const resetToken = jwt.sign(
    { userId: 7, otpId: 19, purpose: 'password-reset' },
    process.env.JWT_SECRET,
    { expiresIn: '10m' }
  )
  let otpAvailable = true
  let savedHash = null
  const events = []
  const connection = {
    beginTransaction: async () => events.push('begin'),
    rollback: async () => events.push('rollback'),
    commit: async () => events.push('commit'),
    release: () => events.push('release'),
    query: async (sql, values) => {
      if (/SELECT otp\.otp_id/.test(sql)) {
        assert.deepEqual(values, [19, 7])
        return [otpAvailable ? [{ otp_id: 19, expires_at: new Date(Date.now() + 60_000) }] : []]
      }
      if (/UPDATE USER_ACCOUNT/.test(sql)) {
        savedHash = values[0]
        assert.equal(values[1], 7)
        events.push('update')
        return [{ affectedRows: 1 }]
      }
      if (/DELETE FROM OTP_VERIFICATION/.test(sql)) {
        otpAvailable = false
        events.push('delete')
        return [{ affectedRows: 1 }]
      }
      throw new Error(`Unexpected SQL: ${sql}`)
    },
  }
  pool.getConnection = async () => connection

  const first = await invoke(resetPassword, {
    resetToken,
    password: 'NewPassword1',
    confirmPassword: 'NewPassword1',
  })
  const second = await invoke(resetPassword, {
    resetToken,
    password: 'AnotherPassword2',
    confirmPassword: 'AnotherPassword2',
  })

  assert.equal(first.status, 200)
  assert.equal(await bcrypt.compare('NewPassword1', savedHash), true)
  assert.deepEqual(events.slice(0, 5), ['begin', 'update', 'delete', 'commit', 'release'])
  assert.equal(second.status, 401)
  assert.deepEqual(events.slice(5), ['begin', 'rollback', 'release'])
})
