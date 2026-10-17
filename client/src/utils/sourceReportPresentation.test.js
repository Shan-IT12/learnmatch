import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

test('source summaries retain important warnings once and details stay behind mounted disclosures', async t => {
  const server = await createServer({ configFile: false, root: fileURLToPath(new URL('../../', import.meta.url)), server: { middlewareMode: true, watch: null }, appType: 'custom', plugins: [react()], logLevel: 'silent' })
  t.after(() => server.close())
  const { default: Report } = await server.ssrLoadModule('/src/components/admin/SourceCheckReport.jsx')
  const report = {
    status: 'Needs Review', method: 'AI', reasons: ['BRIEF_SENTINEL', 'BRIEF_SENTINEL'],
    manual_review: ['MANUAL_SENTINEL', 'MANUAL_SENTINEL'], coverage: ['MANUAL_SENTINEL', 'COVERAGE_SENTINEL'],
    analysis_notice: 'NOTICE_SENTINEL', target_course_name: 'Keep course',
    excerpts: [{ text: 'EXCERPT_SENTINEL', grounding: 'ai_read', pdf_page: 2, location: 'PDF page 2', url: 'https://ched.gov.ph/reference.pdf' }],
    usage: { reported: { input_tokens: 57184, output_tokens: 948 } },
  }
  const snapshot = structuredClone(report)
  const priorFetch = globalThis.fetch
  let calls = 0
  globalThis.fetch = () => { calls++; throw Error('Presentation must not fetch') }
  t.after(() => { globalThis.fetch = priorFetch })
  const summary = renderToStaticMarkup(createElement(Report, { report, summaryOnly: true }))
  for (const text of ['BRIEF_SENTINEL', 'MANUAL_SENTINEL', 'NOTICE_SENTINEL']) assert.equal(summary.split(text).length - 1, 1)
  assert.doesNotMatch(summary, /EXCERPT_SENTINEL|COVERAGE_SENTINEL|57184|hidden=/)
  const details = renderToStaticMarkup(createElement(Report, { report, detailsOnly: true, sourceUrlPolicy: { hosts: ['ched.gov.ph'] } }))
  assert.match(details, /Show results/)
  assert.match(details, /View coverage limitations/)
  assert.match(details, /View technical diagnostics/)
  assert.match(details, /aria-expanded="false"/)
  assert.match(details, /hidden=""/)
  assert.match(details, /EXCERPT_SENTINEL/)
  assert.match(details, /https:\/\/ched.gov.ph\/reference.pdf#page=2/)
  assert.match(details, /57184/)
  assert.doesNotMatch(details, /MANUAL_SENTINEL|NOTICE_SENTINEL/)
  assert.deepEqual(report, snapshot)
  assert.equal(calls, 0)
})
