import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { transformWithOxc } from 'vite'

test('relationship display uses bold labels and escapes all program names and explanations', async () => {
  const source = await readFile(new URL('../components/admin/SourceAnalysisDetails.jsx', import.meta.url), 'utf8')
  const { code } = await transformWithOxc(source.replace(/^import .*\r?\n/, ''), 'SourceAnalysisDetails.jsx', { jsx: { runtime: 'classic' } })
  const context = vm.createContext({ React: { createElement, Fragment: Symbol.for('react.fragment') }, COURSE_SOURCE_FIELDS: {} })
  const Component = vm.runInContext(code.replace('export default function', 'function') + '\nSourceAnalysisDetails', context)
  const report = { target_course_name: 'BS Criminology <test>', method: 'AI', relationship: { kind: 'Related program only', source_programs: ['BS Forensic Science', '<script>untrusted()</script>'], explanation: 'Related topics <img src=x onerror=bad()> require review.' } }
  const html = renderToStaticMarkup(createElement(Component, { report }))
  for (const label of ['Entered course:', 'Source program(s):', 'Relationship:', 'Explanation:']) assert.ok(html.includes(`<strong>${label}</strong>`))
  assert.match(html, /Related program only/)
  assert.match(html, /BS Forensic Science/)
  assert.match(html, /&lt;script&gt;/)
  assert.match(html, /&lt;img/)
  assert.doesNotMatch(html, /<script>|<img/)
  const previous = renderToStaticMarkup(createElement(Component, { report: { method: 'Basic' } }))
  assert.doesNotMatch(previous, /Relationship:/)
  const failed = renderToStaticMarkup(createElement(Component, { report: { method: 'Basic', fetch_status: 'failed', analysis_completed: false, relationship: report.relationship, analysis_failure: { stage: 'fetch', code: 'TIMEOUT', elapsed_ms: 10005, timeout_ms: 10000, fetch_phase: 'response_body' } } }))
  assert.match(failed, /Analysis not completed/)
  assert.match(failed, /10.0s elapsed; stage limit 10s; fetch phase: response_body/)
  assert.doesNotMatch(failed, /Basic|Relationship:|Related program only/)
  const partial = renderToStaticMarkup(createElement(Component, { report: { method: 'AI', pdf_scope: { partial: true, read_pages: 30, total_pages: 31 } } }))
  assert.match(partial, /Partial PDF review:/)
  assert.match(partial, /Only pages 1–30 of 31 were read. Later pages were not checked./)
})
