import test from 'node:test'
import assert from 'node:assert/strict'
import { transformWithOxc } from 'vite'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { publicationChecklist, publicationFieldLabel } from './publicationReadiness.js'
import { readPublicationJson } from './publicationApiResponse.js'
import { COURSE_SOURCE_FIELDS, validateCourseSource } from '../../../shared/courseSourceFields.js'

const fixture = fieldErrors => ({ course: { course_code: 'CRS999', course_name: 'Synthetic test only' }, fields: { matching_profile_evidence: { cluster: 'Test', skills: [], riasec: [] }, duration: { years: 1, year_levels: [] }, description: 'Synthetic', obtainable_skills: 'Synthetic' }, sources: [{ source_id: 13, title: 'Synthetic reference', url: 'https://ched.gov.ph/test', supported_fields: ['description'], current_review: null }], matching_history: [], matching_review: { reviewer_label: 'Synthetic admin', reviewed_at: '2026-10-17' }, fieldErrors, ready: !Object.keys(fieldErrors).length, review_token: 'synthetic-token' })
const nodes = node => Array.isArray(node) ? node.flatMap(nodes) : node && typeof node === 'object' ? [node, ...nodes(node.props?.children)] : []
const text = node => typeof node === 'string' ? node : Array.isArray(node) ? node.map(text).join('') : node?.props ? text(node.props.children) : ''

test('checklist uses server failures, includes unknown blockers and readable source titles', () => {
  const review = fixture({ source_13: 'Invalid approved URL.', source_course_name: 'Current source confirmation required.' })
  const checks = publicationChecklist(review)
  assert.deepEqual(checks.filter(row => !row.passed).map(row => row.id), ['sources', 'coverage'])
  assert.ok(checks.find(row => row.id === 'matching').passed)
  assert.equal(publicationFieldLabel('source_13', review.sources), 'Source: Synthetic reference')
  assert.equal(publicationFieldLabel('source_course_name'), 'Source support: Course name')
  assert.ok(publicationChecklist(fixture({ new_server_rule: 'Blocked' })).some(row => row.id === 'other' && !row.passed))
  assert.ok(publicationChecklist({ ...fixture({}), ready: false }).some(row => !row.passed))
  assert.ok(publicationChecklist(fixture({})).every(row => row.passed))
})

test('checking shows loading, blocks duplicates, explains blockers, and unlocks only after a successful current check', async () => {
  const state = []; let cursor = 0
  const hooks = {
    useState(initial) { const i = cursor++; if (!(i in state)) state[i] = initial; return [state[i], value => { state[i] = typeof value === 'function' ? value(state[i]) : value }] },
    useRef(initial) { const i = cursor++; if (!(i in state)) state[i] = { current: initial }; return state[i] },
  }
  // Compile the actual component without the intermittently crashing Windows
  // Vite SSR worker. Hooks and fetch stay isolated to this test's VM context.
  const source = await readFile(new URL('../components/admin/CoursePublicationPanel.jsx', import.meta.url), 'utf8')
  const { code } = await transformWithOxc(source.replace(/^import [^\r\n]*\r?\n/gm, '').replaceAll('import.meta.env.VITE_API_URL', "'http://localhost:5000'"), 'CoursePublicationPanel.jsx', { jsx: { runtime: 'classic' } })
  let fetchImpl
  const Panel = vm.runInNewContext(code.replace('export default function', 'function') + '\nCoursePublicationPanel', {
    React, ...hooks, publicationChecklist, publicationFieldLabel, readPublicationJson, COURSE_SOURCE_FIELDS, validateCourseSource,
    fetch: (...args) => fetchImpl(...args),
  })
  let finish, calls = 0, published = 0
  fetchImpl = async (url, options) => { calls++; assert.match(url, /\/api\/admin\/courses\/999\/publication$/); assert.equal(options.method, 'GET'); return new Promise(resolve => { finish = data => resolve(new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } })) }) }
  const props = { courseId: 999, adminToken: 'synthetic-test-token', courseDirty: false, onUnauthorized() {}, onPublished() { published++ } }
  const draw = () => { cursor = 0; return Panel(props) }
  const checkButton = tree => nodes(tree).find(node => node.type === 'button' && /Check.*requirements/.test(text(node)))
  const confirmation = tree => nodes(tree).find(node => node.type === 'input' && node.props['aria-describedby'] === 'publication-confirmation-help')
  let tree = draw()
  const pending = checkButton(tree).props.onClick()
  await checkButton(tree).props.onClick()
  assert.equal(calls, 1)
  tree = draw()
  assert.equal(tree.props['aria-busy'], true)
  assert.match(renderToStaticMarkup(tree), /Checking saved course details/)
  finish(fixture({ source_13: 'Enter an approved publisher URL.', source_course_name: 'Current source confirmation required.' }))
  await pending
  tree = draw()
  assert.ok(confirmation(tree).props.disabled)
  assert.match(renderToStaticMarkup(tree), /Not ready to publish|Needs attention/)
  assert.match(renderToStaticMarkup(tree), /Publication confirmation is locked/)
  assert.match(renderToStaticMarkup(tree), /Source: Synthetic reference/)
  const retry = checkButton(tree).props.onClick()
  finish(fixture({})); await retry
  tree = draw()
  assert.ok(!confirmation(tree).props.disabled)
  assert.match(renderToStaticMarkup(tree), /All publication requirements passed/)
  const publishButton = nodes(tree).find(node => node.type === 'button' && text(node).startsWith('Publish Course'))
  assert.ok(publishButton.props.disabled)
  confirmation(tree).props.onChange({ target: { checked: true } })
  tree = draw()
  assert.ok(!nodes(tree).find(node => node.type === 'button' && text(node).startsWith('Publish Course')).props.disabled)
  props.courseDirty = true
  assert.ok(confirmation(draw()).props.disabled)
  props.courseDirty = false
  fetchImpl = async () => { calls++; throw new Error('Synthetic connection failure') }
  await checkButton(draw()).props.onClick()
  tree = draw()
  assert.ok(confirmation(tree).props.disabled)
  assert.equal(confirmation(tree).props.checked, false)
  assert.match(renderToStaticMarkup(tree), /Synthetic connection failure|Requirements need to be checked again/)
  assert.equal(published, 0)
  assert.equal(calls, 3)
})
