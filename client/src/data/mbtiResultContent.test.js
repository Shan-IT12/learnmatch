import test from 'node:test'
import assert from 'node:assert/strict'
import { MBTI_TO_RIASEC as SERVER_MAPPING } from '../../../server/config/recommendationConfig.js'
import { MBTI_TO_RIASEC, MBTI_TYPE_CONTENT, getDimensionResults, getExpandedType } from './mbtiResultContent.js'

test('all 16 MBTI types have deterministic result content and the exact server RIASEC mapping', () => {
  assert.equal(Object.keys(MBTI_TYPE_CONTENT).length, 16)
  assert.deepEqual(MBTI_TO_RIASEC, SERVER_MAPPING)
  for (const type of Object.keys(MBTI_TO_RIASEC)) {
    assert.ok(MBTI_TYPE_CONTENT[type].summary)
    assert.ok(MBTI_TYPE_CONTENT[type].strengths.length)
    assert.ok(MBTI_TYPE_CONTENT[type].challenges.length)
    assert.equal(getExpandedType(type).split(' • ').length, 4)
  }
})

test('dimension presentation preserves winners, rounding, close results, and the existing tie rule', () => {
  const close = getDimensionResults('ESFJ', { EI: 51, NS: 49, TF: 49, JP: 51 })
  assert.deepEqual(close.map(({ preferred }) => preferred), ['E', 'S', 'F', 'J'])
  assert.ok(close.every(({ strength }) => strength === 'Slight'))

  const tied = getDimensionResults('ENTJ', { EI: 50, NS: 50, TF: 50, JP: 50 })
  assert.deepEqual(tied.map(({ leftPercent, rightPercent }) => [leftPercent, rightPercent]), Array(4).fill([50, 50]))
  assert.deepEqual(tied.map(({ preferred }) => preferred), ['E', 'N', 'T', 'J'])
  assert.ok(tied.every(({ isTie }) => isTie))

  const rounded = getDimensionResults('ESFJ', { EI: 55.6, NS: 43.6, TF: 42.2, JP: 60.4 })
  assert.deepEqual(rounded.map(({ leftPercent, rightPercent }) => [leftPercent, rightPercent]), [[56, 44], [56, 44], [42, 58], [60, 40]])
})
