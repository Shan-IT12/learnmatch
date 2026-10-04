import test from 'node:test'
import assert from 'node:assert/strict'

import {
  boundedQuestionIndex,
  firstUnansweredQuestionIndex,
  markAssessmentStepComplete,
  readAssessmentSession,
  readCompletedAssessmentSteps,
  writeAssessmentSession,
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
