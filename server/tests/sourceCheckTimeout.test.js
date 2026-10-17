import test from 'node:test'
import assert from 'node:assert/strict'
import { checkUnsavedSource } from '../services/sourceCheckService.js'
import { safeFetchSource, SourceFetchError, FETCH_LIMITS } from '../services/safeSourceFetchService.js'
import { PARSER_LIMITS } from '../services/sourceTextReading.js'

test('download and parser timeouts are measured, distinctly labeled, and never run later stages', async t => {
  const priorHosts = process.env.SOURCE_APPROVED_PUBLISHER_HOSTS, priorSecret = process.env.JWT_SECRET
  process.env.SOURCE_APPROVED_PUBLISHER_HOSTS = 'ched.gov.ph'
  process.env.JWT_SECRET = 'synthetic-timeout-test-secret'
  t.after(() => {
    if (priorHosts === undefined) delete process.env.SOURCE_APPROVED_PUBLISHER_HOSTS; else process.env.SOURCE_APPROVED_PUBLISHER_HOSTS = priorHosts
    if (priorSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = priorSecret
  })
  const url = 'https://ched.gov.ph/synthetic.pdf'
  const courseName = 'Bachelor of Science in Accountancy'
  for (const stage of ['fetch', 'parse']) {
    let clock = 1000, parses = 0, analyses = 0
    const failures = []
    const result = await checkUnsavedSource(url, 7, {
      courseName, course: { course_name: courseName }, source: { title: 'Synthetic reference', url, notes: '', supported_fields: [] },
      now: () => clock, onFailure: failure => failures.push(failure),
      fetch: async () => {
        if (stage === 'fetch') { clock += 10005; throw new SourceFetchError('TIMEOUT', 'Source checking timed out.', { fetch_phase: 'response_body' }) }
        clock += 500; return { bytes: Buffer.from('%PDF-synthetic'), type: 'application/pdf', final_url: url }
      },
      parse: async () => { parses++; clock += 6002; throw Object.assign(new Error('SECRET_RAW_ERROR'), { code: 'PARSER_TIMEOUT' }) },
      analyze: async () => { analyses++; throw Error('Must not generate') },
    })
    const report = result.report
    assert.equal(report.failure_stage, stage)
    assert.equal(report.method, 'Analysis not completed')
    assert.equal(report.analysis_completed, false)
    assert.equal(report.status, 'Needs Review')
    assert.equal(report.relationship, undefined)
    assert.equal(report.parse_status, stage === 'fetch' ? 'not_attempted' : 'failed')
    assert.equal(report.analysis_failure.elapsed_ms, stage === 'fetch' ? 10005 : 6002)
    assert.equal(report.analysis_failure.timeout_ms, stage === 'fetch' ? FETCH_LIMITS.timeout : PARSER_LIMITS.milliseconds)
    assert.equal(analyses, 0); assert.equal(parses, stage === 'fetch' ? 0 : 1)
    assert.equal(failures.length, 1)
    assert.doesNotMatch(JSON.stringify(failures), /SECRET_RAW_ERROR|synthetic.pdf|Bearer|synthetic-timeout-test-secret/)
    assert.match(report.reasons[0], /AI analysis w(?:as|ere) not started/)
  }
})

test('DNS and download timeout diagnostics share one bounded budget across redirects', async () => {
  let requests = 0
  await assert.rejects(safeFetchSource('https://ched.gov.ph/synthetic', {
    limits: { ...FETCH_LIMITS, timeout: 5 },
    lookup: () => new Promise(() => {}), request: async () => { requests++; throw Error('Must not connect') },
  }), error => {
    assert.equal(error.code, 'TIMEOUT'); assert.equal(error.fetch_phase, 'dns')
    assert.equal(error.timeout_ms, 5); assert.ok(error.elapsed_ms >= 0)
    return true
  })
  assert.equal(requests, 0)
  await assert.rejects(safeFetchSource('https://ched.gov.ph/synthetic', {
    limits: { ...FETCH_LIMITS, timeout: 10 }, lookup: async () => [{ address: '8.8.8.8', family: 4 }],
    request: async () => { requests++; return requests === 1 ? { redirect: '/next' } : new Promise(() => {}) },
  }), error => {
    assert.equal(error.code, 'TIMEOUT'); assert.equal(error.fetch_phase, 'download')
    assert.equal(error.timeout_ms, 10); assert.ok(error.elapsed_ms >= 0)
    return true
  })
  assert.equal(requests, 2)
})
