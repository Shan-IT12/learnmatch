import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { createSourceAnalyzer, sourceAiConfiguration } from '../services/sourceAiAnalysisService.js'
import { checkUnsavedSource, confirmUnsavedSource } from '../services/sourceCheckService.js'
import { sourceAnalysisFields } from '../../shared/pendingSourceReview.js'
import { SOURCE_REVIEW_INSTRUCTIONS } from '../services/sourceAnalysisPrompt.js'

const name = 'Bachelor of Science in Example Studies'
const source = { title: 'Synthetic test reference', url: 'https://ched.gov.ph/scan', supported_fields: ['course_name'], notes: 'Test fixture only' }
const bytes = Buffer.from('%PDF-synthetic-fixture-not-a-real-catalog-document')
const hash = crypto.createHash('sha256').update(bytes).digest('hex')
const config = () => sourceAiConfiguration({ SOURCE_AI_ENABLED: 'true', OPENAI_API_KEY: 'mock-only-key' })
const input = () => ({ parsed: { blocks: [], pdf: { confirmed: true, pages: 19, readable_text: false } }, pdfBytes: bytes, courseName: name, url: source.url, source, contentHash: hash, contextHash: 'revision-one', config: config() })
const result = (overrides = {}) => ({ status: 'Potential Match', reason: 'AI-read passages identify the target and program details.',
  relationship: { kind: 'Same/equivalent program', source_programs: [name], explanation: 'The scan identifies the entered program.', excerpts: [{ text: `${name}. Students study research methods in this program.`, pdf_page: 2 }] },
  claims: sourceAnalysisFields(source).map(field => ({ field, support: ['course_name', 'description'].includes(field) ? 'direct' : 'unresolved',
    explanation: field === 'course_name' ? 'The scanned program name identifies the target.' : field === 'description' ? 'The program addresses research methods.' : 'Not established by the AI-read evidence.',
    excerpts: ['course_name', 'description'].includes(field) ? [{ text: `${name}. Students study research methods in this program.`, pdf_page: 2 }] : [] })),
  manual_review: ['Check the sample duration plan and any conflicting curriculum statements manually.'], ...overrides })
const json = value => new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } })
const completed = analysis => json({ status: 'completed', output_text: JSON.stringify(analysis), usage: { input_tokens: 10000, input_tokens_details: { cached_tokens: 8000, cache_write_tokens: 0 }, output_tokens: 900, output_tokens_details: { reasoning_tokens: 200 } } })
function transport(analysis = result(), tokenCount = 10000) {
  const calls = []
  return { calls, fetchImpl: async (url, options) => {
    calls.push({ url, body: JSON.parse(options.body), signal: options.signal })
    if (url.endsWith('/input_tokens')) return json({ object: 'response.input_tokens', input_tokens: tokenCount })
    assert.equal(url, 'https://api.openai.com/v1/responses')
    assert.equal(options.redirect, 'error')
    return completed(analysis)
  } }
}

test('REST message output matches inline diagnostic transport and requested schema matches local evidence minimums', async () => {
  const analyze = createSourceAnalyzer({ fetchImpl: async (url, options) => {
    const body = JSON.parse(options.body)
    const schema = body.text.format.schema
    assert.equal(schema.properties.claims.minItems, 4)
    assert.equal(schema.properties.claims.maxItems, 4)
    assert.equal(schema.properties.claims.items.properties.excerpts.items.properties.text.minLength, 15)
    if (url.endsWith('/input_tokens')) return json({ object: 'response.input_tokens', input_tokens: 57184 })
    assert.equal(body.input[0].content[0].detail, 'high')
    assert.match(body.input[0].content[0].file_data, /^data:application\/pdf;base64,/)
    return json({ status: 'completed', output: [{ type: 'reasoning', summary: [] }, { type: 'message', content: [{ type: 'output_text', text: JSON.stringify(result()) }] }] })
  } })
  assert.equal((await analyze(input())).method, 'AI')
})

test('post-preflight failures expose their exact safe stage, preserve usage and never retry', async () => {
  const short = result(); short.claims[0].excerpts[0].text = 'FOURTH YEAR'
  const page = result(); page.claims[0].excerpts[0].pdf_page = 20
  const fixtures = [
    { response: new Response(JSON.stringify({ error: { code: 'invalid_json_schema', param: 'text.format.schema', message: 'SECRET_DOCUMENT_AND_CREDENTIAL_MARKER' } }), { status: 400, headers: { 'content-type': 'application/json', 'x-request-id': 'req_fixture' } }), stage: 'generation', code: 'PROVIDER_HTTP_ERROR' },
    { response: json({ status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' }, usage: { input_tokens: 57184, output_tokens: 1800, output_tokens_details: { reasoning_tokens: 700 } } }), stage: 'response_status', code: 'INCOMPLETE_RESPONSE' },
    { response: completed(short), stage: 'evidence_validation', code: 'SCHEMA_VALIDATION' },
    { response: completed(page), stage: 'evidence_validation', code: 'PAGE_VALIDATION' },
    { response: json({ status: 'completed', output_text: '{broken' }), stage: 'output_json', code: 'OUTPUT_JSON' },
    { response: json({ status: 'completed', output: 'invalid' }), stage: 'response_status', code: 'RESPONSE_SHAPE' },
    { response: new Response('<html>SECRET_DOCUMENT_AND_CREDENTIAL_MARKER</html>', { headers: { 'content-type': 'text/html' } }), stage: 'response_body', code: 'RESPONSE_CONTENT_TYPE' },
  ]
  for (const fixture of fixtures) {
    let calls = 0
    const logs = []
    const analyze = createSourceAnalyzer({ onFailure: failure => logs.push(failure), fetchImpl: async url => {
      calls++
      return url.endsWith('/input_tokens') ? json({ object: 'response.input_tokens', input_tokens: 57184 }) : fixture.response
    } })
    const report = await analyze(input())
    assert.equal(calls, 2)
    assert.equal(report.status, 'Needs Review'); assert.equal(report.method, 'Analysis not completed')
    assert.equal(report.analysis_failure.stage, fixture.stage); assert.equal(report.analysis_failure.code, fixture.code)
    assert.equal(report.analysis_failure.preflight_input_tokens, 57184)
    assert.equal(logs.length, 1)
    assert.doesNotMatch(JSON.stringify({ report, logs }), /SECRET_DOCUMENT_AND_CREDENTIAL_MARKER|mock-only-key|data:application/)
    if (fixture.code === 'INCOMPLETE_RESPONSE') {
      assert.equal(report.usage.reported.output_tokens, 1800)
      assert.equal(report.usage.reported.reasoning_tokens, 700)
      assert.match(report.analysis_notice, /including reasoning/)
    }
    if (fixture.code === 'PROVIDER_HTTP_ERROR') {
      assert.equal(report.analysis_failure.http_status, 400)
      assert.equal(report.analysis_failure.provider_code, 'invalid_json_schema')
      assert.equal(report.analysis_failure.provider_param, 'text.format.schema')
      assert.equal(report.analysis_failure.request_id, 'req_fixture')
    }
  }
})

test('PDF input budget is separate; download/page/text limits and disabled default are preserved', () => {
  const defaults = sourceAiConfiguration({})
  assert.equal(defaults.pdfTimeoutMs, 60000); assert.equal(defaults.pdfMaxOutputTokens, 1800)
  assert.equal(defaults.maxInputTokens, 12000); assert.equal(defaults.timeoutMs, 12000); assert.equal(defaults.enabled, false)
  assert.equal(defaults.pdfMaxInputTokens, 65000)
  for (const env of [{ SOURCE_AI_PDF_TIMEOUT_MS: '60001' }, { SOURCE_AI_PDF_MAX_OUTPUT_TOKENS: '1801' }, { SOURCE_AI_MAX_INPUT_TOKENS: '57184' }, { SOURCE_AI_PDF_MAX_INPUT_TOKENS: '65001' }, { SOURCE_AI_PDF_MAX_INPUT_TOKENS: '999' }, { SOURCE_AI_PDF_MAX_INPUT_TOKENS: '65000.5' }]) assert.throws(() => sourceAiConfiguration(env))
})

test('scanned PDFs use inline high-detail input, tested model/settings, bounded structured AI-read evidence', async () => {
  const mock = transport(), analyze = createSourceAnalyzer(mock)
  const value = await analyze(input())
  assert.equal(value.status, 'Potential Match'); assert.equal(value.method, 'AI'); assert.equal(value.reading_method, 'pdf_vision')
  assert.equal(mock.calls.length, 2)
  const request = mock.calls[1].body
  assert.equal(request.model, 'gpt-6-luna'); assert.equal(request.reasoning.effort, 'low'); assert.equal(request.max_output_tokens, 1800)
  assert.equal(request.store, false); assert.ok(request.instructions.startsWith(SOURCE_REVIEW_INSTRUCTIONS))
  assert.match(request.instructions, /duration\/year structure/); assert.match(request.instructions, /never imply complete coverage/)
  const file = request.input[0].content[0]
  assert.equal(file.type, 'input_file'); assert.equal(file.detail, 'high'); assert.equal(file.file_data, `data:application/pdf;base64,${bytes.toString('base64')}`)
  assert.equal(Object.hasOwn(file, 'file_id'), false)
  assert.equal(value.evidence_grounding, 'ai_read'); assert.equal(value.excerpts[0].pdf_page, 2)
  assert.match(value.coverage[0], /not quotation accuracy/)
  assert.equal(value.usage.preflight_input_tokens, 10000)
  assert.equal(value.usage.reported.cached_input_tokens, 8000); assert.equal(value.usage.reported.reasoning_tokens, 200)
  assert.equal(value.usage.estimated_cost_usd, undefined)
  assert.deepEqual(value.claims.map(c => c.field), sourceAnalysisFields(source))
})

test('over-budget PDF is blocked before generation, with no retry', async () => {
  const mock = transport(result(), 65001)
  const value = await createSourceAnalyzer(mock)(input())
  assert.equal(mock.calls.length, 1); assert.ok(mock.calls[0].url.endsWith('/input_tokens'))
  assert.equal(value.status, 'Needs Review'); assert.equal(value.reading_method, 'manual_required')
  assert.match(value.analysis_notice, /65001.*65000/); assert.equal(value.usage.reported, null)
})

test('PDF preflight boundaries include all request context and accept the CHED-size count', async () => {
  for (const tokens of [57184, 64999, 65000, 65001]) {
    const mock = transport(result(), tokens)
    const value = await createSourceAnalyzer(mock)(input())
    const counted = mock.calls[0].body
    assert.equal(counted.instructions.startsWith(SOURCE_REVIEW_INSTRUCTIONS), true)
    assert.equal(counted.text.format.type, 'json_schema')
    assert.equal(counted.input[0].content[0].detail, 'high')
    assert.match(counted.input[0].content[1].text, /target_course.*selected_fields.*entered_details_for_comparison/)
    assert.equal(mock.calls.length, tokens <= 65000 ? 2 : 1)
    assert.equal(value.method, tokens <= 65000 ? 'AI' : 'Analysis not completed')
    assert.equal(value.usage.preflight_input_tokens, tokens)
  }
})

test('text retains its 12,000-token budget independently of the 65,000-token PDF budget', async () => {
  const facts = { description: 'x'.repeat(13000) }
  const mock = transport(), analyze = createSourceAnalyzer(mock)
  const text = await analyze({ ...input(), courseFacts: facts, parsed: { blocks: [{ text: `${name}. Students study research methods.`, location: 'Webpage block 1' }] } })
  assert.match(text.analysis_notice, /input limit reached/); assert.equal(mock.calls.length, 0)
  const pdf = await analyze({ ...input(), courseFacts: facts })
  assert.equal(pdf.method, 'AI'); assert.equal(mock.calls.length, 2)
  assert.match(mock.calls[0].body.input[0].content[1].text, /entered_details_for_comparison/)
  const tighter = transport(result(), 12001)
  const value = await createSourceAnalyzer(tighter)({ ...input(), config: { ...config(), pdfMaxInputTokens: 12000 } })
  assert.equal(value.status, 'Needs Review'); assert.equal(tighter.calls.length, 1)
})

test('disabled/missing credentials, unconfirmed/no-text webpages, oversized/invalid PDFs never invoke AI', async () => {
  for (const patch of [
    { config: { ...config(), enabled: false } }, { config: { ...config(), apiKey: undefined } },
    { parsed: { blocks: [] } }, { parsed: { blocks: [], pdf: { confirmed: false, readable_text: false, pages: 19 } } },
    { pdfBytes: Buffer.alloc(7 * 1024 * 1024) }, { pdfBytes: Buffer.from('not PDF') },
    { contentHash: 'mismatch' }, { parsed: { blocks: [], pdf: { confirmed: true, readable_text: false, pages: 31 } } },
  ]) {
    const mock = transport(); const value = await createSourceAnalyzer(mock)({ ...input(), ...patch })
    assert.equal(value.status, 'Needs Review'); assert.equal(mock.calls.length, 0)
  }
})

test('readable PDFs and webpages always retain the extracted-text path without file input or counting', async () => {
  for (const metadata of [undefined, { confirmed: true, pages: 19, readable_text: true }]) {
    let calls = 0
    const parsed = { blocks: [{ text: `${name}. Students study research methods.`, location: metadata ? 'PDF page 1, line 1' : 'Webpage block 1' }], pdf: metadata }
    const analyze = createSourceAnalyzer({ fetchImpl: async (url, options) => {
      calls++; assert.equal(url, 'https://api.openai.com/v1/responses')
      const request = JSON.parse(options.body); assert.equal(typeof request.input, 'string')
      assert.doesNotMatch(request.input, /file_data|data:application\/pdf/)
      return json({ status: 'completed', output_text: JSON.stringify(result({ status: 'Needs Review', relationship: { kind: 'Insufficient evidence', source_programs: [], explanation: 'Target details require review.', excerpts: [] }, claims: result().claims.map(c => ({ ...c, support: 'unresolved', excerpts: [] })) })) })
    } })
    const value = await analyze({ ...input(), parsed })
    assert.equal(value.reading_method, 'extracted_text'); assert.equal(value.method, 'AI'); assert.equal(calls, 1)
  }
})

test('invalid count, unavailable/refused/incomplete output, and impossible page references require manual review', async () => {
  const badPage = result(); badPage.claims[0].excerpts[0].pdf_page = 20
  const floatPage = result(); floatPage.claims[0].excerpts[0].pdf_page = 1.5
  const extra = result(); extra.claims[0].weight = 3
  for (const response of [completed(badPage), completed(floatPage), completed(extra),
    json({ status: 'incomplete', usage: { input_tokens: 10000, output_tokens: 1800 }, incomplete_details: { reason: 'max_output_tokens' } }),
    json({ status: 'completed', output: [{ content: [{ type: 'refusal' }] }] }), new Response('<html>error</html>', { status: 503 }),
  ]) {
    let calls = 0
    const analyze = createSourceAnalyzer({ fetchImpl: async url => { calls++; return url.endsWith('/input_tokens') ? json({ object: 'response.input_tokens', input_tokens: 10000 }) : response } })
    const value = await analyze(input())
    assert.equal(value.status, 'Needs Review'); assert.equal(value.method, 'Analysis not completed'); assert.equal(calls, 2)
    assert.match(value.reasons.join(' '), /review it manually/)
  }
  let calls = 0
  const value = await createSourceAnalyzer({ fetchImpl: async () => { calls++; return json({ input_tokens: 'unknown' }) } })(input())
  assert.equal(calls, 1); assert.equal(value.analysis_failure.code, 'TOKEN_COUNT_INVALID'); assert.equal(value.analysis_failure.stage, 'token_count')
  assert.equal(value.analysis_failure.timeout_ms, 15000)
  assert.equal(value.analysis_completed, false)
  assert.equal(value.relationship, undefined)
})

test('valid unrelated finding is retained as AI, without Basic fallback or another call', async () => {
  const unrelated = result({ status: 'Needs Review', reason: 'The scan describes another program.' })
  unrelated.claims = unrelated.claims.map(c => ({ ...c, support: 'unresolved', excerpts: [] }))
  const mock = transport(unrelated), value = await createSourceAnalyzer(mock)(input())
  assert.equal(value.status, 'Needs Review'); assert.equal(value.method, 'AI'); assert.equal(mock.calls.length, 2)
})

test('preflight and PDF generation timeout reports use their own elapsed time and effective deadline', async () => {
  for (const failAt of ['token_count', 'generation']) {
    let clock = 1000, calls = 0
    const value = await createSourceAnalyzer({ now: () => clock, onFailure: () => {}, fetchImpl: async url => {
      calls++
      if (url.endsWith('/input_tokens') && failAt === 'generation') { clock += 200; return json({ object: 'response.input_tokens', input_tokens: 57184 }) }
      clock += failAt === 'token_count' ? 15001 : 60001
      throw new DOMException('SECRET_RAW_TIMEOUT', 'TimeoutError')
    } })(input())
    assert.equal(value.method, 'Analysis not completed')
    assert.equal(value.analysis_failure.stage, failAt)
    assert.equal(value.analysis_failure.code, 'TIMEOUT')
    assert.equal(value.analysis_failure.timeout_ms, failAt === 'token_count' ? 15000 : 60000)
    assert.equal(value.analysis_failure.elapsed_ms, failAt === 'token_count' ? 15001 : 60001)
    assert.equal(calls, failAt === 'token_count' ? 1 : 2)
    assert.equal(value.relationship, undefined)
    assert.doesNotMatch(JSON.stringify(value), /SECRET_RAW_TIMEOUT/)
  }
})

test('inference cannot stand in for direct identity; in-range transcriptions are explicitly AI-read, not text-verified', async () => {
  const inferred = result(); inferred.claims[0].support = 'inference'
  const value = await createSourceAnalyzer(transport(inferred))(input())
  assert.equal(value.status, 'Needs Review'); assert.equal(value.method, 'AI')
  const transcription = result(); transcription.claims[0].excerpts[0].text += ' Unverified transcription.'
  const readable = await createSourceAnalyzer(transport(transcription))(input())
  assert.equal(readable.evidence_grounding, 'ai_read')
  assert.ok(readable.excerpts.every(e => e.grounding === 'ai_read'))
})

test('shared concurrency/duplicate controls include counting and release on timeout/cancellation', async () => {
  let finish, calls = 0
  const analyze = createSourceAnalyzer({ fetchImpl: async url => {
    calls++
    if (url.endsWith('/input_tokens')) { await new Promise(resolve => { finish = resolve }); return json({ object: 'response.input_tokens', input_tokens: 10000 }) }
    return completed(result())
  } })
  const first = analyze(input())
  assert.match((await analyze(input())).analysis_notice, /duplicate/)
  assert.match((await analyze({ ...input(), contextHash: 'other' })).analysis_notice, /concurrency/)
  finish(); assert.equal((await first).method, 'AI'); assert.equal(calls, 2)
  assert.equal((await analyze(input())).cache_reused, true); assert.equal(calls, 2)
  const cancellation = new AbortController()
  let cancels = 0
  const cancelAnalyze = createSourceAnalyzer({ fetchImpl: async (url, options) => {
    if (url.endsWith('/input_tokens')) return json({ object: 'response.input_tokens', input_tokens: 10000 })
    return new Promise((resolve, reject) => options.signal.addEventListener('abort', () => { cancels++; reject(Error('canceled')) }, { once: true }))
  } })
  const pending = cancelAnalyze({ ...input(), signal: cancellation.signal }); setTimeout(() => cancellation.abort(), 10)
  await assert.rejects(pending, { name: 'AbortError' }); assert.equal(cancels, 1)
  const timed = await cancelAnalyze({ ...input(), config: { ...config(), pdfTimeoutMs: 10 } })
  assert.equal(timed.status, 'Needs Review'); assert.match(timed.analysis_notice, /timed out/); assert.equal(cancels, 2)
})

test('reported cache pricing counts reasoning only once, without guaranteed cache/cost', async () => {
  const value = await createSourceAnalyzer(transport())({ ...input(), config: { ...config(), inputPrice: '0.1', cachedInputPrice: '0.01', cacheWritePrice: '0.125', outputPrice: '0.5' } })
  assert.equal(value.usage.reported.output_tokens, 900)
  assert.ok(Math.abs(value.usage.estimated_cost_usd - 0.00073) < 1e-10)
  assert.match(value.usage.cost_basis, /not billed charges/)
})

test('scanned analysis cache invalidates content, claims, relevant context and input budget', async () => {
  const mock = transport(), analyze = createSourceAnalyzer(mock)
  await analyze(input())
  const cached = await analyze(input()); assert.equal(cached.cache_reused, true); assert.equal(cached.usage.reported, null)
  for (const patch of [
    { contextHash: 'revised' }, { source: { ...source, supported_fields: ['description'] } },
    { config: { ...config(), pdfMaxInputTokens: 11000 } },
    { pdfBytes: Buffer.concat([bytes, Buffer.from('changed')]), contentHash: crypto.createHash('sha256').update(Buffer.concat([bytes, Buffer.from('changed')])).digest('hex') },
  ]) assert.equal((await analyze({ ...input(), ...patch })).cache_reused, false)
  assert.equal(mock.calls.length, 10)
})

test('checking uses PDF bytes rather than URL suffix, preserves signed review attribution and invalidation', async () => {
  const prior = { hosts: process.env.SOURCE_APPROVED_PUBLISHER_HOSTS, secret: process.env.JWT_SECRET }
  process.env.SOURCE_APPROVED_PUBLISHER_HOSTS = 'ched.gov.ph'; process.env.JWT_SECRET = 'fixture-only-secret'
  try {
    const mock = transport(), analyze = createSourceAnalyzer(mock)
    const course = { course_name: name, description: 'Manual description' }
    const opts = { courseName: name, course, source, fetch: async () => ({ bytes, type: 'text/html', final_url: source.url }),
      parse: async (value, type, options) => { assert.equal(type, 'application/pdf'); assert.equal(options.allowScannedPdf, true); assert.equal(value, bytes); return input().parsed },
      analyze: args => analyze({ ...args, config: config() }) }
    const checked = await checkUnsavedSource(source.url, 7, opts)
    assert.equal(checked.report.reading_method, 'pdf_vision')
    assert.ok(confirmUnsavedSource({ source, course, confirmed: true, check_receipt: checked.check_receipt }, 7).confirmation_receipt)
    assert.throws(() => confirmUnsavedSource({ source, course: { ...course, description: 'Changed even though not selected for manual confirmation' }, confirmed: true, check_receipt: checked.check_receipt }, 7), { status: 409 })
    assert.throws(() => confirmUnsavedSource({ source, course, confirmed: true, check_receipt: checked.check_receipt }, 8), { status: 409 })
    assert.equal(mock.calls.length, 2)
    for (const url of ['https://ched.com.nz', 'https://ched.gov.ph.fake-site.com', 'https://fake-site.com/ched.gov.ph']) await assert.rejects(checkUnsavedSource(url, 7, opts), { status: 400 })
    assert.equal(mock.calls.length, 2)
  } finally {
    if (prior.hosts === undefined) delete process.env.SOURCE_APPROVED_PUBLISHER_HOSTS; else process.env.SOURCE_APPROVED_PUBLISHER_HOSTS = prior.hosts
    if (prior.secret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = prior.secret
  }
})
