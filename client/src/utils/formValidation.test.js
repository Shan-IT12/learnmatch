import assert from 'node:assert/strict'
import test from 'node:test'

import { scrollToFirstInvalidField } from './formValidation.js'

test('scrolls to and focuses only the first invalid field', () => {
  const calls = []
  const input = { focus: (options) => calls.push(['focus', options]) }
  const container = {
    matches: () => false,
    querySelector: () => input,
    scrollIntoView: (options) => calls.push(['scroll', options]),
  }
  const originalWindow = globalThis.window
  const originalDocument = globalThis.document
  globalThis.window = { setTimeout: (callback) => callback() }
  globalThis.document = {
    querySelector: (selector) => {
      calls.push(['selector', selector])
      return container
    },
  }

  try {
    scrollToFirstInvalidField(['email', 'password'])
  } finally {
    globalThis.window = originalWindow
    globalThis.document = originalDocument
  }

  assert.deepEqual(calls, [
    ['selector', '[data-validation-field="email"]'],
    ['scroll', { behavior: 'smooth', block: 'center' }],
    ['focus', { preventScroll: true }],
  ])
})
