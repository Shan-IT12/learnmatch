import test from 'node:test'
import assert from 'node:assert/strict'
import {
  feedbackPromptKey,
  getActiveFeedbackPromptKey,
  getFeedbackPromptState,
  setFeedbackPromptState,
  setActiveFeedbackPromptKey,
  shouldShowFeedbackPrompt,
} from './feedbackPrompt.js'

function memoryStorage() {
  const values = new Map()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  }
}

test('feedback prompt waits for a completed recommendation milestone', () => {
  const storage = memoryStorage()
  const key = feedbackPromptKey(7, 42)
  assert.equal(shouldShowFeedbackPrompt(storage, key, false), false)
  assert.equal(shouldShowFeedbackPrompt(storage, key, true), true)
})

test('dismissal persists for one saved recommendation without suppressing another', () => {
  const storage = memoryStorage()
  const first = feedbackPromptKey(7, 42)
  const second = feedbackPromptKey(7, 43)
  setFeedbackPromptState(storage, first, 'dismissed')
  assert.equal(getFeedbackPromptState(storage, first), 'dismissed')
  assert.equal(shouldShowFeedbackPrompt(storage, first, true), false)
  assert.equal(shouldShowFeedbackPrompt(storage, second, true), true)
})

test('submitted feedback permanently suppresses that assessment prompt', () => {
  const storage = memoryStorage()
  const key = feedbackPromptKey(7, 42)
  setFeedbackPromptState(storage, key, 'submitted')
  assert.equal(shouldShowFeedbackPrompt(storage, key, true), false)
})

test('manual feedback can resolve the latest completed-results prompt', () => {
  const storage = memoryStorage()
  const key = feedbackPromptKey(7, 42)
  setActiveFeedbackPromptKey(storage, key)
  assert.equal(getActiveFeedbackPromptKey(storage), key)
  setFeedbackPromptState(storage, getActiveFeedbackPromptKey(storage), 'submitted')
  assert.equal(shouldShowFeedbackPrompt(storage, key, true), false)
})

test('invalid identities cannot create a broad feedback prompt key', () => {
  assert.equal(feedbackPromptKey('', 42), null)
  assert.equal(feedbackPromptKey(7, 0), null)
})
