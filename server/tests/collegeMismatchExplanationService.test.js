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

test('college explanation payload discloses optional GWA and dimension scores without account identifiers', async () => {
  for (const gwa of [null, 1.75]) {
    let payload
    await generateMismatchExplanation({ ...monitorResult, gwa, username: 'PRIVATE_SENTINEL', email: 'PRIVATE_SENTINEL', personalFactors: 'PRIVATE_SENTINEL' }, {
      apiKey: 'synthetic-key', fetchImpl: async (url, options) => {
        assert.equal(url, 'https://api.openai.com/v1/responses')
        payload = JSON.parse(JSON.parse(options.body).input)
        return { ok: false }
      },
    })
    assert.deepEqual(Object.keys(payload).sort(), ['alignment_percent', 'deterministic_status', 'dimension_scores', 'gwa', 'phase'])
    assert.equal(payload.gwa, gwa)
    assert.equal(payload.dimension_scores.length, 5)
    for (const item of payload.dimension_scores) assert.deepEqual(Object.keys(item).sort(), ['dimension', 'score'])
    assert.doesNotMatch(JSON.stringify(payload), /PRIVATE_SENTINEL/)
  }
})

test('fallback sounds conversational and connects supported strengths and difficulties to one next step', () => {
  const fallback = buildMismatchFallback(monitorResult)
  assert.match(fallback.feedback, /you seem to enjoy what you’re studying/i)
  assert.match(fallback.feedback, /harder time with keeping up with the coursework/i)
  assert.match(fallback.recommendation, /one task.*instructor or a classmate/i)
  assert.doesNotMatch(JSON.stringify(fallback), /56|Monitor|GWA|perceived skill fit|lowest-rated|alignment result/)
  assert.doesNotMatch(`${fallback.feedback} ${fallback.recommendation}`, /must leave|diagnos/i)
})

test('fallback never turns low or neutral answers into strengths and gives dimension-specific advice', () => {
  for (const score of [1, 3]) {
    for (let question = 1; question <= 5; question++) {
      const result = buildMismatchFallback({ ...monitorResult, status: 'At Risk', answers: monitorResult.answers.map(answer => ({ ...answer, score: answer.question_number === question ? score : 3 })) })
      assert.doesNotMatch(result.feedback, /encouraging sign/)
      assert.ok(result.recommendation.length > 0)
      assert.ok(result.feedback.length <= 500)
      if (score === 1) assert.match(result.feedback, /harder time/)
      else assert.match(result.feedback, /unsure/)
    }
  }
})

test('check-in prompt requests the course-fit style grounded in answers, without score recaps or missing-GWA disclaimers', async () => {
  await generateMismatchExplanation(monitorResult, {
    apiKey: 'test-key', fetchImpl: async (_url, options) => {
      const { instructions } = JSON.parse(options.body)
      assert.match(instructions, /warm, casual but respectful/)
      assert.match(instructions, /you and your.*contractions/)
      assert.match(instructions, /Do not call a low or neutral score a strength/)
      assert.match(instructions, /Do not mention absent GWA/)
      assert.match(instructions, /one specific, manageable next step/)
      return { ok: false }
    },
  })
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
    { ...monitorResult, status: 'On Track', alignmentPercent: 88, answers: monitorResult.answers.map(answer => ({ ...answer, score: 5 })) },
    { apiKey: 'test-key', fetchImpl: async () => { calls += 1 } }
  )
  assert.equal(calls, 0)
  assert.match(result.feedback, /working well for you overall/i)
  assert.doesNotMatch(result.feedback, /harder time|unsure/)
  assert.match(result.recommendation, /study habit or source of support/)
})

test('formal boilerplate and malformed AI fields fall back to grounded conversational text', async () => {
  for (const feedback of [
    'Your current college alignment result is Monitor, with a 56% alignment level.',
    'No GWA was provided, so this reflects the available alignment measures only.',
    123, null, ' ', 'x'.repeat(501),
  ]) {
    const result = await generateMismatchExplanation(monitorResult, {
      apiKey: 'test-key', fetchImpl: async () => ({ ok: true, json: async () => ({ output_text: JSON.stringify({ feedback, recommendation: 'Ask your instructor about one difficult task.' }) }) }),
    })
    assert.deepEqual(result, buildMismatchFallback(monitorResult))
  }
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
