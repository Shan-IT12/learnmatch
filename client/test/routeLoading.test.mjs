import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createLazyPage, hasSlowRoute, navigationIdentity } from '../src/utils/routeLoading.js'

test('lazy routes share one import and render the ready module with unchanged props', async () => {
  let calls = 0, resolve
  const loaded = new Promise(done => { resolve = done })
  const Page = createLazyPage(() => { calls += 1; return loaded })
  const first = Page.preload()
  assert.equal(Page.preload(), first)
  assert.throws(() => Page({}), error => error === first)
  const Component = () => null
  resolve({ default: Component })
  await first
  const element = Page({ courseCode: 'QA' })
  assert.equal(calls, 1)
  assert.equal(element.type, Component)
  assert.equal(element.props.courseCode, 'QA')
})

test('a failed import reaches the route error boundary instead of remaining suspended', async () => {
  const failure = new Error('Controlled unavailable chunk')
  const Page = createLazyPage(() => Promise.reject(failure))
  await assert.rejects(Page.preload(), error => error === failure)
  assert.throws(() => Page({}), error => error === failure)
})

test('slow-route feedback is scoped to its URL and cleared when the import finishes', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const previous = globalThis.window
  globalThis.window = { location: { pathname: '/qa-slow' } }
  try {
    let resolve
    const Page = createLazyPage(() => new Promise(done => { resolve = done }))
    const loading = Page.preload()
    await Promise.resolve()
    assert.equal(hasSlowRoute('/qa-slow'), false)
    t.mock.timers.tick(8000)
    assert.equal(hasSlowRoute('/qa-slow'), true)
    assert.equal(hasSlowRoute('/qa-other'), false)
    resolve({ default: () => null })
    await loading
    assert.equal(hasSlowRoute('/qa-slow'), false)
  } finally { globalThis.window = previous }
})

test('the UI retention key changes when either stored identity changes', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  const data = new Map([['token', 'synthetic-student'], ['adminToken', 'synthetic-admin']])
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: key => data.get(key) || null } })
  try {
    const initial = navigationIdentity()
    data.delete('adminToken')
    const signedOutAdmin = navigationIdentity()
    assert.notEqual(signedOutAdmin, initial)
    data.delete('token')
    assert.notEqual(navigationIdentity(), signedOutAdmin)
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous)
    else delete globalThis.localStorage
  }
})
