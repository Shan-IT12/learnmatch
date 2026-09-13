import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'

import {
  getResponseChoices,
  mbtiQuestions,
  preferenceResponses,
  responseFamilies,
} from '../../client/src/data/mbtiQuestions.js'

const familyQuestionIds = {
  agreement: [1, 2, 3, 7, 8, 11, 12, 13, 16, 18, 21, 23, 24, 26, 29, 30, 31, 33, 34, 35, 36, 39],
  frequency: [5, 6, 9, 14, 17, 19, 20, 22, 25, 27, 28, 38],
  comfort: [10, 40],
  preference: [4, 15, 32, 37],
}

const expectedCoreQuestionHash = '2ffd07286b1ca66eac9ad4f571cbf199d861e06e23a639c34cba7f49f89384a1'

test('all 40 original personality question fields remain unchanged and ordered', () => {
  assert.equal(mbtiQuestions.length, 40)
  assert.deepEqual(mbtiQuestions.map((question) => question.id), Array.from({ length: 40 }, (_, index) => index + 1))

  const coreQuestions = mbtiQuestions.map(({ id, text, dimension, pole }) => ({
    id,
    text,
    dimension,
    pole,
  }))
  const hash = createHash('sha256').update(JSON.stringify(coreQuestions)).digest('hex')
  assert.equal(hash, expectedCoreQuestionHash)
})

test('each MBTI dichotomy retains five questions for each pole', () => {
  const expectedCounts = {
    'EI:E': 5, 'EI:I': 5,
    'SN:S': 5, 'SN:N': 5,
    'TF:T': 5, 'TF:F': 5,
    'JP:J': 5, 'JP:P': 5,
  }
  const counts = Object.fromEntries(Object.keys(expectedCounts).map((key) => [key, 0]))

  for (const question of mbtiQuestions) counts[`${question.dimension}:${question.pole}`] += 1
  assert.deepEqual(counts, expectedCounts)
})

test('questions use exactly the approved response families', () => {
  for (const [family, expectedIds] of Object.entries(familyQuestionIds)) {
    assert.deepEqual(
      mbtiQuestions.filter((question) => question.responseFamily === family).map((question) => question.id),
      expectedIds
    )
  }
})

test('reusable response families use the approved wording', () => {
  assert.deepEqual(responseFamilies.agreement, ['Strongly disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly agree'])
  assert.deepEqual(responseFamilies.frequency, ['Almost never', 'Rarely', 'Sometimes', 'Often', 'Almost always'])
  assert.deepEqual(responseFamilies.comfort, ['Very uncomfortable', 'Somewhat uncomfortable', 'Neutral', 'Comfortable', 'Very comfortable'])
})

test('preference questions use their approved item-specific wording', () => {
  assert.deepEqual(preferenceResponses[4], ['Strongly prefer group discussions', 'Slightly prefer group discussions', 'No clear preference', 'Slightly prefer one-on-one conversations', 'Strongly prefer one-on-one conversations'])
  assert.deepEqual(preferenceResponses[15], ['Strongly prefer open-ended tasks', 'Slightly prefer open-ended tasks', 'No clear preference', 'Slightly prefer step-by-step instructions', 'Strongly prefer step-by-step instructions'])
  assert.deepEqual(preferenceResponses[32], ['Strongly prefer committing early', 'Slightly prefer committing early', 'No clear preference', 'Slightly prefer keeping options open', 'Strongly prefer keeping options open'])
  assert.deepEqual(preferenceResponses[37], ['Strongly prefer flexibility', 'Slightly prefer flexibility', 'No clear preference', 'Slightly prefer clear rules and structure', 'Strongly prefer clear rules and structure'])
})

test('every question resolves to five options mapped to unchanged values 1 through 5', () => {
  for (const question of mbtiQuestions) {
    const choices = getResponseChoices(question)
    assert.equal(choices.length, 5)
    assert.deepEqual(choices.map((choice) => choice.value), [1, 2, 3, 4, 5])
  }
})
