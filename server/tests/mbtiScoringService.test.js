import test from 'node:test'
import assert from 'node:assert/strict'

import { calculateMbtiResult } from '../services/mbtiScoringService.js'

const tiedAnswers = [
  ...['E', 'I'].flatMap((pole) => Array.from({ length: 5 }, () => ({ dimension: 'EI', pole, rating: 3 }))),
  ...['S', 'N'].flatMap((pole) => Array.from({ length: 5 }, () => ({ dimension: 'SN', pole, rating: 3 }))),
  ...['T', 'F'].flatMap((pole) => Array.from({ length: 5 }, () => ({ dimension: 'TF', pole, rating: 3 }))),
  ...['J', 'P'].flatMap((pole) => Array.from({ length: 5 }, () => ({ dimension: 'JP', pole, rating: 3 }))),
]

test('exact MBTI dimension ties deterministically select the established E/N/T/J poles', () => {
  assert.deepEqual(calculateMbtiResult(tiedAnswers), {
    mbtiType: 'ENTJ',
    scores: { EI: 50, NS: 50, TF: 50, JP: 50 },
  })
})

test('identical MBTI answers produce the same type and scores across repeated runs', () => {
  const first = calculateMbtiResult(tiedAnswers)
  for (let run = 0; run < 10; run += 1) {
    assert.deepEqual(calculateMbtiResult(tiedAnswers), first)
  }
})
