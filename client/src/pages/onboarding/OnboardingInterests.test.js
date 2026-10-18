import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { build } from 'vite'
import { Buffer } from 'node:buffer'
import react from '@vitejs/plugin-react'
import { ASSESSMENT_SESSION_KEYS } from '../../utils/assessmentSession.js'

test('Interests waits for saved progress with a skeleton before exposing editable answers', async () => {
  let state = { selected: [], noInterests: true }
  const originalSessionStorage = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage')
  const originalLocalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: {
    getItem: (key) => key === ASSESSMENT_SESSION_KEYS.interests ? JSON.stringify(state) : null,
  } })
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => null } })
  try {
    // Build this small SSR entry in memory, avoiding a dev server/file watcher.
    const bundle = await build({ configFile: false, plugins: [react()], logLevel: 'silent', build: { ssr: 'src/pages/onboarding/OnboardingInterests.jsx', write: false, minify: false } })
    const entry = bundle.output.find((output) => output.type === 'chunk' && output.isEntry)
    const code = entry.code.replace(/from "([^".][^"]*)"/g, (_match, specifier) => `from "${import.meta.resolve(specifier)}"`)
    const { default: Interests } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
    const render = () => renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(Interests)))
    const markup = render().replace(/<!-- -->/g, '')
    assert.match(markup, /aria-busy="true"/)
    assert.match(markup, /Loading your interests/)
    assert.match(markup, /class="layout-skeleton" aria-hidden="true" inert=""/)
    assert.equal([...markup.matchAll(/type="checkbox"/g)].length, 1)
    assert.match(markup, /Creative &amp; Arts/)
    assert.match(markup, /grid sm:grid-cols-2 gap-2.5/)
    assert.match(markup, /disabled=""/)
    state = { selected: [], noInterests: false }
    assert.match(render(), /Loading your interests/)

  } finally {
    if (originalSessionStorage) Object.defineProperty(globalThis, 'sessionStorage', originalSessionStorage)
    else delete globalThis.sessionStorage
    if (originalLocalStorage) Object.defineProperty(globalThis, 'localStorage', originalLocalStorage)
    else delete globalThis.localStorage
  }
})
