import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import express from 'express'
import jwt from 'jsonwebtoken'
import pool from '../config/db.js'
import {
  generateOtp,
  MAX_OTP_FAILED_ATTEMPTS,
  resendOtp,
  verifyOtp,
  verifyPasswordResetOtp,
} from '../controllers/authController.js'
import {
  createOtpIdentityRateLimiter,
  createOtpIpRateLimiter,
} from '../middleware/otpRateLimiters.js'

const originalQuery = pool.query
const originalGetConnection = pool.getConnection
const originalFetch = global.fetch
const originalSecret = process.env.JWT_SECRET
const originalResendKey = process.env.RESEND_API_KEY
const originalResendFrom = process.env.RESEND_FROM_EMAIL

function invoke(handler, body) {
  const response = {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this },
    json(payload) { this.body = payload; return this },
  }
  return Promise.resolve(handler({ body }, response))
    .then(() => ({ status: response.statusCode, body: response.body }))
}

function installOtpDatabase({
  active = false,
  code = '123456',
  attempts = 0,
  expiresAt = new Date(Date.now() + 60_000),
} = {}) {
  const state = {
    userId: 7,
    email: 'student@example.com',
    active,
    otp: {
      otp_id: 19,
      user_id: 7,
      otp_code: code,
      failed_attempts: attempts,
      expires_at: expiresAt,
    },
    events: [],
  }

  const connection = {
    beginTransaction: async () => state.events.push('begin'),
    commit: async () => state.events.push('commit'),
    rollback: async () => state.events.push('rollback'),
    release: () => state.events.push('release'),
    query: async (sql, values) => {
      if (/FROM USER_ACCOUNT\s+WHERE user_id/.test(sql)) {
        return [[{ user_id: state.userId, username: 'student', is_active: state.active ? 1 : 0 }]]
      }
      if (/FROM OTP_VERIFICATION\s+WHERE user_id/.test(sql)) {
        return [state.otp ? [{ ...state.otp }] : []]
      }
      if (/FROM OTP_VERIFICATION otp/.test(sql)) {
        return [state.active && state.otp ? [{ ...state.otp }] : []]
      }
      if (/SET failed_attempts/.test(sql)) {
        assert.deepEqual(values, [MAX_OTP_FAILED_ATTEMPTS, 19, 7])
        state.otp.failed_attempts = Math.min(
          state.otp.failed_attempts + 1,
          MAX_OTP_FAILED_ATTEMPTS
        )
        return [{ affectedRows: 1 }]
      }
      if (/UPDATE USER_ACCOUNT/.test(sql)) {
        state.active = true
        return [{ affectedRows: 1 }]
      }
      if (/DELETE FROM OTP_VERIFICATION/.test(sql)) {
        state.otp = null
        return [{ affectedRows: 1 }]
      }
      throw new Error(`Unexpected SQL: ${sql}`)
    },
  }
  pool.getConnection = async () => connection
  return state
}

function restoreGlobals() {
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

test('correct registration OTP activates the account and consumes the OTP', async () => {
  process.env.JWT_SECRET = 'otp-protection-test-secret'
  const state = installOtpDatabase()
  const result = await invoke(verifyOtp, { userId: 7, otpCode: '123456' })

  assert.equal(result.status, 200)
  assert.equal(state.active, true)
  assert.equal(state.otp, null)
  assert.equal(result.body.userId, 7)
  assert.equal(result.body.username, 'student')
  const decoded = jwt.verify(result.body.token, process.env.JWT_SECRET)
  assert.equal(decoded.userId, 7)
  assert.equal(decoded.username, 'student')
  assert.deepEqual(state.events, ['begin', 'commit', 'release'])
})

test('wrong registration OTP increments persistent attempts', async () => {
  const state = installOtpDatabase()
  const result = await invoke(verifyOtp, { userId: 7, otpCode: '654321' })

  assert.equal(result.status, 400)
  assert.equal(result.body.token, undefined)
  assert.equal(state.otp.failed_attempts, 1)
  assert.equal(result.body.failedAttempts, undefined)
})

test('registration OTP locks at five failures and a correct code cannot bypass lockout', async () => {
  const state = installOtpDatabase({ attempts: 4 })
  const fifth = await invoke(verifyOtp, { userId: 7, otpCode: '654321' })
  const correctAfterLock = await invoke(verifyOtp, { userId: 7, otpCode: '123456' })

  assert.equal(fifth.status, 400)
  assert.equal(state.otp.failed_attempts, 5)
  assert.equal(correctAfterLock.status, 400)
  assert.equal(state.active, false)
  assert.ok(!correctAfterLock.body.message.includes('5'))
})

test('resending an OTP replaces it with a fresh zero-attempt record', async () => {
  process.env.RESEND_API_KEY = 'test-key'
  process.env.RESEND_FROM_EMAIL = 'test@example.com'
  global.fetch = async () => ({ ok: true, json: async () => ({ id: 'email-1' }) })
  const state = { attempts: 5, code: 'old-code', insertedSql: null }
  pool.query = async (sql, values) => {
    if (/SELECT email, is_active/.test(sql)) {
      return [[{ email: 'student@example.com', is_active: 0 }]]
    }
    if (/DELETE FROM OTP_VERIFICATION/.test(sql)) {
      state.attempts = null
      state.code = null
      return [{ affectedRows: 1 }]
    }
    if (/INSERT INTO OTP_VERIFICATION/.test(sql)) {
      state.insertedSql = sql
      state.code = values[1]
      state.attempts = 0
      return [{ insertId: 20 }]
    }
    throw new Error(`Unexpected SQL: ${sql}`)
  }

  const result = await invoke(resendOtp, { userId: 7 })

  assert.equal(result.status, 200)
  assert.equal(state.attempts, 0)
  assert.match(state.code, /^\d{6}$/)
  assert.match(state.insertedSql, /failed_attempts/)
  assert.match(state.insertedSql, /VALUES \(\?, \?, 0, \?\)/)
})

test('expired registration OTP remains unusable without changing attempts', async () => {
  const state = installOtpDatabase({ expiresAt: new Date(Date.now() - 1_000) })
  const result = await invoke(verifyOtp, { userId: 7, otpCode: '123456' })

  assert.equal(result.status, 400)
  assert.equal(state.active, false)
  assert.equal(state.otp.failed_attempts, 0)
})

test('correct password-reset OTP issues a purpose-bound short-lived JWT', async () => {
  process.env.JWT_SECRET = 'otp-protection-test-secret'
  installOtpDatabase({ active: true })
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

test('wrong reset OTP increments attempts and locks at five failures', async () => {
  process.env.JWT_SECRET = 'otp-protection-test-secret'
  const state = installOtpDatabase({ active: true, attempts: 4 })
  const fifth = await invoke(verifyPasswordResetOtp, {
    email: 'student@example.com',
    otpCode: '654321',
  })
  const correctAfterLock = await invoke(verifyPasswordResetOtp, {
    email: 'student@example.com',
    otpCode: '123456',
  })

  assert.equal(fifth.status, 400)
  assert.equal(state.otp.failed_attempts, 5)
  assert.equal(correctAfterLock.status, 400)
  assert.equal(correctAfterLock.body.resetToken, undefined)
})

test('registration OTP generation uses crypto randomInt and returns six digits', async () => {
  for (let index = 0; index < 100; index += 1) {
    assert.match(generateOtp(), /^\d{6}$/)
  }
  const source = await readFile(new URL('../controllers/authController.js', import.meta.url), 'utf8')
  assert.match(source, /randomInt\(100000, 1000000\)/)
  assert.doesNotMatch(source, /Math\.random/)
})

async function withRateLimitedApp(handler, callback) {
  const app = express()
  app.set('trust proxy', 1)
  app.use(express.json())
  app.post('/verify', ...handler)
  const server = app.listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  try {
    const { port } = server.address()
    await callback(`http://127.0.0.1:${port}/verify`)
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  }
}

test('OTP verification rate limiting activates after excessive failures', async () => {
  const identity = (req) => `registration:${req.body.userId}`
  await withRateLimitedApp([
    createOtpIpRateLimiter({ windowMs: 60_000, max: 2 }),
    createOtpIdentityRateLimiter(identity, { windowMs: 60_000, max: 2 }),
    (_req, res) => res.status(400).json({ message: 'invalid' }),
  ], async (url) => {
    const request = () => fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 7, otpCode: '000000' }),
    })
    assert.equal((await request()).status, 400)
    assert.equal((await request()).status, 400)
    assert.equal((await request()).status, 429)
  })
})

test('successful legitimate OTP verification is not consumed by the failure limiter', async () => {
  const identity = (req) => `registration:${req.body.userId}`
  await withRateLimitedApp([
    createOtpIpRateLimiter({ windowMs: 60_000, max: 1 }),
    createOtpIdentityRateLimiter(identity, { windowMs: 60_000, max: 1 }),
    (_req, res) => res.json({ ok: true }),
  ], async (url) => {
    const request = () => fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 7, otpCode: '123456' }),
    })
    assert.equal((await request()).status, 200)
    assert.equal((await request()).status, 200)
  })
})
