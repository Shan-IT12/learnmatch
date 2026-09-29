import assert from 'node:assert/strict'
import test from 'node:test'
import express from 'express'
import {
  createEmailIdentityRateLimiter,
  createEmailIpRateLimiter,
  emailIdentityKey,
} from '../middleware/emailRateLimiters.js'

async function start(handler) {
  const app = express()
  app.set('trust proxy', 1)
  app.use(express.json())
  app.post('/send', ...handler, (_req, res) => res.json({ ok: true }))
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance))
  })
  return server
}

async function post(server, body, forwardedFor) {
  return fetch(`http://127.0.0.1:${server.address().port}/send`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(forwardedFor ? { 'x-forwarded-for': forwardedFor } : {}),
    },
    body: JSON.stringify(body),
  })
}

test('email identity keys are normalized and do not expose account identifiers', () => {
  const first = emailIdentityKey('email', ' Student@Example.com ')
  const second = emailIdentityKey('email', 'student@example.com')
  assert.equal(first, second)
  assert.doesNotMatch(first, /student|example/i)
})

test('email identity volume limit applies across different IP addresses', async (t) => {
  const limiter = createEmailIdentityRateLimiter(
    (req) => emailIdentityKey('test', req.body?.email),
    { windowMs: 60_000, max: 2 }
  )
  const server = await start([limiter])
  t.after(() => server.close())

  assert.equal((await post(server, { email: 'same@example.com' }, '198.51.100.1')).status, 200)
  assert.equal((await post(server, { email: 'same@example.com' }, '198.51.100.2')).status, 200)
  const blocked = await post(server, { email: 'same@example.com' }, '198.51.100.3')
  assert.equal(blocked.status, 429)
})

test('email IP volume limit applies across different identities', async (t) => {
  const server = await start([createEmailIpRateLimiter({ windowMs: 60_000, max: 2 })])
  t.after(() => server.close())

  assert.equal((await post(server, { email: 'one@example.com' }, '203.0.113.5')).status, 200)
  assert.equal((await post(server, { email: 'two@example.com' }, '203.0.113.5')).status, 200)
  assert.equal((await post(server, { email: 'three@example.com' }, '203.0.113.5')).status, 429)
})
