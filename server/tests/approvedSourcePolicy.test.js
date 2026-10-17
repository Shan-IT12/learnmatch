import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import { checkUnsavedSource, confirmUnsavedSource } from '../services/sourceCheckService.js'
import { sourcePublisherConfiguration, approvedSourceUrlError } from '../services/sourcePublisherPolicy.js'
import { safeFetchSource } from '../services/safeSourceFetchService.js'
import { saveDraftSource, reviewDraftSource } from '../services/draftSourceService.js'
import { validateSourceBundle } from '../services/sourceBundlePersistenceService.js'
import { saveCourseDraft, courseDraftOptions } from '../services/courseDraftService.js'
import { createSourceCheckRouter } from '../routes/sourceCheckRoutes.js'

const oldHosts = process.env.SOURCE_APPROVED_PUBLISHER_HOSTS, oldSecret = process.env.JWT_SECRET
process.env.SOURCE_APPROVED_PUBLISHER_HOSTS = 'official.example.edu'
process.env.JWT_SECRET = 'approved-source-fixture-only'
test.after(() => { if (oldHosts === undefined) delete process.env.SOURCE_APPROVED_PUBLISHER_HOSTS; else process.env.SOURCE_APPROVED_PUBLISHER_HOSTS = oldHosts; if (oldSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = oldSecret })
const source = (url = 'https://official.example.edu/reference') => ({ title: 'Synthetic reference', url, notes: '', supported_fields: ['course_name'] })
const course = { course_name: 'Synthetic Course', cluster_category: 'BUSINESS CLUSTER', program_duration_years: 1, year_levels: [{ year: 1, label: 'Year 1', overview: '' }], skill_profile: [{ skill_domain: 'Verbal', weight: 1 }], riasec_profile: ['R', 'I', 'A', 'S', 'E', 'C'].map(riasec_type => ({ riasec_type, weight: 0 })) }
test('checking, source saves, course bundles and manual confirmations reject unapproved hosts before fetching or writing', async () => {
  let touched = false
  const database = { getConnection() { touched = true; throw Error('Must not access DB') } }
  for (const url of ['https://youtube.com/x', 'https://official.example.edu.evil.com/x', 'https://other.gov.ph', 'https://evil.com/official.example.edu', 'https://user:password@official.example.edu', 'https://ched.com.nz', 'https://ched.gov.ph.fake-site.com', 'https://fake-site.com/ched.gov.ph']) {
    await assert.rejects(checkUnsavedSource(url, 7, { courseName: course.course_name, fetch: async () => { touched = true } }), error => error.status === 400 && !!error.details.fieldErrors.url)
    await assert.rejects(saveDraftSource(database, 1, source(url)), { status: 400 })
    assert.throws(() => confirmUnsavedSource({ source: source(url), course, confirmed: true }, 7), { status: 400 })
    assert.throws(() => validateSourceBundle([source(url)], 7), { status: 400 })
    await assert.rejects(saveCourseDraft(database, { ...course, sources: [source(url)] }, null, 7), { status: 400 })
  }
  assert.equal(touched, false)
})

test('changing even an approved URL path rejects previous signed checks and confirmations before any write', async () => {
  const checked = await checkUnsavedSource(source().url, 7, { courseName: course.course_name, fetch: async url => ({ bytes: Buffer.from('fixture'), type: 'text/html', final_url: url }), parse: async () => ({ blocks: [] }) })
  const confirmed = confirmUnsavedSource({ source: source(), course, confirmed: true, check_receipt: checked.check_receipt }, 7)
  const changed = source('https://official.example.edu/another-reference')
  assert.throws(() => confirmUnsavedSource({ source: changed, course, confirmed: true, check_receipt: checked.check_receipt }, 7), { status: 409 })
  assert.throws(() => validateSourceBundle([{ ...changed, check_receipt: checked.check_receipt, confirmation_receipt: confirmed.confirmation_receipt }], 7), { status: 409 })
  const manual = confirmUnsavedSource({ source: source(), course, confirmed: true }, 7)
  assert.throws(() => validateSourceBundle([{ ...changed, confirmation_receipt: manual.confirmation_receipt }], 7), { status: 409 })
  let connected = false
  await assert.rejects(saveCourseDraft({ getConnection() { connected = true; throw Error('Must not write') } }, { ...course, sources: [{ ...changed, confirmation_receipt: manual.confirmation_receipt }] }, null, 7), { status: 409 })
  assert.equal(connected, false)
})
test('stored unapproved sources remain intact; recording a new confirmation is blocked', async () => {
  const stored = { ...source('https://youtube.com/x'), source_id: 2, course_id: 1, source_revision: 1, is_removed: 0 }
  const original = structuredClone(stored), statements = []
  const db = { async getConnection() { return { async beginTransaction() {}, async rollback() {}, release() {}, async query(sql) {
    statements.push(sql)
    if (sql.startsWith('SELECT * FROM COURSE WHERE')) return [[{ course_id: 1, is_draft: 1, is_active: 0 }]]
    if (sql.startsWith('SELECT * FROM COURSE_DRAFT_SOURCE')) return [[stored]]
    throw Error('Unexpected write or query')
  } } } }
  await assert.rejects(reviewDraftSource(db, 1, 2, { confirmed: true, expected_token: 'a'.repeat(64) }, 7), error => error.status === 400 && !!error.details.fieldErrors.url)
  assert.deepEqual(stored, original)
  assert.ok(statements.every(sql => sql.startsWith('SELECT')))
})
test('redirect host is rejected before its DNS lookup/download; approved redirects retain safe-fetch protections', async () => {
  const lookedUp = [], requested = []
  const validateUrl = value => { const error = approvedSourceUrlError(value); if (error) throw Object.assign(new Error(error), { code: 'UNAPPROVED_SOURCE_HOST' }) }
  await assert.rejects(safeFetchSource('https://official.example.edu/reference', { validateUrl, lookup: async host => { lookedUp.push(host); return [{ address: '93.184.216.34', family: 4 }] }, request: async url => { requested.push(url.href); return { redirect: 'https://youtube.com/official.example.edu' } } }), { code: 'UNAPPROVED_SOURCE_HOST' })
  assert.deepEqual(lookedUp, ['official.example.edu']); assert.equal(requested.length, 1)
  let parsed = false
  const result = await checkUnsavedSource('https://official.example.edu/reference', 7, { courseName: course.course_name, fetch: async () => ({ bytes: Buffer.from('untrusted'), type: 'text/html', final_url: 'https://evil.com/reference' }), parse: async () => { parsed = true } })
  assert.equal(parsed, false); assert.equal(result.report.status, 'Needs Review')
  assert.throws(() => confirmUnsavedSource({ source: source(), course, confirmed: true, check_receipt: result.check_receipt }, 7), { status: 400 })
  assert.throws(() => validateSourceBundle([{ ...source(), check_receipt: result.check_receipt }], 7), { status: 400 })
})
test('approved origin alone is not relevance; approved scanned PDFs still allow explicit manual confirmation', async () => {
  const result = await checkUnsavedSource(source().url, 7, { courseName: course.course_name, fetch: async url => ({ bytes: Buffer.from('%PDF-'), type: 'application/pdf', final_url: url }), parse: async () => { throw Object.assign(new Error('No text'), { code: 'PDF_NO_TEXT' }) } })
  assert.equal(result.report.publisher_origin.verified, true); assert.equal(result.report.status, 'Needs Review')
  assert.ok(confirmUnsavedSource({ source: source(), course, confirmed: true, check_receipt: result.check_receipt }, 7).confirmation_receipt)
  const unrelated = await checkUnsavedSource(source().url, 7, { courseName: course.course_name, fetch: async url => ({ bytes: Buffer.from('unrelated'), type: 'text/html', final_url: url }), parse: async () => ({ blocks: [{ text: 'Unrelated reference.', location: 'Section 1' }] }) })
  assert.equal(unrelated.report.status, 'Needs Review')
})
test('HTTP enforcement precedes even an injected checker and exposes empty configuration clearly', async () => {
  let calls = 0
  const app = express(); app.use(express.json()); app.use('/sources', createSourceCheckRouter((req, _res, next) => { req.admin = { role: 'admin', adminId: 7 }; next() }, async () => { calls++; return {} }))
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve))
  try {
    const request = () => fetch(`http://127.0.0.1:${server.address().port}/sources/check`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ course_name: course.course_name, urls: [source().url, 'https://youtube.com/x'] }) })
    assert.equal((await request()).status, 400); assert.equal(calls, 0)
    process.env.SOURCE_APPROVED_PUBLISHER_HOSTS = ''
    const response = await request(); const data = await response.json()
    assert.equal(response.status, 400); assert.match(data.fieldErrors.url, /not configured/); assert.equal(calls, 0)
    assert.match(courseDraftOptions.source_url_policy.error, /not configured/)
    process.env.SOURCE_APPROVED_PUBLISHER_HOSTS = '*.gov.ph'
    assert.match(sourcePublisherConfiguration().error, /configuration is invalid/)
  } finally { process.env.SOURCE_APPROVED_PUBLISHER_HOSTS = 'official.example.edu'; server.closeAllConnections(); await new Promise(resolve => server.close(resolve)) }
})
