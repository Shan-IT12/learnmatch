import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import jwt from 'jsonwebtoken'
import pool from '../config/db.js'
import authenticateAdmin from '../middleware/authenticateAdmin.js'
import noStore from '../middleware/noStore.js'
import { ADMIN_JWT_AUDIENCE, USER_JWT_AUDIENCE, jwtSignOptions } from '../config/security.js'
import { createDirectionsRouter } from '../routes/directionsRoutes.js'
import { DirectionsError } from '../services/directionsService.js'

async function serve(app, fn) {
  const server = app.listen(0, '127.0.0.1')
  await new Promise(resolve => server.once('listening', resolve))
  try { await fn(`http://127.0.0.1:${server.address().port}`) }
  finally { await new Promise(resolve => server.close(resolve)) }
}

test('admin auth distinguishes credential failures, missing admins and database outages without caching responses', async t => {
  const secret = process.env.JWT_SECRET
  process.env.JWT_SECRET = 'isolated-admin-test-secret'
  t.after(() => { if (secret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = secret })
  let mode = 'ok', queries = 0
  t.mock.method(pool, 'query', async () => { queries++; if (mode === 'outage') throw Error('synthetic outage'); return [mode === 'missing' ? [] : [{ admin_id: 1 }]] })
  const admin = jwt.sign({ adminId: 1, role: 'admin' }, process.env.JWT_SECRET, jwtSignOptions(ADMIN_JWT_AUDIENCE, '2h'))
  const student = jwt.sign({ userId: 1 }, process.env.JWT_SECRET, jwtSignOptions(USER_JWT_AUDIENCE, '1h'))
  const expired = jwt.sign({ adminId: 1, role: 'admin' }, process.env.JWT_SECRET, jwtSignOptions(ADMIN_JWT_AUDIENCE, -1))
  const app = express()
  app.get('/admin', authenticateAdmin, (req, res) => res.json({ id: req.admin.adminId }))
  await serve(app, async base => {
    for (const [token, expected] of [[null, 401], ['invalid', 403], [student, 403], [expired, 403]]) {
      const r = await fetch(base + '/admin', { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      assert.equal(r.status, expected); assert.equal(r.headers.get('cache-control'), 'no-store'); await r.text()
    }
    assert.equal(queries, 0)
    for (const [state, status] of [['ok', 200], ['missing', 403], ['outage', 503], ['ok', 200]]) {
      mode = state
      const r = await fetch(base + '/admin', { headers: { Authorization: `Bearer ${admin}` } })
      assert.equal(r.status, status); assert.equal(r.headers.get('cache-control'), 'no-store')
      const body = await r.json()
      if (state === 'outage') assert.match(body.message, /temporarily unavailable/)
    }
  })
})

test('admin no-store covers login and malformed bodies before route handlers', async () => {
  const app = express(); app.use('/api/admin', noStore); app.use(express.json())
  app.post('/api/admin/login', (_req, res) => res.json({ token: 'synthetic' }))
  app.use((error, _req, res, _next) => res.status(400).json({ message: 'Invalid JSON' }))
  await serve(app, async base => {
    for (const [body, status] of [['{}', 200], ['{', 400]]) {
      const r = await fetch(base + '/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body })
      assert.equal(r.status, status); assert.equal(r.headers.get('cache-control'), 'no-store'); await r.text()
    }
  })
})

test('directions limits requests before provider calls and cannot be bypassed with untrusted forwarding headers', async () => {
  let calls = 0
  const app = express(); app.set('trust proxy', false); app.use(express.json())
  app.use('/directions', createDirectionsRouter({ clientLimit: 2, serviceLimit: 10, getDirections: async () => { calls++; return { geometry: {} } } }))
  await serve(app, async base => {
    for (let i = 0; i < 3; i++) {
      const r = await fetch(base + '/directions', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `203.0.113.${i + 1}` }, body: '{}' })
      assert.equal(r.status, i < 2 ? 200 : 429)
      const body = await r.json()
      if (i === 2) { assert.equal(body.code, 'DIRECTIONS_RATE_LIMITED'); assert.ok(Number(r.headers.get('retry-after')) > 0); assert.equal(r.headers.get('cache-control'), 'no-store') }
    }
    assert.equal(calls, 2)
  })
})

test('directions service cap applies across trusted client addresses and preserves provider errors', async () => {
  let calls = 0
  const app = express(); app.set('trust proxy', 'loopback'); app.use(express.json())
  app.use('/directions', createDirectionsRouter({ clientLimit: 10, serviceLimit: 2, getDirections: async () => { calls++; throw new DirectionsError('Invalid route coordinates.', 'INVALID_COORDINATES', 400) } }))
  await serve(app, async base => {
    for (let i = 0; i < 3; i++) {
      const r = await fetch(base + '/directions', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `203.0.113.${i + 1}` }, body: '{}' })
      assert.equal(r.status, i < 2 ? 400 : 429)
      if (i < 2) assert.equal((await r.json()).code, 'INVALID_COORDINATES'); else await r.text()
    }
    assert.equal(calls, 2)
  })
})
