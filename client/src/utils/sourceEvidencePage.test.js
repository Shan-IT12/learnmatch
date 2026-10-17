import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { sourceEvidencePageUrl } from './sourceEvidencePage.js'
import { SOURCE_CHECK_CLIENT_TIMEOUT_MS, SOURCE_CHECK_DEADLINE_MS, SOURCE_CHECK_PROXY_TIMEOUT_MS } from '../../../shared/sourceCheckTiming.js'

const policy = { hosts: ['ched.gov.ph', 'legacy.ched.gov.ph'] }
test('AI-read page links use approved parsed URLs and bounded integer PDF page references', () => {
  const evidence = { grounding: 'ai_read', pdf_page: 4, url: 'https://legacy.ched.gov.ph/reference.pdf#old' }
  assert.equal(sourceEvidencePageUrl(evidence, policy), 'https://legacy.ched.gov.ph/reference.pdf#page=4')
  for (const pdf_page of [0, -1, 31, 2.5, '2', undefined]) assert.equal(sourceEvidencePageUrl({ ...evidence, pdf_page }, policy), null)
  for (const url of [undefined, '', 'javascript:alert(1)', 'https://ched.com.nz', 'https://ched.gov.ph.fake-site.com', 'https://fake-site.com/ched.gov.ph', 'https://user:secret@ched.gov.ph/ref.pdf', 'http://localhost/test.pdf']) assert.equal(sourceEvidencePageUrl({ ...evidence, url }, policy), null)
  assert.equal(sourceEvidencePageUrl(evidence, { hosts: [] }), null)
  assert.equal(sourceEvidencePageUrl({ ...evidence, grounding: 'text_verified' }, policy), null)
})
test('UI safely distinguishes AI-read facts from text-verified passages and links pages without autofill', async () => {
  const [details, excerpts, editor, saved, proxy] = await Promise.all([
    '../components/admin/SourceAnalysisDetails.jsx', '../components/admin/SourceEvidenceExcerpts.jsx',
    '../components/admin/SourceFirstDraftSources.jsx', '../components/admin/DraftCourseSources.jsx', '../../vite.config.js',
  ].map(path => readFile(new URL(path, import.meta.url), 'utf8')))
  assert.match(details, /not independently text-verified/)
  assert.match(details, /Inference only/)
  for (const label of ['Entered course:', 'Source program(s):', 'Relationship:', 'Explanation:']) assert.ok(details.includes(`<strong>${label}</strong>`))
  assert.match(details, /Failure stage:/)
  assert.match(details, /report.analysis_failure.stage/)
  assert.match(details, /report.analysis_failure.code/)
  assert.match(excerpts, /AI-read excerpt — verify manually/)
  assert.match(excerpts, /Open cited PDF page/)
  assert.match(excerpts, /rel="noopener noreferrer"/)
  assert.doesNotMatch(details + excerpts, /dangerouslySetInnerHTML|innerHTML|setCourseForm|Apply Details/)
  const progress = await readFile(new URL('../components/admin/SourceCheckProgress.jsx', import.meta.url), 'utf8')
  assert.match(progress, /role="status" aria-live="polite"/)
  assert.match(editor, /checking && <SourceCheckProgress/)
  assert.match(editor, /SOURCE_CHECK_CLIENT_TIMEOUT_MS/)
  assert.match(saved, /SourceEvidenceExcerpts report=\{check.report\}/)
  assert.match(proxy, /proxyTimeout: SOURCE_CHECK_PROXY_TIMEOUT_MS/)
  assert.ok(SOURCE_CHECK_DEADLINE_MS >= 3 * (10000 + 6000 + 15000 + 60000))
  assert.ok(SOURCE_CHECK_CLIENT_TIMEOUT_MS > SOURCE_CHECK_DEADLINE_MS)
  assert.ok(SOURCE_CHECK_PROXY_TIMEOUT_MS > SOURCE_CHECK_CLIENT_TIMEOUT_MS)
})
