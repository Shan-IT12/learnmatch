import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { build } from 'vite'
import { Buffer } from 'node:buffer'
import react from '@vitejs/plugin-react'
import { ASSESSMENT_SESSION_KEYS } from '../../utils/assessmentSession.js'

test('Interests renders one global checkbox above categories and no category-answer requirement', async () => {
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
    assert.equal([...markup.matchAll(/type="checkbox"/g)].length, 1)
    assert.match(markup, /<input[^>]*type="checkbox"[^>]*checked=""/)
    assert.equal([...markup.matchAll(/<button[^>]*aria-pressed="true"/g)].length, 0)
    assert.match(markup, /No interests or hobbies/)
    assert.doesNotMatch(markup, /Wala sa|None of these|categories answered/)
    assert.ok(markup.indexOf('type="checkbox"') < markup.indexOf('<section'))
    assert.match(markup, /0 \/ 10/)
    assert.doesNotMatch(markup, /Your answer can be saved|approved scoring policy|bg-blue-50/)
    assert.match(markup, /You do not need to select activities in every category/)
    state = { selected: [], noInterests: false }
    const unanswered = render()
    assert.equal([...unanswered.matchAll(/aria-pressed="true"/g)].length, 0)
    assert.doesNotMatch(unanswered, /Your answer can be saved/)
    assert.doesNotMatch(unanswered, /<input[^>]*type="checkbox"[^>]*checked=""/)
  } finally {
    if (originalSessionStorage) Object.defineProperty(globalThis, 'sessionStorage', originalSessionStorage)
    else delete globalThis.sessionStorage
    if (originalLocalStorage) Object.defineProperty(globalThis, 'localStorage', originalLocalStorage)
    else delete globalThis.localStorage
  }
})
