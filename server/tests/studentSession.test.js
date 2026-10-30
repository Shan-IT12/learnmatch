import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import jwt from 'jsonwebtoken'
import pool from '../config/db.js'
import authRoutes from '../routes/authRoutes.js'
import { USER_JWT_AUDIENCE, ADMIN_JWT_AUDIENCE, jwtSignOptions } from '../config/security.js'

test('session verification uses existing JWT expiry and active account checks, distinguishing outages', async t => {
  const originalQuery = pool.query
  const originalSecret = process.env.JWT_SECRET
  process.env.JWT_SECRET = 'student-session-test-secret'
  t.after(() => {
    pool.query = originalQuery
    if (originalSecret === undefined) delete process.env.JWT_SECRET
    else process.env.JWT_SECRET = originalSecret
  })
  const app = express()
  app.use('/api/auth', authRoutes)
  const server = app.listen(0, '127.0.0.1')
  await new Promise(resolve => server.once('listening', resolve))
  t.after(() => new Promise(resolve => server.close(resolve)))
  const sign = (expiresIn = '7d', audience = USER_JWT_AUDIENCE, extra = {}) => jwt.sign(
    { userId: 7, username: 'Student', ...extra }, process.env.JWT_SECRET, jwtSignOptions(audience, expiresIn))
  const verify = token => fetch(`http://127.0.0.1:${server.address().port}/api/auth/session`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })

  pool.query = async () => [[{ user_id: 7 }]]
  const valid = await verify(sign())
  assert.equal(valid.status, 200)
  assert.equal(valid.headers.get('cache-control'), 'no-store')
  assert.deepEqual(await valid.json(), { userId: 7, username: 'Student' })
  assert.equal((await verify()).status, 401)
  assert.equal((await verify(sign('-1s'))).status, 403)
  assert.equal((await verify('invalid-token')).status, 403)
  assert.equal((await verify(sign('7d', ADMIN_JWT_AUDIENCE))).status, 403)
  assert.equal((await verify(sign('7d', USER_JWT_AUDIENCE, { purpose: 'password-reset' }))).status, 403)
  pool.query = async () => [[]]
  assert.equal((await verify(sign())).status, 403)
  pool.query = async () => { throw new Error('Database unavailable') }
  assert.equal((await verify(sign())).status, 503)
  assert.equal((await verify(sign('-1s'))).status, 403)
})
