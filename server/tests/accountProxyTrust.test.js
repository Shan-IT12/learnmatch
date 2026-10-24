import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import express from 'express'
import jwt from 'jsonwebtoken'
import { createProxyTrust, normalizeClientIp } from '../config/proxyTrust.js'
import { createAccountRouter } from '../routes/accountRoutes.js'

test('proxy trust remains explicit and rejects permissive configuration', () => {
  assert.equal(createProxyTrust({}), false)
  for (const value of ['true', '1', 'loopback', '0.0.0.0/0', '::/0', '127.0.0.1/33', '127.0.0.1,', '::ffff:127.0.0.1/128']) assert.throws(() => createProxyTrust({ TRUSTED_PROXY_CIDRS: value }))
  const trust = createProxyTrust({ TRUSTED_PROXY_CIDRS: '127.0.0.2/32,2001:db8::1/128' })
  assert.equal(trust('::ffff:127.0.0.2'), true)
  assert.equal(trust('127.0.0.3'), false)
  assert.equal(trust('2001:db8::1'), true)
  assert.equal(trust('invalid'), false)
  assert.equal(normalizeClientIp('::ffff:192.0.2.5'), '192.0.2.5')
  for (const ip of ['invalid', '192.0.2.1:80', '192.0.2.1,192.0.2.2', '', undefined]) assert.equal(normalizeClientIp(ip), null)
})

async function fixture(t, { trusted = false, append = false } = {}) {
  const app = express()
  app.set('trust proxy', createProxyTrust(trusted ? { TRUSTED_PROXY_CIDRS: '127.0.0.2/32' } : {}))
  const secret = 'isolated-synthetic-rate-limiter-test-secret'
  const sign = claims => jwt.sign(claims, secret, { algorithm: 'HS256', audience: 'test-student', issuer: 'test-api' })
  let authCalls = 0
  // Real HTTP and signed synthetic JWTs; actual account liveness is tested by
  // accountDeletion.integration.test.js. Invalid payloads cannot reach the DB.
  app.use('/api/account', createAccountRouter({ getConnection() { throw new Error('No DB access allowed') } }, (req, res, next) => {
    authCalls++
    try {
      req.user = jwt.verify(req.get('authorization')?.replace(/^Bearer /, ''), secret, { algorithms: ['HS256'], audience: 'test-student', issuer: 'test-api' })
      next()
    } catch { res.status(401).json({ message: 'Unauthorized' }) }
  }))
  const backend = app.listen(0, '127.0.0.1')
  await new Promise(resolve => backend.once('listening', resolve))
  const proxy = http.createServer((req, res) => {
    const forwarded = append && req.headers['x-forwarded-for'] ? `${req.headers['x-forwarded-for']}, ${req.socket.remoteAddress}` : req.socket.remoteAddress
    const upstream = http.request({ host: '127.0.0.1', port: backend.address().port, path: req.url, method: req.method,
      localAddress: '127.0.0.2', headers: { ...req.headers, 'x-forwarded-for': forwarded, 'x-real-ip': req.socket.remoteAddress } }, response => {
      res.writeHead(response.statusCode, response.headers)
      response.pipe(res)
    })
    upstream.on('error', () => { res.statusCode = 502; res.end() })
    req.pipe(upstream)
  }).listen(0, '127.0.0.1')
  await new Promise(resolve => proxy.once('listening', resolve))
  t.after(async () => {
    for (const server of [proxy, backend]) await new Promise(resolve => { server.close(resolve); server.closeAllConnections() })
  })
  const send = ({ viaProxy = true, client = '127.0.0.3', student = 7, claims = {}, headers = {} } = {}) => new Promise((resolve, reject) => {
    const request = http.request({ host: '127.0.0.1', port: (viaProxy ? proxy : backend).address().port, path: '/api/account', method: 'DELETE', localAddress: client,
      headers: { 'Content-Type': 'application/json', 'Content-Length': '2', Authorization: `Bearer ${sign({ userId: student, ...claims })}`, ...headers } }, response => {
      let body = ''
      response.on('data', chunk => { body += chunk })
      response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, body: JSON.parse(body) }))
    })
    request.on('error', reject)
    request.end('{}')
  })
  return { send, authCalls: () => authCalls }
}

for (const trusted of [false, true]) test(`independent student quotas behind one proxy (trusted=${trusted})`, async t => {
  const { send } = await fixture(t, { trusted })
  for (let student = 1; student <= 25; student++) {
    for (let attempt = 0; attempt < 5; attempt++) assert.equal((await send({ student })).status, 400)
    assert.equal((await send({ student })).status, 429)
  }
  assert.equal((await send({ student: 999 })).status, 400)
})

for (const trusted of [false, true]) test(`account quota survives socket/header/token rotation (trusted=${trusted})`, async t => {
  const { send } = await fixture(t, { trusted, append: true })
  for (let i = 0; i < 7; i++) {
    const result = await send({ viaProxy: i % 2 === 0, client: i % 2 ? '127.0.0.4' : '127.0.0.3', claims: { jti: String(i) }, headers: {
      'x-real-ip': `198.51.100.${i + 1}`, 'x-forwarded-for': `192.0.2.${i + 1}`, Forwarded: `for=203.0.113.${i + 1}`,
      'x-test-student': String(100 + i), 'x-railway-edge': 'synthetic', 'x-forwarded-proto': 'https', host: 'synthetic.up.railway.app',
    } })
    assert.equal(result.status, i < 5 ? 400 : 429)
    assert.equal(result.headers['cache-control'], 'no-store')
  }
  assert.equal((await send({ student: 8 })).status, 400)
})

test('missing, forged and expired JWTs cannot select or consume a student quota', async t => {
  const { send } = await fixture(t)
  for (const token of ['', 'forged-token']) for (let i = 0; i < 6; i++) assert.equal((await send({ headers: { Authorization: token, 'x-test-student': '7' } })).status, 401)
  assert.equal((await send({ claims: { exp: 1 } })).status, 401)
  for (let i = 0; i < 5; i++) assert.equal((await send()).status, 400)
  assert.equal((await send()).status, 429)
})

test('admin and malformed verified identities are rejected before account limiting', async t => {
  const { send } = await fixture(t)
  for (const claims of [{ role: 'admin' }, { adminId: 1 }]) assert.equal((await send({ claims })).status, 403)
  for (const student of [0, -1, '7', 1.5]) assert.equal((await send({ student })).status, 401)
  for (let i = 0; i < 5; i++) assert.equal((await send()).status, 400)
})

test('service budget stops unauthenticated floods before verification despite forged ingress headers', async t => {
  const { send, authCalls } = await fixture(t)
  for (let i = 0; i < 300; i++) assert.equal((await send({ viaProxy: i % 2 === 0, headers: {
    Authorization: 'forged', 'x-real-ip': `198.51.100.${i % 250 + 1}`, 'x-forwarded-for': 'invalid, spoofed',
  } })).status, 401)
  const result = await send({ student: 999 })
  assert.equal(result.status, 429)
  assert.equal(result.body.code, 'RATE_LIMITED')
  assert.match(result.body.message, /one minute/)
  assert.ok(Number(result.headers['retry-after']) > 0)
  assert.equal(authCalls(), 300)
})
