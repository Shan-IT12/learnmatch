import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { isPublicAddress, checkedSourceUrl, safeFetchSource, resolveSourceAddress, pinnedRequestOptions, requestPinned } from '../services/safeSourceFetchService.js'

test('block private/local/reserved IPv4, mapped/tunnel IPv6, disguised loopback and unsafe URLs', () => {
  for (const address of ['0.0.0.0', '127.1.2.3', '10.1.1.1', '100.64.1.1', '169.254.169.254', '172.16.1.1', '192.168.0.1', '192.0.0.9', '192.0.2.1', '192.88.99.1', '198.18.0.1', '198.51.100.1', '203.0.113.1', '224.0.0.1', '240.0.0.1', '::1', '::', 'fe80::1', 'fc00::1', '::ffff:8.8.8.8', '64:ff9b::808:808', '2001:db8::1', '2002:808:808::1', '3fff::1']) assert.equal(isPublicAddress(address), false, address)
  for (const address of ['8.8.8.8', '1.1.1.1', '2001:4860:4860::8888']) assert.equal(isPublicAddress(address), true, address)
  for (const url of ['file:///etc/passwd', 'javascript:alert(1)', 'http://localhost', 'http://host.local', 'http://169.254.169.254/', 'http://2130706433', 'http://0x7f000001', 'http://[::ffff:127.0.0.1]', 'https://example.edu:444/', 'https://user:password@example.edu/', 'http://singlelabel/', 'https://example.edu/a\nb']) assert.throws(() => checkedSourceUrl(url))
})
test('reject mixed DNS answers and DNS timeout before connecting; pin the validated address', async () => {
  await assert.rejects(resolveSourceAddress(new URL('https://example.edu'), async () => [{ address: '8.8.8.8', family: 4 }, { address: '127.0.0.1', family: 4 }]), { code: 'BLOCKED_DNS' })
  await assert.rejects(resolveSourceAddress(new URL('https://example.edu'), () => new Promise(() => {}), 5), { code: 'TIMEOUT' })
  await assert.rejects(resolveSourceAddress(new URL('https://example.edu'), () => { throw new Error('Expired requests must not resolve DNS') }, 0), { code: 'TIMEOUT' })
  const pin = { address: '8.8.8.8', family: 4 }
  const options = pinnedRequestOptions(new URL('https://example.edu'), pin)
  assert.equal(options.agent, false)
  assert.equal(options.rejectUnauthorized, true)
  assert.equal(options.servername, 'example.edu')
  await new Promise((resolve) => options.lookup('example.edu', {}, (_error, address, family) => { assert.equal(address, pin.address); assert.equal(family, 4); resolve() }))
  await new Promise((resolve) => options.lookup('example.edu', { all: true }, (_error, addresses) => { assert.deepEqual(addresses, [pin]); resolve() }))
  assert.equal(options.headers.Authorization, undefined)
  assert.equal(options.headers.Cookie, undefined)
  assert.equal(options.headers['Accept-Encoding'], 'identity')
})
test('revalidate every redirect, block rebinding and HTTPS downgrade, and limit redirect chains', async () => {
  const lookup = async () => [{ address: '8.8.8.8', family: 4 }]
  let calls = 0
  await assert.rejects(safeFetchSource('https://example.edu', { lookup, request: async () => { calls++; return { redirect: 'http://127.0.0.1/admin' } } }), { code: 'BLOCKED_ADDRESS' })
  assert.equal(calls, 1)
  await assert.rejects(safeFetchSource('https://example.edu', { lookup, request: async () => ({ redirect: 'http://public.example.edu' }) }), { code: 'INSECURE_REDIRECT' })
  calls = 0
  await assert.rejects(safeFetchSource('https://example.edu', { lookup, request: async () => { calls++; return { redirect: '/again' } } }), { code: 'REDIRECT_LIMIT' })
  assert.equal(calls, 4)
  let resolutions = 0
  calls = 0
  await assert.rejects(safeFetchSource('https://example.edu', { lookup: async () => [{ address: ++resolutions === 1 ? '8.8.8.8' : '10.0.0.1', family: 4 }], request: async () => { calls++; return { redirect: '/other' } } }), { code: 'BLOCKED_DNS' })
  assert.equal(calls, 1)
})
test('real bounded downloader forwards no credentials and enforces size, encoding and time limits', async (t) => {
  let observed
  const server = http.createServer((req, res) => {
    observed = req.headers
    if (req.url === '/slow') return
    res.setHeader('Content-Type', 'text/html')
    if (req.url === '/gzip') res.setHeader('Content-Encoding', 'gzip')
    if (req.url === '/large') { res.write('a'.repeat(40)); res.end('b'.repeat(40)) }
    else res.end('<h1>Public source fixture</h1>')
  })
  server.listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  t.after(() => new Promise((resolve) => { server.closeAllConnections(); server.close(resolve) }))
  const endpoint = (name) => new URL(`http://127.0.0.1:${server.address().port}/${name}`)
  const pin = { address: '127.0.0.1', family: 4 }
  const response = await requestPinned(endpoint('ok'), pin, 2000)
  assert.equal(response.type, 'text/html')
  assert.equal(observed.authorization, undefined)
  assert.equal(observed.cookie, undefined)
  assert.equal(observed['accept-encoding'], 'identity')
  await assert.rejects(requestPinned(endpoint('large'), pin, 2000, { bytes: 50 }), { code: 'SIZE_LIMIT' })
  await assert.rejects(requestPinned(endpoint('gzip'), pin, 2000), { code: 'UNSUPPORTED_CONTENT' })
  await assert.rejects(requestPinned(endpoint('slow'), pin, 20), { code: 'TIMEOUT' })
})


test('PDF-specific limits enforce both declared and chunked bytes while HTML keeps its smaller cap', async (t) => {
  const server = http.createServer((req, res) => {
    res.setHeader('Content-Type', req.url === '/html' ? 'text/html' : 'application/pdf')
    if (req.url === '/encoded') res.setHeader('Content-Encoding', 'gzip')
    if (req.url === '/declared') res.setHeader('Content-Length', 100)
    res.write(Buffer.alloc(40)); res.end(Buffer.alloc(40))
  })
  server.listen(0, '127.0.0.1')
  await new Promise(resolve => server.once('listening', resolve))
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve) }))
  const endpoint = path => new URL(`http://127.0.0.1:${server.address().port}/${path}`)
  const pin = { address: '127.0.0.1', family: 4 }
  const limits = { bytes: 50, pdfBytes: 90 }
  assert.equal((await requestPinned(endpoint('pdf'), pin, 2000, limits)).bytes.length, 80)
  await assert.rejects(requestPinned(endpoint('html'), pin, 2000, limits), {code: 'SIZE_LIMIT'})
  await assert.rejects(requestPinned(endpoint('declared'), pin, 2000, limits), {code: 'SIZE_LIMIT'})
  await assert.rejects(requestPinned(endpoint('pdf'), pin, 2000, {bytes: 50, pdfBytes: 60}), {code: 'SIZE_LIMIT'})
  await assert.rejects(requestPinned(endpoint('encoded'), pin, 2000, limits), {code: 'UNSUPPORTED_CONTENT'})
})
