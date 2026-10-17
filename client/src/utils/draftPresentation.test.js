import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'
import { createElement } from 'react'
import { transformWithOxc } from 'vite'
import { scrollToFirstInvalidField } from './formValidation.js'

async function disclosureHarness(name = 'DraftDisclosure') {
  const source = await readFile(new URL('../components/admin/DraftDisclosure.jsx', import.meta.url), 'utf8')
  const { code } = await transformWithOxc(source.replace(/^import .*\r?\n/, ''), 'DraftDisclosure.jsx', { jsx: { runtime: 'classic' } })
  const states = [], listeners = new Map()
  let cursor = 0, dirty = false, effectCleanup, requests = 0
  const element = { addEventListener: (name, handler) => listeners.set(name, handler), removeEventListener: name => listeners.delete(name) }
  const context = vm.createContext({
    React: { createElement, Fragment: Symbol.for('react.fragment') },
    useId: () => 'mock-disclosure', useRef: () => ({ current: element }),
    useEffect: fn => { if (!effectCleanup) effectCleanup = fn() },
    useState: value => {
      const index = cursor++
      if (!(index in states)) states[index] = typeof value === 'function' ? value() : value
      return [states[index], update => { states[index] = typeof update === 'function' ? update(states[index]) : update; dirty = true }]
    },
    fetch: () => { requests++; throw Error('Disclosure must not request data') },
  })
  const Component = vm.runInContext(code.replace('export default function', 'function').replace('export function', 'function') + `\n${name}`, context)
  return {
    render(props) { let tree; do { dirty = false; cursor = 0; tree = Component(props) } while (dirty); return tree },
    reveal: () => listeners.get('draft:reveal')?.(), requests: () => requests,
  }
}

test('section toggles preserve mounted fields, confirmations and analysis and make zero requests', async () => {
  const harness = await disclosureHarness()
  const snapshot = { name: 'Keep entered course', weight: '2', evidence: 'Keep evidence', confirmed: true, report: { excerpts: ['Keep excerpt'], usage: { input_tokens: 100 } } }
  const children = createElement('div', null, createElement('input', { value: snapshot.name, readOnly: true }), createElement('input', { type: 'checkbox', checked: snapshot.confirmed, readOnly: true }), createElement('pre', null, JSON.stringify(snapshot)))
  const props = { title: 'Course Details', defaultOpen: true, children }
  let tree = harness.render(props)
  const body = () => tree.props.children[2]
  const toggle = () => tree.props.children[0].props.children[0].props.children
  for (const expanded of [false, true]) {
    const button = toggle()
    assert.equal(button.type, 'button'); assert.equal(button.props.type, 'button')
    button.props.onClick(); tree = harness.render(props)
    assert.equal(toggle().props['aria-expanded'], expanded)
    assert.equal(toggle().props['aria-controls'], body().props.id)
    assert.equal(body().props.hidden, !expanded)
    assert.equal(body().props.children, children)
    assert.equal(snapshot.confirmed, true)
    assert.equal(harness.requests(), 0)
  }
})

test('error headers expand when validation reports an error and reveal events reopen collapsed ancestors', async () => {
  const harness = await disclosureHarness()
  const props = { title: 'Skill Profile', children: createElement('input', { value: 'Keep', readOnly: true }) }
  let tree = harness.render(props)
  assert.equal(tree.props.children[2].props.hidden, true)
  tree = harness.render({ ...props, hasError: true })
  assert.equal(tree.props.children[2].props.hidden, false)
  tree.props.children[0].props.children[0].props.children.props.onClick()
  tree = harness.render({ ...props, hasError: true })
  assert.equal(tree.props.children[2].props.hidden, true)
  harness.reveal(); tree = harness.render({ ...props, hasError: true })
  assert.equal(tree.props.children[2].props.hidden, false)
  assert.equal(harness.requests(), 0)
})

test('validation reveals before scrolling and focusing the actual invalid field', t => {
  const priorWindow = globalThis.window, priorDocument = globalThis.document
  t.after(() => { globalThis.window = priorWindow; globalThis.document = priorDocument })
  const queued = [], operations = []
  const field = {
    dispatchEvent(event) { assert.equal(event.type, 'draft:reveal'); assert.equal(event.bubbles, true); operations.push('expand') },
    scrollIntoView() { operations.push('scroll') }, focus() { operations.push('focus') },
  }
  const container = { closest: () => ({}), querySelector: () => field }
  globalThis.window = { setTimeout: fn => queued.push(fn) }
  globalThis.document = { querySelector: () => container }
  scrollToFirstInvalidField(['matching_profiles'])
  queued.shift()()
  assert.deepEqual(operations, ['expand'])
  queued.shift()()
  assert.deepEqual(operations, ['expand', 'scroll', 'focus'])
})

test('guidance controls are keyboard-native buttons and preserve their mounted content', async () => {
  const harness = await disclosureHarness('DraftGuidance')
  const children = createElement('p', null, 'Do not guess weights.')
  let tree = harness.render({ children })
  assert.equal(tree.props.children[1].props.hidden, true)
  const button = tree.props.children[0]
  assert.equal(button.type, 'button'); assert.equal(button.props.type, 'button')
  assert.equal(button.props.children, 'View guidance')
  button.props.onClick(); tree = harness.render({ children })
  assert.equal(tree.props.children[0].props['aria-expanded'], true)
  assert.equal(tree.props.children[0].props.children, 'Hide guidance')
  assert.equal(tree.props.children[1].props.children, children)
  assert.equal(harness.requests(), 0)
})

test('new-draft layout stacks on mobile, pairs fields on desktop and keeps sources last', async () => {
  const [page, fields, sources, report] = await Promise.all(['../pages/admin/ManageCourses.jsx', '../components/admin/CourseDraftFields.jsx', '../components/admin/SourceFirstDraftSources.jsx', '../components/admin/SourceCheckReport.jsx'].map(path => readFile(new URL(path, import.meta.url), 'utf8')))
  assert.match(page, /title="Course Details" defaultOpen/)
  assert.match(fields, /'Skill Profile' : 'RIASEC Profile'/)
  assert.ok(page.indexOf('part="profiles"') < page.indexOf('<SourceFirstDraftSources sources='))
  assert.match(page, /grid-cols-1 gap-5 md:grid-cols-2/)
  assert.match(fields, /grid-cols-1 gap-4 border-t.*md:grid-cols-/)
  assert.match(sources, /grid-cols-1 gap-5.*md:grid-cols-2/)
  assert.match(sources, /summaryOnly/)
  assert.match(report, /View coverage limitations/); assert.match(report, /View technical diagnostics/)
  assert.match(report, /initialExpanded=\{false\}/)
  assert.doesNotMatch(report, /fetch\(|setSources|setConfirmation|setForm|request\(/)
})
