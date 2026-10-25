import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import jwt from 'jsonwebtoken'
import pool from '../config/db.js'
import authenticateToken from '../middleware/authenticateToken.js'
import { createAccountRouter } from '../routes/accountRoutes.js'
import { ADMIN_JWT_AUDIENCE, USER_JWT_AUDIENCE, jwtSignOptions } from '../config/security.js'

const secret = 'local-account-information-test-secret'
const originalQuery = pool.query
const originalSecret = process.env.JWT_SECRET
test.afterEach(() => {
  pool.query = originalQuery
  if (originalSecret === undefined) delete process.env.JWT_SECRET
  else process.env.JWT_SECRET = originalSecret
})

async function fixture(t, { rows = [{ username: 'ActualStudent', email: 'student@example.test', password: 'never-return-this' }], fail = false, active = true } = {}) {
  process.env.JWT_SECRET = secret
  const calls = []
  pool.query = async (sql, params) => {
    assert.match(sql, /^SELECT user_id FROM USER_ACCOUNT/)
    assert.deepEqual(params, [7])
    return [active ? [{ user_id: 7 }] : []]
  }
  const database = { async query(sql, params) {
    calls.push({ sql, params })
    assert.equal(sql, 'SELECT username, email FROM USER_ACCOUNT WHERE user_id = ? AND is_active = 1 LIMIT 1')
    if (fail) throw new Error('private database error')
    return [rows]
  } }
  const app = express()
  app.use('/api/account', createAccountRouter(database, authenticateToken))
  const server = app.listen(0, '127.0.0.1')
  await new Promise(resolve => server.once('listening', resolve))
  t.after(() => new Promise(resolve => server.close(resolve)))
  const token = (extra = {}, audience = USER_JWT_AUDIENCE) => jwt.sign({ userId: 7, ...extra }, secret, jwtSignOptions(audience, '5m'))
  const request = (auth = token(), suffix = '') => fetch(`http://127.0.0.1:${server.address().port}/api/account${suffix}`, { headers: auth ? { Authorization: `Bearer ${auth}` } : {} })
  return { calls, token, request }
}

test('authenticated read returns only the current student username and email without writes', async t => {
  const f = await fixture(t)
  const response = await f.request(f.token(), '?userId=999')
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.deepEqual(await response.json(), { username: 'ActualStudent', email: 'student@example.test' })
  assert.deepEqual(f.calls[0].params, [7])
  assert.equal(f.calls.length, 1)
})

test('missing, invalid, admin and password-reset credentials cannot read student settings', async t => {
  const f = await fixture(t)
  for (const auth of [null, 'invalid-token', f.token({}, ADMIN_JWT_AUDIENCE), f.token({ role: 'admin' }), f.token({ purpose: 'password-reset' })]) {
    const response = await f.request(auth)
    assert.ok([401, 403].includes(response.status))
    assert.equal(response.headers.get('cache-control'), 'no-store')
  }
  assert.equal(f.calls.length, 0)
})

test('inactive sessions cannot read account information', async t => {
  const f = await fixture(t, { active: false })
  assert.equal((await f.request()).status, 403)
  assert.equal(f.calls.length, 0)
})

test('an account deleted between session validation and reading fails closed', async t => {
  const f = await fixture(t, { rows: [] })
  assert.equal((await f.request()).status, 401)
})

test('database errors expose no internal information and are not cached', async t => {
  const f = await fixture(t, { fail: true })
  const response = await f.request()
  assert.equal(response.status, 503)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.deepEqual(await response.json(), { message: 'Account information is temporarily unavailable. Please try again.' })
})
