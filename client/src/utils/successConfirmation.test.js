import test from 'node:test'
import assert from 'node:assert/strict'
import { getSuccessConfirmationDelay, SUCCESS_CONFIRMATION_DELAY_MS } from './successConfirmation.js'

test('success confirmation uses a short delay and removes it for reduced motion', () => {
  assert.equal(getSuccessConfirmationDelay(() => ({ matches: false })), SUCCESS_CONFIRMATION_DELAY_MS)
  assert.ok(SUCCESS_CONFIRMATION_DELAY_MS >= 500 && SUCCESS_CONFIRMATION_DELAY_MS <= 800)
  assert.equal(getSuccessConfirmationDelay(() => ({ matches: true })), 0)
})
