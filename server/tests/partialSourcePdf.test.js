import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { PDFDocument } from 'pdf-lib'
import { parseSourceContent } from '../services/sourceParserService.js'
import { createSourceAnalyzer, sourceAiConfiguration } from '../services/sourceAiAnalysisService.js'
import { checkUnsavedSource } from '../services/sourceCheckService.js'
import { detectCourseSupport } from '../services/sourceDetectionService.js'
import { sourceAnalysisFields } from '../../shared/pendingSourceReview.js'

const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex')
async function fixture(readable) {
  const document = await PDFDocument.create()
  for (let i = 0; i < 31; i++) {
    const page = document.addPage([600, 700 + i])
    if (readable) page.drawText(i === 30 ? 'Bachelor of Science in Accountancy. PAGE31_ONLY_TARGET. Students study accounting.' : `Synthetic reference page ${i + 1}. General document information.`, { x: 20, y: 650, size: 10 })
  }
  return Buffer.from(await document.save())
}

test('source checking reads the first 30 text pages and cannot use a target found only on page 31', async () => {
  const bytes = await fixture(true)
  const parsed = await parseSourceContent(bytes, 'application/pdf', { allowPartialPdf: true, allowScannedPdf: true })
  assert.equal(parsed.pdf.pages, 30); assert.equal(parsed.pdf.total_pages, 31); assert.equal(parsed.pdf.partial, true)
  assert.equal(parsed.pdf.readable_text, true)
  assert.ok(parsed.blocks.some(block => block.location.startsWith('PDF page 30,')))
  assert.doesNotMatch(JSON.stringify(parsed.blocks), /PAGE31_ONLY_TARGET|Accountancy|PDF page 31,/)
  assert.equal(parsed.pdf_input_bytes, undefined)
  const result = detectCourseSupport(parsed, 'Bachelor of Science in Accountancy', 'https://ched.gov.ph/test')
  assert.equal(result.status, 'Needs Review'); assert.equal(result.relationship.kind, 'Insufficient evidence')
  await assert.rejects(parseSourceContent(bytes, 'application/pdf'), { code: 'PDF_PAGE_LIMIT' })
})

test('long scans submit only a bounded 30-page PDF and disclose partial review without retaining binary evidence', async t => {
  const priorHosts = process.env.SOURCE_APPROVED_PUBLISHER_HOSTS, priorSecret = process.env.JWT_SECRET
  process.env.SOURCE_APPROVED_PUBLISHER_HOSTS = 'ched.gov.ph'; process.env.JWT_SECRET = 'partial-pdf-test-only'
  t.after(() => {
    if (priorHosts === undefined) delete process.env.SOURCE_APPROVED_PUBLISHER_HOSTS; else process.env.SOURCE_APPROVED_PUBLISHER_HOSTS = priorHosts
    if (priorSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = priorSecret
  })
  const bytes = await fixture(false), url = 'https://ched.gov.ph/synthetic.pdf'
  const source = { title: 'Synthetic scanned reference', url, notes: '', supported_fields: [] }
  const course = { course_name: 'Bachelor of Science in Accountancy' }
  let calls = 0
  const config = sourceAiConfiguration({ SOURCE_AI_ENABLED: 'true', OPENAI_API_KEY: 'mock-not-real' })
  const analyze = createSourceAnalyzer({ fetchImpl: async (endpoint, options) => {
    calls++
    const body = JSON.parse(options.body)
    const input = Buffer.from(body.input[0].content[0].file_data.split(',')[1], 'base64')
    assert.notEqual(sha(input), sha(bytes))
    const document = await PDFDocument.load(input)
    assert.equal(document.getPageCount(), 30)
    assert.equal(document.getPage(29).getHeight(), 729)
    assert.equal(body.text.format.schema.properties.claims.items.properties.excerpts.items.properties.pdf_page.maximum, 30)
    assert.match(body.input[0].content[1].text, /Only the first pages were supplied/)
    const data = endpoint.endsWith('/input_tokens') ? { object: 'response.input_tokens', input_tokens: 50000 } : {
      status: 'completed', output_text: JSON.stringify({ status: 'Needs Review', reason: 'The reviewed pages do not establish the target.',
        relationship: { kind: 'Insufficient evidence', source_programs: [], explanation: 'No target program was established in the supplied pages.', excerpts: [] },
        claims: sourceAnalysisFields(source).map(field => ({ field, support: 'unresolved', explanation: 'Not established in the supplied pages.', excerpts: [] })), manual_review: ['Later pages were not reviewed.'] }),
    }
    return new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json' } })
  } })
  const options = { courseName: course.course_name, course, source,
    fetch: async () => ({ bytes, type: 'application/pdf', final_url: url }),
    analyze: args => analyze({ ...args, config }),
  }
  const result = await checkUnsavedSource(url, 7, options)
  assert.equal(calls, 2); assert.equal(result.report.method, 'AI')
  assert.deepEqual(result.report.pdf_scope, { total_pages: 31, read_pages: 30, partial: true })
  assert.equal(result.report.content_sha256, sha(bytes))
  assert.match(result.report.coverage[0], /Later pages were not checked/)
  assert.doesNotMatch(JSON.stringify(result.report), /pdf_input_bytes|file_data|data:application/)
  const repeated = await checkUnsavedSource(url, 7, options)
  assert.equal(repeated.report.cache_reused, true)
  assert.equal(calls, 2)
})

test('a partial scan without its verified page subset never makes an API request', async () => {
  const bytes = Buffer.from('%PDF-synthetic')
  const analyze = createSourceAnalyzer({ fetchImpl: () => { throw Error('Must not call API') } })
  const report = await analyze({ parsed: { blocks: [], pdf: { confirmed: true, readable_text: false, pages: 30, total_pages: 31, partial: true, source_sha256: sha(bytes) } }, pdfBytes: bytes,
    courseName: 'Synthetic course', url: 'https://ched.gov.ph/test', source: { supported_fields: [] }, contentHash: sha(bytes), config: sourceAiConfiguration({ SOURCE_AI_ENABLED: 'true', OPENAI_API_KEY: 'mock-only' }) })
  assert.equal(report.analysis_completed, false)
  assert.match(report.analysis_notice, /page subset is unavailable or invalid/)
})
