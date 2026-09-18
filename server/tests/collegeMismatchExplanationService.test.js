import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildMismatchFallback,
  generateMismatchExplanation,
} from '../services/collegeMismatchExplanationService.js'

const monitorResult = {
  status: 'Monitor',
  alignmentPercent: 56,
  phase: 'Mid',
  gwa: null,
  answers: [
    { question_number: 1, score: 4 },
    { question_number: 2, score: 2 },
    { question_number: 3, score: 3 },
    { question_number: 4, score: 3 },
    { question_number: 5, score: 3 },
  ],
}

test('deterministic mismatch fallback is supportive and uses the lowest dimension', () => {
  const fallback = buildMismatchFallback(monitorResult)
  assert.match(fallback.feedback, /worth monitoring/i)
  assert.match(fallback.feedback, /skill fit and workload/i)
  assert.doesNotMatch(`${fallback.feedback} ${fallback.recommendation}`, /must leave|diagnos/i)
})

test('missing key and failed AI both return deterministic fallback', async () => {
  const expected = buildMismatchFallback(monitorResult)
  assert.deepEqual(
    await generateMismatchExplanation(monitorResult, { apiKey: '' }),
    expected
  )
  assert.deepEqual(
    await generateMismatchExplanation(monitorResult, {
      apiKey: 'test-key',
      fetchImpl: async () => { throw new Error('offline') },
    }),
    expected
  )
})

test('On Track uses deterministic feedback without calling AI', async () => {
  let calls = 0
  const result = await generateMismatchExplanation(
    { ...monitorResult, status: 'On Track', alignmentPercent: 88 },
    { apiKey: 'test-key', fetchImpl: async () => { calls += 1 } }
  )
  assert.equal(calls, 0)
  assert.match(result.feedback, /generally matching/i)
})

test('valid AI response cannot change deterministic status or scores', async () => {
  const result = await generateMismatchExplanation(monitorResult, {
    apiKey: 'test-key',
    fetchImpl: async (_url, options) => {
      const request = JSON.parse(options.body)
      assert.equal(request.model, 'gpt-5.6-luna')
      assert.equal(request.max_output_tokens, 350)
      const evidence = JSON.parse(request.input)
      assert.equal(evidence.deterministic_status, 'Monitor')
      assert.equal(evidence.alignment_percent, 56)
      assert.equal('courseName' in evidence, false)
      return {
        ok: true,
        json: async () => ({
          output: [{
            content: [{
              type: 'output_text',
              text: JSON.stringify({
                feedback: 'A supportive interpretation.',
                recommendation: 'A manageable next step.',
              }),
            }],
          }],
        }),
      }
    },
  })
  assert.deepEqual(result, {
    feedback: 'A supportive interpretation.',
    recommendation: 'A manageable next step.',
  })
})
