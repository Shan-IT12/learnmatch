import http from 'node:http'
import https from 'node:https'
import dns from 'node:dns/promises'
import net from 'node:net'
import ipaddr from 'ipaddr.js'
import { HTML_MAX_BYTES, DEFAULT_PDF_MAX_BYTES, sourceContentLimits, sourceByteLimit } from './sourceContentLimits.js'

export const FETCH_LIMITS = Object.freeze({ bytes: HTML_MAX_BYTES, pdfBytes: DEFAULT_PDF_MAX_BYTES, timeout: 10000, redirects: 3, headers: 16384 })
const configuredFetchLimits = () => ({ ...FETCH_LIMITS, ...sourceContentLimits() })
export class SourceFetchError extends Error {
  constructor(code, message, details = {}) { super(message); this.code = code; Object.assign(this, details) }
}
export function isPublicAddress(address) {
  try {
    if (!net.isIP(address)) return false
    const parsed = ipaddr.parse(address)
    // Reject mapped/translated/tunnel IPv6, not merely its embedded IPv4.
    if (parsed.range() !== 'unicast') return false
    if (parsed.kind() === 'ipv6') return parsed.match(ipaddr.parse('2000::'), 3)
    return !parsed.match(ipaddr.parse('192.88.99.0'), 24)
  } catch { return false }
}
export function checkedSourceUrl(value) {
  if (typeof value !== 'string' || value.length > 2048 || !/^https?:\/\//i.test(value) || /[\u0000-\u0020\u007f]/u.test(value)) throw new SourceFetchError('UNSAFE_URL', 'Use a full HTTP or HTTPS URL without spaces.')
  const url = new URL(value)
  const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase().replace(/\.$/, '')
  if (url.username || url.password || !['http:', 'https:'].includes(url.protocol) || (url.port && url.port !== (url.protocol === 'https:' ? '443' : '80'))
    || !hostname.includes('.') && !net.isIP(hostname) || /(?:^|\.)(?:localhost|local|internal|home|lan|test|invalid|onion)$/.test(hostname)) throw new SourceFetchError('UNSAFE_URL', 'Local names, credentials and nonstandard ports are not allowed.')
  if (net.isIP(hostname) && !isPublicAddress(hostname)) throw new SourceFetchError('BLOCKED_ADDRESS', 'Private, local or reserved addresses are blocked.')
  url.hash = ''
  return url
}
async function bounded(promise, remaining, phase = 'download') {
  const timeout = () => new SourceFetchError('TIMEOUT', phase === 'dns' ? 'Source DNS lookup timed out.' : 'Source download timed out.', { fetch_phase: phase })
  if (remaining <= 0) throw timeout()
  let timer
  try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(timeout()), remaining) })]) } finally { clearTimeout(timer) }
}
export async function resolveSourceAddress(url, lookup = dns.lookup, remaining = FETCH_LIMITS.timeout) {
  if (remaining <= 0) throw new SourceFetchError('TIMEOUT', 'Source DNS lookup timed out.', { fetch_phase: 'dns' })
  const hostname = url.hostname.replace(/^\[|\]$/g, '')
  const addresses = net.isIP(hostname) ? [{ address: hostname, family: net.isIP(hostname) }] : await bounded(lookup(hostname, { all: true, verbatim: true }), remaining, 'dns')
  if (!addresses.length || addresses.length > 32 || addresses.some((entry) => !isPublicAddress(entry.address))) throw new SourceFetchError('BLOCKED_DNS', 'The source resolves to a private, local, reserved or mixed address set.')
  return addresses[0]
}
export function pinnedRequestOptions(url, pin) {
  return { method: 'GET', agent: false, family: pin.family, autoSelectFamily: false, rejectUnauthorized: true, maxHeaderSize: FETCH_LIMITS.headers,
    headers: { Accept: 'text/html, application/xhtml+xml, application/pdf', 'Accept-Encoding': 'identity', 'User-Agent': 'LearnMatch-SourceReview/1.0' },
    lookup: (_hostname, options, callback) => options?.all ? callback(null, [pin]) : callback(null, pin.address, pin.family),
    ...(net.isIP(url.hostname.replace(/^\[|\]$/g, '')) ? {} : { servername: url.hostname }),
  }
}
export function requestPinned(url, pin, remaining, limits = configuredFetchLimits()) {
  return new Promise((resolve, reject) => {
    let settled = false, timer, phase = 'connection', phaseStarted = Date.now()
    const abort = () => { request.destroy(); done(new SourceFetchError('CANCELLED', 'Source checking cancelled.')) }
    const done = (error, value) => { if (settled) return; settled = true; clearTimeout(timer); limits.signal?.removeEventListener('abort', abort); error ? reject(error) : resolve(value) }
    const transport = url.protocol === 'https:' ? https : http
    const request = transport.request(url, pinnedRequestOptions(url, pin), (response) => {
      phase = 'response_body'; phaseStarted = Date.now()
      if ([301, 302, 303, 307, 308].includes(response.statusCode)) { response.destroy(); done(null, { redirect: response.headers.location }); return }
      if (response.statusCode !== 200) { response.destroy(); done(new SourceFetchError('HTTP_ERROR', `Source returned HTTP ${response.statusCode}.`)); return }
      const type = String(response.headers['content-type'] || '').split(';')[0].toLowerCase()
      const encoding = String(response.headers['content-encoding'] || 'identity').toLowerCase()
      if (!['text/html', 'application/xhtml+xml', 'application/pdf'].includes(type) || encoding !== 'identity') { response.destroy(); done(new SourceFetchError('UNSUPPORTED_CONTENT', 'Only uncompressed HTML pages and text-based PDFs are supported.')); return }
      const byteLimit = sourceByteLimit(type, limits)
      if (Number(response.headers['content-length']) > byteLimit) { response.destroy(); done(new SourceFetchError('SIZE_LIMIT', 'Source exceeds the download limit.')); return }
      let bytes = 0
      const chunks = []
      response.on('data', (chunk) => {
        bytes += chunk.length
        if (bytes > byteLimit) { done(new SourceFetchError('SIZE_LIMIT', 'Source exceeds the download limit.')); response.destroy(); request.destroy(); return }
        chunks.push(chunk)
      })
      response.on('end', () => done(null, { bytes: Buffer.concat(chunks), type }))
      response.on('error', () => done(new SourceFetchError('READ_ERROR', 'Source download was interrupted.')))
      response.on('aborted', () => done(new SourceFetchError('READ_ERROR', 'Source download was interrupted.')))
    })
    timer = setTimeout(() => { request.destroy(); done(new SourceFetchError('TIMEOUT', 'Source download timed out.', { fetch_phase: phase, phase_elapsed_ms: Math.max(0, Date.now() - phaseStarted) })) }, remaining)
    request.on('socket', (socket) => socket.once(url.protocol === 'https:' ? 'secureConnect' : 'connect', () => {
      let actual = socket.remoteAddress
      try { actual = ipaddr.process(actual).toString() } catch { actual = null }
      if (actual !== ipaddr.process(pin.address).toString()) { request.destroy(); done(new SourceFetchError('PIN_MISMATCH', 'Source connection did not match the validated address.')) }
      else { phase = 'response_headers'; phaseStarted = Date.now() }
    }))
    request.on('error', () => done(new SourceFetchError('CONNECT_ERROR', 'Could not securely connect to the source.')))
    limits.signal?.addEventListener('abort', abort, { once: true })
    if (limits.signal?.aborted) abort()
    else request.end()
  })
}
let activeFetches = 0
export async function safeFetchSource(value, { lookup = dns.lookup, request = requestPinned, limits = configuredFetchLimits(), signal, validateUrl } = {}) {
  if (activeFetches >= 4) throw new SourceFetchError('BUSY', 'Source checking is busy. Try again shortly.')
  activeFetches++
  const started = Date.now(), deadline = started + limits.timeout
  let phase = 'url_validation', phaseStarted = started
  try {
    signal?.throwIfAborted()
    let url = checkedSourceUrl(value)
    for (let hop = 0; hop <= limits.redirects; hop++) {
      validateUrl?.(url.href) // Validate original and every redirect before DNS or connection.
      phase = 'dns'; phaseStarted = Date.now()
      const pin = await resolveSourceAddress(url, lookup, deadline - Date.now())
      const remaining = deadline - Date.now()
      if (remaining <= 0) throw new SourceFetchError('TIMEOUT', 'Source download timed out.')
      signal?.throwIfAborted()
      phase = 'download'; phaseStarted = Date.now()
      const response = await bounded(request(url, pin, remaining, { ...limits, signal }), remaining)
      if (Object.hasOwn(response, 'redirect')) {
        if (!response.redirect || hop === limits.redirects) throw new SourceFetchError('REDIRECT_LIMIT', 'Source redirect limit exceeded or redirect missing.')
        const next = checkedSourceUrl(new URL(response.redirect, url).href)
        if (url.protocol === 'https:' && next.protocol !== 'https:') throw new SourceFetchError('INSECURE_REDIRECT', 'HTTPS redirects to HTTP are blocked.')
        url = next
      } else return { ...response, final_url: url.href }
    }
  } catch (error) {
    if (error instanceof SourceFetchError) Object.assign(error, { fetch_phase: error.fetch_phase || phase,
      phase_elapsed_ms: error.phase_elapsed_ms ?? Math.max(0, Date.now() - phaseStarted),
      elapsed_ms: Math.max(0, Date.now() - started), timeout_ms: limits.timeout })
    throw error
  } finally { activeFetches-- }
}
