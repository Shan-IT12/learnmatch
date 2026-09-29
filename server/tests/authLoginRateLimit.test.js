import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import pool from '../config/db.js'
import { loginUser } from '../controllers/authController.js'
import { loginAdmin } from '../controllers/adminAuthController.js'
import {
  ADMIN_LOGIN_IDENTITY_RATE_LIMIT_MAX,
  ADMIN_LOGIN_IP_RATE_LIMIT_MAX,
  createLoginIdentityRateLimiter,
  createLoginIpRateLimiter,
  loginIdentityKey,
  normalizeLoginIdentity,
  USER_LOGIN_IDENTITY_RATE_LIMIT_MAX,
  USER_LOGIN_IP_RATE_LIMIT_MAX,
} from '../middleware/loginRateLimiters.js'
import {
  createOtpIdentityRateLimiter,
  createOtpIpRateLimiter,
} from '../middleware/otpRateLimiters.js'

const originalQuery = pool.query
const originalSecret = process.env.JWT_SECRET

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

test.afterEach(() => {
  pool.query = originalQuery
  if (originalSecret === undefined) delete process.env.JWT_SECRET
  else process.env.JWT_SECRET = originalSecret
})

test('normal user login succeeds without changing bcrypt or JWT behavior', async () => {
  process.env.JWT_SECRET = 'login-rate-limit-test-secret'
  const passwordHash = await bcrypt.hash('StudentPassword1', 4)
  pool.query = async (_sql, values) => {
    assert.deepEqual(values, ['student@example.com', 'student@example.com'])
    return [[{
      user_id: 7,
      username: 'student',
      email: 'student@example.com',
      password: passwordHash,
      is_active: 1,
    }]]
  }

  const result = await invoke(loginUser, {
    identifier: 'student@example.com',
    password: 'StudentPassword1',
  })

  assert.equal(result.status, 200)
  const decoded = jwt.verify(result.body.token, process.env.JWT_SECRET)
  assert.equal(decoded.userId, 7)
  assert.equal(decoded.username, 'student')
  assert.ok(decoded.exp - decoded.iat <= 7 * 24 * 60 * 60)
})

test('normal admin login succeeds and preserves the admin JWT role', async () => {
  process.env.JWT_SECRET = 'login-rate-limit-test-secret'
  const passwordHash = await bcrypt.hash('AdminPassword1', 4)
  pool.query = async (_sql, values) => {
    assert.deepEqual(values, ['administrator'])
    return [[{
      admin_id: 3,
      username: 'administrator',
      password_hash: passwordHash,
    }]]
  }

  const result = await invoke(loginAdmin, {
    username: 'administrator',
    password: 'AdminPassword1',
  })

  assert.equal(result.status, 200)
  const decoded = jwt.verify(result.body.token, process.env.JWT_SECRET)
  assert.equal(decoded.adminId, 3)
  assert.equal(decoded.role, 'admin')
  assert.ok(decoded.exp - decoded.iat <= 7 * 24 * 60 * 60)
})

test('invalid user credentials retain one generic response for missing and wrong identities', async () => {
  const passwordHash = await bcrypt.hash('CorrectPassword1', 4)
  pool.query = async (_sql, values) => values[0] === 'known'
    ? [[{ password: passwordHash, is_active: 1 }]]
    : [[]]

  const missing = await invoke(loginUser, { identifier: 'missing', password: 'WrongPassword1' })
  const wrong = await invoke(loginUser, { identifier: 'known', password: 'WrongPassword1' })

  assert.equal(missing.status, 400)
  assert.equal(wrong.status, 400)
  assert.deepEqual(wrong.body, missing.body)
  assert.equal(wrong.body.message, 'Invalid email/username or password')
})

test('invalid admin credentials retain one generic response for missing and wrong identities', async () => {
  const passwordHash = await bcrypt.hash('CorrectPassword1', 4)
  pool.query = async (_sql, values) => values[0] === 'known-admin'
    ? [[{ password_hash: passwordHash }]]
    : [[]]

  const missing = await invoke(loginAdmin, { username: 'missing-admin', password: 'WrongPassword1' })
  const wrong = await invoke(loginAdmin, { username: 'known-admin', password: 'WrongPassword1' })

  assert.equal(missing.status, 400)
  assert.equal(wrong.status, 400)
  assert.deepEqual(wrong.body, missing.body)
  assert.equal(wrong.body.message, 'Invalid username or password')
})

async function withApp(configure, callback) {
  const app = express()
  app.set('trust proxy', 1)
  app.use(express.json())
  configure(app)
  const server = app.listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  try {
    const { port } = server.address()
    await callback(`http://127.0.0.1:${port}`)
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  }
}

const post = (url, body) => fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

test('repeated failed user login triggers layered rate limiting', async () => {
  const identity = (req) => loginIdentityKey('user-test', req.body?.identifier)
  await withApp((app) => {
    app.post(
      '/user/login',
      createLoginIpRateLimiter({ windowMs: 60_000, max: 2 }),
      createLoginIdentityRateLimiter(identity, { windowMs: 60_000, max: 2 }),
      (_req, res) => res.status(400).json({ message: 'Invalid email/username or password' })
    )
  }, async (baseUrl) => {
    const body = { identifier: 'student@example.com', password: 'WrongPassword1' }
    assert.equal((await post(`${baseUrl}/user/login`, body)).status, 400)
    assert.equal((await post(`${baseUrl}/user/login`, body)).status, 400)
    assert.equal((await post(`${baseUrl}/user/login`, body)).status, 429)
  })
})

test('repeated failed admin login triggers the stricter limiter', async () => {
  assert.ok(ADMIN_LOGIN_IP_RATE_LIMIT_MAX < USER_LOGIN_IP_RATE_LIMIT_MAX)
  assert.ok(ADMIN_LOGIN_IDENTITY_RATE_LIMIT_MAX < USER_LOGIN_IDENTITY_RATE_LIMIT_MAX)
  const identity = (req) => loginIdentityKey('admin-test', req.body?.username)
  await withApp((app) => {
    app.post(
      '/admin/login',
      createLoginIpRateLimiter({ windowMs: 60_000, max: 1 }),
      createLoginIdentityRateLimiter(identity, { windowMs: 60_000, max: 1 }),
      (_req, res) => res.status(400).json({ message: 'Invalid username or password' })
    )
  }, async (baseUrl) => {
    const body = { username: 'administrator', password: 'WrongPassword1' }
    assert.equal((await post(`${baseUrl}/admin/login`, body)).status, 400)
    assert.equal((await post(`${baseUrl}/admin/login`, body)).status, 429)
  })
})

test('identity normalization prevents casing, whitespace, and Unicode-form bypasses', () => {
  assert.equal(normalizeLoginIdentity('  Student@Example.COM  '), 'student@example.com')
  assert.equal(
    loginIdentityKey('user', '  Student@Example.COM  '),
    loginIdentityKey('user', 'student@example.com')
  )
  assert.equal(
    loginIdentityKey('admin', 'ＡＤＭＩＮ'),
    loginIdentityKey('admin', 'admin')
  )
  assert.equal(loginIdentityKey('user', { malformed: true }), null)
})

test('successful login responses do not consume failed-login allowance', async () => {
  const identity = (req) => loginIdentityKey('success-test', req.body?.identifier)
  await withApp((app) => {
    app.post(
      '/login',
      createLoginIpRateLimiter({ windowMs: 60_000, max: 1 }),
      createLoginIdentityRateLimiter(identity, { windowMs: 60_000, max: 1 }),
      (_req, res) => res.json({ ok: true })
    )
  }, async (baseUrl) => {
    const body = { identifier: 'student@example.com', password: 'StudentPassword1' }
    assert.equal((await post(`${baseUrl}/login`, body)).status, 200)
    assert.equal((await post(`${baseUrl}/login`, body)).status, 200)
  })
})

test('user login limiter state does not interfere with OTP limiter state', async () => {
  const loginIdentity = (req) => loginIdentityKey('user-test', req.body?.identifier)
  const otpIdentity = (req) => `registration:${req.body?.userId}`
  await withApp((app) => {
    app.post(
      '/login',
      createLoginIpRateLimiter({ windowMs: 60_000, max: 1 }),
      createLoginIdentityRateLimiter(loginIdentity, { windowMs: 60_000, max: 1 }),
      (_req, res) => res.status(400).json({ message: 'invalid' })
    )
    app.post(
      '/verify-otp',
      createOtpIpRateLimiter({ windowMs: 60_000, max: 1 }),
      createOtpIdentityRateLimiter(otpIdentity, { windowMs: 60_000, max: 1 }),
      (_req, res) => res.status(400).json({ message: 'invalid' })
    )
  }, async (baseUrl) => {
    const loginBody = { identifier: 'student@example.com', password: 'wrong' }
    assert.equal((await post(`${baseUrl}/login`, loginBody)).status, 400)
    assert.equal((await post(`${baseUrl}/login`, loginBody)).status, 429)
    assert.equal((await post(`${baseUrl}/verify-otp`, { userId: 7, otpCode: '000000' })).status, 400)
  })
})

test('admin login limiter does not affect authenticated admin route scope', async () => {
  const identity = (req) => loginIdentityKey('admin-test', req.body?.username)
  await withApp((app) => {
    app.post(
      '/admin/login',
      createLoginIpRateLimiter({ windowMs: 60_000, max: 1 }),
      createLoginIdentityRateLimiter(identity, { windowMs: 60_000, max: 1 }),
      (_req, res) => res.status(400).json({ message: 'invalid' })
    )
    app.get('/admin/dashboard', (_req, res) => res.json({ protectedRouteReached: true }))
  }, async (baseUrl) => {
    const body = { username: 'administrator', password: 'wrong' }
    assert.equal((await post(`${baseUrl}/admin/login`, body)).status, 400)
    assert.equal((await post(`${baseUrl}/admin/login`, body)).status, 429)
    assert.equal((await fetch(`${baseUrl}/admin/dashboard`)).status, 200)
  })
})

test('limiter responses expose neither passwords nor JWT-like fields', async () => {
  const identity = (req) => loginIdentityKey('secret-test', req.body?.identifier)
  await withApp((app) => {
    app.post(
      '/login',
      createLoginIpRateLimiter({ windowMs: 60_000, max: 1 }),
      createLoginIdentityRateLimiter(identity, { windowMs: 60_000, max: 1 }),
      (_req, res) => res.status(400).json({ message: 'invalid' })
    )
  }, async (baseUrl) => {
    const body = { identifier: 'student@example.com', password: 'UltraSecret9' }
    await post(`${baseUrl}/login`, body)
    const limited = await post(`${baseUrl}/login`, body)
    const responseBody = await limited.json()
    const serialized = JSON.stringify(responseBody)

    assert.equal(limited.status, 429)
    assert.deepEqual(Object.keys(responseBody), ['message'])
    assert.doesNotMatch(serialized, /UltraSecret9|password|token|jwt/i)
  })
})
