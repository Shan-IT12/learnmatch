import test from 'node:test'
import assert from 'node:assert/strict'
import { ASSESSMENT_SESSION_KEYS, assessmentHeaders, beginAssessmentAttempt, finishAssessmentAttempt, isEmptyAttemptProfileResponse } from './assessmentSession.js'

function storage(initial = {}) {
  const values = new Map(Object.entries(initial))
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) }
}

test('retake clears all prior drafts and starts with a distinct attempt id', () => {
  const store = storage({ [ASSESSMENT_SESSION_KEYS.interests]: '{"selected":["old"]}', [ASSESSMENT_SESSION_KEYS.personality]: '{"answers":{"1":5}}' })
  beginAssessmentAttempt(store, 42)
  assert.equal(store.getItem(ASSESSMENT_SESSION_KEYS.interests), null)
  assert.equal(store.getItem(ASSESSMENT_SESSION_KEYS.personality), null)
  assert.deepEqual(assessmentHeaders(store), { 'X-Assessment-Attempt-Id': '42' })
})

test('finishing a retake returns normal revisits to saved answers', () => {
  const store = storage()
  beginAssessmentAttempt(store, 42)
  finishAssessmentAttempt(store)
  assert.deepEqual(assessmentHeaders(store), {})
})

test('attempt-specific no-row responses are empty state while real failures remain errors', () => {
  assert.equal(isEmptyAttemptProfileResponse({ status: 404 }, 42), true)
  assert.equal(isEmptyAttemptProfileResponse({ status: 204 }, 42), true)
  assert.equal(isEmptyAttemptProfileResponse({ status: 500 }, 42), false)
  assert.equal(isEmptyAttemptProfileResponse({ status: 404 }, null), false)
})
