import test from 'node:test'
import assert from 'node:assert/strict'

import { validatePersonalitySubmission } from '../services/personalitySubmissionService.js'

function createValidAnswers(rating = 3) {
  return [
    ...Array.from({ length: 5 }, () => ({ dimension: 'EI', pole: 'E', rating })),
    ...Array.from({ length: 5 }, () => ({ dimension: 'EI', pole: 'I', rating })),
    ...Array.from({ length: 5 }, () => ({ dimension: 'SN', pole: 'S', rating })),
    ...Array.from({ length: 5 }, () => ({ dimension: 'SN', pole: 'N', rating })),
    ...Array.from({ length: 5 }, () => ({ dimension: 'TF', pole: 'T', rating })),
    ...Array.from({ length: 5 }, () => ({ dimension: 'TF', pole: 'F', rating })),
    ...Array.from({ length: 5 }, () => ({ dimension: 'JP', pole: 'J', rating })),
    ...Array.from({ length: 5 }, () => ({ dimension: 'JP', pole: 'P', rating })),
  ]
}

function expectInvalid(answers) {
  assert.equal(validatePersonalitySubmission(answers).valid, false)
}

test('a valid 40-answer payload with exactly five answers per pole passes', () => {
  const result = validatePersonalitySubmission(createValidAnswers())
  assert.equal(result.valid, true)
  assert.equal(result.answers.length, 40)
})

test('39 answers fail validation', () => expectInvalid(createValidAnswers().slice(0, 39)))
test('41 answers fail validation', () => expectInvalid([...createValidAnswers(), createValidAnswers()[0]]))
test('non-array answers fail validation', () => expectInvalid({}))
test('missing answers fail validation', () => expectInvalid(undefined))

test('non-object answers fail validation', () => {
  const answers = createValidAnswers()
  answers[0] = null
  expectInvalid(answers)
})

test('answers missing required properties fail validation', () => {
  const answers = createValidAnswers()
  answers[0] = { dimension: 'EI', pole: 'E' }
  expectInvalid(answers)
})

test('an invalid dimension fails validation', () => {
  const answers = createValidAnswers()
  answers[0] = { ...answers[0], dimension: 'XX' }
  expectInvalid(answers)
})

test('an invalid pole for a valid dimension fails validation', () => {
  const answers = createValidAnswers()
  answers[0] = { ...answers[0], pole: 'N' }
  expectInvalid(answers)
})

for (const rating of [0, 6, -1, 1.5, 'abc', null, undefined, Number.NaN, Infinity]) {
  test(`rating ${String(rating)} fails validation`, () => {
    const answers = createValidAnswers()
    answers[0] = { ...answers[0], rating }
    expectInvalid(answers)
  })
}

test('safe numeric-string ratings normalize to numbers without changing their values', () => {
  const result = validatePersonalitySubmission(createValidAnswers('4'))
  assert.equal(result.valid, true)
  assert.ok(result.answers.every((answer) => answer.rating === 4))
})

test('an incorrect pole distribution fails even when the total is 40', () => {
  const answers = createValidAnswers()
  answers[5] = { ...answers[5], pole: 'E' }
  expectInvalid(answers)
})

test('normalized valid ratings retain the values consumed by existing scoring', () => {
  const ratings = [1, '2', 3, '4', 5]
  const answers = createValidAnswers().map((answer, index) => ({
    ...answer,
    rating: ratings[index % ratings.length],
  }))
  const result = validatePersonalitySubmission(answers)

  assert.equal(result.valid, true)
  assert.deepEqual(result.answers.slice(0, 5).map((answer) => answer.rating), [1, 2, 3, 4, 5])
})
