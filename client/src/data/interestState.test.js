import test from 'node:test'
import assert from 'node:assert/strict'
import { restoreInterestState } from './interestList.js'
import { ASSESSMENT_SESSION_KEYS, beginAssessmentAttempt, readActiveAttempt, readAssessmentSession, saveActiveAttemptDraft, writeAssessmentSession } from '../utils/assessmentSession.js'

function memoryStorage() {
  const values = new Map()
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) }
}

test('The global checkbox persists through session navigation, refresh, server resume, and a retake starts empty', async (context) => {
  const storage = memoryStorage()
  beginAssessmentAttempt(storage, 41)
  const state = { selected: [], noInterests: true, updatedAt: 123 }
  let savedState
  context.mock.method(globalThis, 'fetch', async (_url, options) => {
    assert.equal(options.headers['X-Assessment-Attempt-Id'], '41')
    if (options.method === 'PATCH') savedState = JSON.parse(options.body).interests_json
    return { ok: true, json: async () => ({ attemptId: 41, interests: savedState }) }
  })
  writeAssessmentSession(storage, ASSESSMENT_SESSION_KEYS.interests, state)
  await saveActiveAttemptDraft('', 'token', storage, { interests_json: state })
  assert.deepEqual(readAssessmentSession(storage, ASSESSMENT_SESSION_KEYS.interests, {}), state)
  storage.removeItem(ASSESSMENT_SESSION_KEYS.interests)
  const attempt = await readActiveAttempt('', 'token', storage)
  assert.deepEqual(restoreInterestState({}, attempt.interests), state)
  beginAssessmentAttempt(storage, 42)
  assert.equal(storage.getItem(ASSESSMENT_SESSION_KEYS.interests), null)
  assert.deepEqual(restoreInterestState({}, null), { selected: [], noInterests: false, updatedAt: 0 })
})

test('autosaves complete in order and a queued save retains its original attempt and payload', async (context) => {
  const storage = memoryStorage()
  beginAssessmentAttempt(storage, 71)
  const calls = []
  let releaseFirst
  let firstStarted
  const started = new Promise((resolve) => { firstStarted = resolve })
  const firstReleased = new Promise((resolve) => { releaseFirst = resolve })
  context.mock.method(globalThis, 'fetch', async (_url, options) => {
    calls.push({ attemptId: options.headers['X-Assessment-Attempt-Id'], body: JSON.parse(options.body) })
    if (calls.length === 1) {
      firstStarted()
      await firstReleased
    }
    return { ok: true }
  })
  const first = saveActiveAttemptDraft('', 'token', storage, { interests_json: { selected: ['Drawing'], noInterests: false } })
  await started
  const payload = { interests_json: { selected: [], noInterests: true } }
  const second = saveActiveAttemptDraft('', 'token', storage, payload)
  payload.interests_json.noInterests = false
  beginAssessmentAttempt(storage, 72)
  assert.equal(calls.length, 1)
  releaseFirst()
  await Promise.all([first, second])
  assert.deepEqual(calls.map((call) => call.attemptId), ['71', '71'])
  assert.deepEqual(calls[1].body.interests_json, { selected: [], noInterests: true })
})

test('a failed autosave does not stop later saves from retrying the current state', async (context) => {
  const storage = memoryStorage()
  beginAssessmentAttempt(storage, 91)
  let calls = 0
  context.mock.method(globalThis, 'fetch', async () => {
    calls += 1
    if (calls <= 2) throw new Error('Offline')
    return { ok: true }
  })
  const first = saveActiveAttemptDraft('', 'token', storage, { interests_json: { selected: [], noInterests: false } })
  const second = saveActiveAttemptDraft('', 'token', storage, { interests_json: { selected: [], noInterests: true } })
  await assert.rejects(first, /Offline/)
  await second
  assert.equal(calls, 3)
})

test('autosave reports the rejected payload once rather than retrying a 400', async (context) => {
  const storage = memoryStorage()
  beginAssessmentAttempt(storage, 92)
  let calls = 0
  context.mock.method(globalThis, 'fetch', async () => {
    calls += 1
    return { ok: false, status: 400, json: async () => ({ message: 'interests_json must be an array.' }) }
  })
  await assert.rejects(
    saveActiveAttemptDraft('', 'token', storage, { interests_json: { selected: [], noInterests: true } }),
    (error) => error.status === 400 && error.message === 'interests_json must be an array.'
  )
  assert.equal(calls, 1)
})
