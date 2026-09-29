import assert from 'node:assert/strict'
import test from 'node:test'
import jwt from 'jsonwebtoken'
import pool from '../config/db.js'
import authenticateToken from '../middleware/authenticateToken.js'
import {
  USER_JWT_AUDIENCE,
  allowedCorsOrigins,
  corsOptions,
  jwtSignOptions,
} from '../config/security.js'

function invokeMiddleware(token) {
  return new Promise((resolve) => {
    const req = { headers: { authorization: `Bearer ${token}` } }
    const res = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this },
      json(body) { resolve({ status: this.statusCode, body }) },
    }
    authenticateToken(req, res, () => resolve({ status: 200, user: req.user }))
  })
}

test('CORS permits configured production and approved local origins only', async () => {
  const env = {
    NODE_ENV: 'development',
    FRONTEND_URL: 'https://learnmatch.example',
    CORS_ALLOWED_ORIGINS: 'https://preview.example',
  }
  const origins = allowedCorsOrigins(env)
  assert.equal(origins.has('https://learnmatch.example'), true)
  assert.equal(origins.has('http://localhost:5173'), true)
  assert.equal(origins.has('https://evil.example'), false)

  const check = (origin) => new Promise((resolve) => corsOptions(env).origin(origin, (_error, allowed) => resolve(allowed)))
  assert.equal(await check('https://learnmatch.example'), true)
  assert.equal(await check('https://evil.example'), false)
})

test('JWT verification requires issuer, audience, algorithm, and an active account', async () => {
  process.env.JWT_SECRET = 'security-hardening-test-secret'
  pool.query = async () => [[{ user_id: 7 }]]
  const valid = jwt.sign(
    { userId: 7 },
    process.env.JWT_SECRET,
    jwtSignOptions(USER_JWT_AUDIENCE, '10m')
  )
  const missingContext = jwt.sign({ userId: 7 }, process.env.JWT_SECRET)
  const wrongAudience = jwt.sign(
    { userId: 7 },
    process.env.JWT_SECRET,
    jwtSignOptions('wrong-audience', '10m')
  )
  assert.equal((await invokeMiddleware(valid)).status, 200)
  assert.equal((await invokeMiddleware(missingContext)).status, 403)
  assert.equal((await invokeMiddleware(wrongAudience)).status, 403)

  pool.query = async () => [[]]
  assert.equal((await invokeMiddleware(valid)).status, 403)
})

test('server enables Helmet CSP, bounded JSON, restricted CORS, and hides fingerprinting', async () => {
  const source = await import('node:fs/promises').then(({ readFile }) => readFile(new URL('../server.js', import.meta.url), 'utf8'))
  assert.match(source, /app\.disable\('x-powered-by'\)/)
  assert.match(source, /app\.use\(helmet\(/)
  assert.match(source, /contentSecurityPolicy/)
  assert.match(source, /cors\(corsOptions\(\)\)/)
  assert.match(source, /express\.json\(\{ limit: '100kb' \}\)/)
})
