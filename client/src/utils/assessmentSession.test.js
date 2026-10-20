import test from 'node:test'
import assert from 'node:assert/strict'

import {
  restoreInterestAttempt,
  assessmentHeaders,
  boundedQuestionIndex,
  firstUnansweredQuestionIndex,
  markAssessmentStepComplete,
  readAssessmentSession,
  readCompletedAssessmentSteps,
  writeAssessmentSession,
  invalidateAssessmentSession,
} from './assessmentSession.js'

function memoryStorage() {
  const values = new Map()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  }
}

test('assessment session preserves answers, current progress, and question order', () => {
  const storage = memoryStorage()
  const state = {
    questions: [{ question_id: 7 }, { question_id: 2 }, { question_id: 9 }],
    answers: { 7: 'A', 2: 'C' },
    currentIndex: 1,
  }
  writeAssessmentSession(storage, 'skills', state)
  assert.deepEqual(readAssessmentSession(storage, 'skills', {}), state)
})

test('a recovery response arriving after logout cannot restore another student draft', async () => {
  const previousFetch = globalThis.fetch
  let resolveResponse
  globalThis.fetch = () => new Promise(resolve => { resolveResponse = resolve })
  const storage = memoryStorage()
  try {
    const pending = restoreInterestAttempt('', 'old-token', storage)
    invalidateAssessmentSession()
    resolveResponse({ ok: true, json: async () => ({ attemptId: 41 }) })
    assert.equal(await pending, null)
    assert.equal(storage.getItem('learnmatch:assessment:attempt-id'), null)
  } finally { globalThis.fetch = previousFetch }
})

test('completed assessment steps remain available after navigating backward', () => {
  const storage = memoryStorage()
  markAssessmentStepComplete(storage, 2)
  markAssessmentStepComplete(storage, 3)
  markAssessmentStepComplete(storage, 3)
  assert.deepEqual(readCompletedAssessmentSteps(storage), [2, 3])
})

test('session loading safely handles missing and malformed data', () => {
  const storage = memoryStorage()
  assert.deepEqual(readAssessmentSession(storage, 'missing', { answers: {} }), { answers: {} })
  storage.setItem('broken', '{')
  assert.deepEqual(readAssessmentSession(storage, 'broken', { answers: {} }), { answers: {} })
})

test('question helpers retain valid positions and find the first unanswered item', () => {
  const questions = [{ id: 4 }, { id: 8 }, { id: 12 }]
  assert.equal(boundedQuestionIndex(8, questions.length), 2)
  assert.equal(boundedQuestionIndex(-1, questions.length), 0)
  assert.equal(firstUnansweredQuestionIndex(questions, { 4: 5, 12: 3 }, (question) => question.id), 1)
})


test('interests recovers a missing attempt before saving without losing local answers', async () => {
  const storage = memoryStorage()
  storage.setItem('learnmatch:assessment:interests', JSON.stringify({ selected: [], noInterests: true }))
  const original = globalThis.fetch
  const calls = []
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options })
    return { ok: true, json: async () => ({ attemptId: 27, interests: { selected: [], noInterests: true } }) }
  }
  try {
    await restoreInterestAttempt('http://api', 'token', storage)
    assert.equal(calls[0].options.method, 'POST')
    assert.match(calls[0].url, /recover$/)
    assert.equal(calls[1].options.headers['X-Assessment-Attempt-Id'], '27')
    assert.equal(assessmentHeaders(storage)['X-Assessment-Attempt-Id'], '27')
    assert.equal(JSON.parse(storage.getItem('learnmatch:assessment:interests')).noInterests, true)
    calls.length = 0
    await restoreInterestAttempt('http://api', 'token', storage)
    assert.equal(calls.length, 1)
    assert.match(calls[0].url, /current$/)
  } finally { globalThis.fetch = original }
})
