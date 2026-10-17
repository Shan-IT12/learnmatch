import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'
import { createElement } from 'react'
import { transformWithOxc } from 'vite'

test('results toggle preserves mounted analysis, page links and usage without another request', async () => {
  const source = await readFile(new URL('../components/admin/SourceCheckResults.jsx', import.meta.url), 'utf8')
  const { code } = await transformWithOxc(source.replace("import { useId, useState } from 'react'", ''), 'SourceCheckResults.jsx', { jsx: { runtime: 'classic' } })
  // Exercise the actual component handlers with persistent hook state. No browser,
  // network, database, or extra test-renderer dependency is required.
  let expanded = true, requests = 0
  const context = vm.createContext({
    React: { createElement },
    useId: () => 'source-result-test',
    useState: () => [expanded, update => { expanded = update(expanded) }],
    fetch: () => { requests++; throw new Error('Toggling must not fetch') },
  })
  const Component = vm.runInContext(code.replace('export default function', 'function') + '\nSourceCheckResults', context)
  const report = { status: 'Potential Match', method: 'AI', claims: [{ explanation: 'Supported test detail' }], excerpts: [{ text: 'Synthetic supporting passage', pdf_page: 2 }], usage: { reported: { input_tokens: 57184, output_tokens: 948, reasoning_tokens: 284 } } }
  const initial = structuredClone(report)
  const children = [createElement('p', { key: 'analysis' }, report.claims[0].explanation), createElement('a', { key: 'page', href: 'https://ched.gov.ph/reference.pdf#page=2' }, report.excerpts[0].text), createElement('pre', { key: 'usage' }, JSON.stringify(report.usage))]
  const render = () => Component({ children })
  let tree = render()
  const originalChildren = tree.props.children[1].props.children
  for (const expected of [false, true]) {
    tree.props.children[0].props.onClick()
    tree = render()
    const [button, panel] = tree.props.children
    assert.equal(button.props.type, 'button')
    assert.equal(button.props['aria-expanded'], expected)
    assert.equal(button.props.children, expected ? 'Hide results' : 'Show results')
    assert.equal(button.props['aria-controls'], panel.props.id)
    assert.equal(panel.props.hidden, !expected)
    assert.equal(panel.props.children, originalChildren)
    assert.deepEqual(report, initial)
    assert.equal(requests, 0)
  }
})

test('new and reopened draft results share the visibility-only panel', async () => {
  const editor = await readFile(new URL('../components/admin/SourceFirstDraftSources.jsx', import.meta.url), 'utf8')
  assert.match(editor, /source.report && <SourceCheckResults>/)
  assert.match(editor, /visibleSourceReport\(source\) && <SourceCheckReport/)
  const report = await readFile(new URL('../components/admin/SourceCheckReport.jsx', import.meta.url), 'utf8')
  assert.match(report, /Previous analysis: Information supported changed/)
  const panel = await readFile(new URL('../components/admin/SourceCheckResults.jsx', import.meta.url), 'utf8')
  assert.doesNotMatch(panel, /fetch\(|setSources|setConfirmation|check_receipt|onWorkingChange/)
  assert.match(panel, /hidden=\{!expanded\}/)
})
