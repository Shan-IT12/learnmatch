import test from 'node:test'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import express from 'express'
import { createProxyTrust } from '../config/proxyTrust.js'
import { createLoginIpRateLimiter } from '../middleware/loginRateLimiters.js'

test('proxy trust requires explicit restricted IPs or CIDRs', () => {
  assert.equal(createProxyTrust({ RAILWAY_ENVIRONMENT: 'production' }), false)
  for (const value of ['true', '1', 'loopback', '0.0.0.0/0', '::/0', '::ffff:192.0.2.1', '192.0.2.1/99', '999.20.1.1', '2001:db8:::20', '2001:db8::1/129']) {
    assert.throws(() => createProxyTrust({ TRUSTED_PROXY_CIDRS: value }))
  }
  const trusted = createProxyTrust({ TRUSTED_PROXY_CIDRS: '192.0.2.4, 2001:db8:1::/48' })
  assert.equal(trusted('::ffff:192.0.2.4'), true)
  assert.equal(trusted('2001:db8:1::1'), true)
  assert.equal(trusted('192.0.2.5'), false)
  assert.equal(trusted('malformed'), false)
})

test('login rate limits use IPv4 and IPv6 clients from an allowlisted proxy and ignore forwarding headers from untrusted peers', async t => {
  const validation = t.mock.method(console, 'error', () => {})
  const app = express()
  app.set('trust proxy', createProxyTrust({ TRUSTED_PROXY_CIDRS: '127.0.0.1' }))
  app.post('/trusted', createLoginIpRateLimiter({ max: 2 }), (req, res) => res.status(401).json({ ip: req.ip }))
  const direct = express()
  direct.set('trust proxy', createProxyTrust({ TRUSTED_PROXY_CIDRS: '192.0.2.4' }))
  direct.post('/', createLoginIpRateLimiter({ max: 1 }), (req, res) => res.status(401).json({ ip: req.ip }))
  app.use('/direct', direct)
  const unconfigured = express()
  unconfigured.set('trust proxy', createProxyTrust({}))
  unconfigured.post('/', createLoginIpRateLimiter({ max: 1 }), (req, res) => res.status(401).json({ ip: req.ip }))
  app.use('/unconfigured', unconfigured)
  const http = app.listen(0, '127.0.0.1')
  t.after(() => new Promise(resolve => http.close(resolve)))
  await once(http, 'listening')
  const base = `http://127.0.0.1:${http.address().port}`
  for (const [path, header, status, ip] of [
    ['/trusted', '198.51.100.1, 203.0.113.1', 401, '203.0.113.1'],
    ['/trusted', 'invalid, 203.0.113.1', 401, '203.0.113.1'],
    ['/trusted', '198.51.100.2, 203.0.113.1', 429],
    ['/trusted', 'invalid, 203.0.113.2', 401, '203.0.113.2'],
    ['/trusted', '999.20.1.1, 2001:db8:100:aa10::1', 401, '2001:db8:100:aa10::1'],
    ['/trusted', '2001:db8:::20, 2001:db8:100:aa20::2', 401, '2001:db8:100:aa20::2'],
    ['/trusted', '198.51.100.3, 2001:db8:100:aaff::3', 429],
    ['/trusted', '198.51.100.4, 2001:db8:100:ab01::1', 401, '2001:db8:100:ab01::1'],
    ['/direct', '203.0.113.1', 401, '127.0.0.1'],
    ['/direct', '203.0.113.2', 429],
    ['/direct', '999.20.1.1', 429],
    ['/direct', '2001:db8:::20', 429],
  ]) {
    // The trusted cases model a proxy appending its observed client address.
    // The direct cases model any untrusted peer, including a private caller.
    const response = await fetch(base + path, { method: 'POST', headers: {
      'X-Forwarded-For': header,
      'X-Real-IP': header.split(',')[0],
      'X-Railway-Edge': 'synthetic-pop',
    } })
    assert.equal(response.status, status)
    const body = await response.json()
    if (ip) assert.equal(body.ip, ip)
    else assert.ok(Number(response.headers.get('retry-after')) > 0)
  }
  assert.equal(validation.mock.callCount(), 0)

  for (const [header, status] of [['203.0.113.1', 401], ['2001:db8::2', 429], ['999.20.1.1', 429], ['2001:db8:::20', 429]]) {
    const response = await fetch(base + '/unconfigured', { method: 'POST', headers: {
      'X-Forwarded-For': header, 'X-Real-IP': header, 'X-Railway-Edge': 'synthetic-pop',
    } })
    assert.equal(response.status, status)
    await response.json()
  }
  assert.equal(validation.mock.callCount(), 1)
  assert.equal(validation.mock.calls[0].arguments[0].code, 'ERR_ERL_UNEXPECTED_X_FORWARDED_FOR')
})
