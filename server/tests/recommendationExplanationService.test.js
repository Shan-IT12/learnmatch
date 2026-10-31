import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildDeterministicExplanation,
  buildExplanationContext,
  needsExplanationRefresh,
  generateRecommendationExplanations,
} from '../services/recommendationExplanationService.js'

const recommendations = [
  {
    rank_position: 1,
    course_id: 430,
    course_code: 'CRS001',
    course_name: 'Course One',
    cluster_category: 'BUSINESS CLUSTER',
    match_score: 91.25,
    score_breakdown: {
      skill_match: 90,
      interest_match: 80,
      personality_match: 100,
      personal_factor_match: 50,
    },
  },
  {
    rank_position: 2,
    course_id: 431,
    course_code: 'CRS002',
    course_name: 'Course Two',
    cluster_category: 'EDUCATION CLUSTER',
    match_score: 82.5,
    score_breakdown: {
      skill_match: 70,
      interest_match: 75,
      personality_match: 100,
      personal_factor_match: 50,
    },
  },
  {
    rank_position: 3,
    course_id: 432,
    course_code: 'CRS003',
    course_name: 'Course Three',
    cluster_category: 'ARTS & MULTIMEDIA CLUSTER',
    match_score: 78,
    score_breakdown: {
      skill_match: 65,
      interest_match: 70,
      personality_match: 100,
      personal_factor_match: 50,
    },
  },
]

const openAIResponse = () => ({
  ok: true,
  json: async () => ({
    model: 'gpt-5.6-luna',
    usage: {
      input_tokens: 420,
      output_tokens: 230,
      total_tokens: 650,
    },
    output: [{
      content: [{
        type: 'output_text',
        text: JSON.stringify({
          explanations: [
            { rank_position: 3, narrative: 'Third explanation' },
            { rank_position: 1, narrative: 'First explanation' },
            { rank_position: 2, narrative: 'Second explanation' },
          ],
        }),
      }],
    }],
  }),
})

test('explanation payload matches the notice and excludes account details and raw disclosures', async () => {
  let payload
  const synthetic = recommendations.map(row => ({
    ...row, username: 'PRIVATE_SENTINEL', email: 'PRIVATE_SENTINEL',
    answers: 'PRIVATE_SENTINEL', personal_factor_answers: 'PRIVATE_SENTINEL', factor_others: 'PRIVATE_SENTINEL',
  }))
  await generateRecommendationExplanations(synthetic, { apiKey: 'synthetic-key', fetchImpl: async (url, options) => {
    assert.equal(url, 'https://api.openai.com/v1/responses')
    payload = JSON.parse(JSON.parse(options.body).input)
    return { ok: false }
  } })
  assert.equal(payload.length, 3)
  for (const item of payload) {
    assert.deepEqual(Object.keys(item).sort(), ['area_to_develop', 'cluster_category', 'course_context', 'course_name', 'match_score', 'personality_themes', 'rank_position', 'strongest_alignment_factors'])
    for (const factor of [...item.strongest_alignment_factors, item.area_to_develop]) assert.deepEqual(Object.keys(factor).sort(), ['label', 'score'])
  }
  assert.doesNotMatch(JSON.stringify(payload), /PRIVATE_SENTINEL/)
})

test('fallback is conversational, grounded in supplied context, and avoids technical boilerplate', () => {
  const context = buildExplanationContext({ description: 'Studies design.', obtainable_skills: ['design', 'drawing'], mbti_type: 'INTP' })
  const narrative = buildDeterministicExplanation({ ...recommendations[0], explanation_context: context })
  assert.match(narrative, /Your personality result suggests you may enjoy investigating ideas and solving problems/)
  assert.match(narrative, /design and drawing/)
  assert.equal(needsExplanationRefresh(narrative), false)
  assert.doesNotMatch(narrative, /weighted|rank|91\.25%|100%|guarantee|perfect fit/i)
})

test('context excludes private fields, bounds course content and handles unavailable themes', () => {
  const context = buildExplanationContext({ description: 'x'.repeat(3000), obtainable_skills: Array(10).fill('drawing'), mbti_type: 'UNKNOWN', email: 'PRIVATE_SENTINEL' })
  assert.equal(context.course_description.length, 1800)
  assert.equal(context.course_skills.length, 6)
  assert.deepEqual(context.personality_themes, [])
  assert.doesNotMatch(JSON.stringify(context), /PRIVATE_SENTINEL/)
})

test('missing interests and personal circumstances are not invented as strengths', () => {
  const narrative = buildDeterministicExplanation({ ...recommendations[0], interests_available: false,
    score_breakdown: { interest_match: 100, personal_factor_match: 50, skill_match: 0, personality_match: 0 } })
  assert.doesNotMatch(narrative, /Your interests|strongest connections|personality result|personal profile|personal circumstances/)
})

test('missing API key returns fallback explanations without changing recommendations', async () => {
  const result = await generateRecommendationExplanations(recommendations, { apiKey: '' })
  assert.deepEqual(
    result.map(({ rank_position, course_code, match_score }) => ({ rank_position, course_code, match_score })),
    recommendations.map(({ rank_position, course_code, match_score }) => ({ rank_position, course_code, match_score }))
  )
  assert.ok(result.every(({ ai_narrative }) => !needsExplanationRefresh(ai_narrative)))
})

test('OpenAI failure returns deterministic fallbacks and keeps Top 3 visible', async () => {
  const result = await generateRecommendationExplanations(recommendations, {
    apiKey: 'test-key',
    fetchImpl: async () => { throw new Error('network unavailable') },
  })
  assert.equal(result.length, 3)
  assert.deepEqual(result.map(({ rank_position }) => rank_position), [1, 2, 3])
  assert.ok(result.every(({ ai_narrative }) => ai_narrative.length > 0))
})

test('successful OpenAI narratives attach by rank without altering order or scores', async () => {
  const fetchImpl = async (_url, options) => {
    const request = JSON.parse(options.body)
    assert.equal(request.model, 'gpt-5.6-luna')
    assert.equal(request.max_output_tokens, 800)
    assert.match(request.instructions, /Never change or question the rank or score/)
    assert.match(request.instructions, /2 to 4 concise sentences/)
    const evidence = JSON.parse(request.input)
    assert.equal(evidence.length, 3)
    assert.equal('score_breakdown' in evidence[0], false)
    assert.deepEqual(Object.keys(evidence[0]), [
      'rank_position',
      'course_name',
      'cluster_category',
      'match_score',
      'strongest_alignment_factors',
      'area_to_develop',
      'course_context',
      'personality_themes',
    ])
    return openAIResponse()
  }

  const result = await generateRecommendationExplanations(recommendations, {
    apiKey: 'test-key',
    fetchImpl,
  })

  assert.deepEqual(result.map(({ rank_position, match_score, ai_narrative }) => ({
    rank_position,
    match_score,
    ai_narrative,
  })), [
    { rank_position: 1, match_score: 91.25, ai_narrative: 'First explanation' },
    { rank_position: 2, match_score: 82.5, ai_narrative: 'Second explanation' },
    { rank_position: 3, match_score: 78, ai_narrative: 'Third explanation' },
  ])
})

test('development logs official Responses API usage fields and production logs nothing', async () => {
  const originalNodeEnv = process.env.NODE_ENV
  const originalConsoleInfo = console.info
  const logs = []
  console.info = (message) => logs.push(message)

  try {
    process.env.NODE_ENV = 'development'
    await generateRecommendationExplanations(recommendations, {
      apiKey: 'test-key',
      fetchImpl: async () => openAIResponse(),
    })
    assert.deepEqual(logs, [
      'Recommendation explanation source: OpenAI',
      'Model: gpt-5.6-luna',
      'Input tokens: 420',
      'Output tokens: 230',
      'Total tokens: 650',
    ])

    logs.length = 0
    process.env.NODE_ENV = 'production'
    await generateRecommendationExplanations(recommendations, {
      apiKey: 'test-key',
      fetchImpl: async () => openAIResponse(),
    })
    assert.deepEqual(logs, [])
  } finally {
    console.info = originalConsoleInfo
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = originalNodeEnv
  }
})

test('technical AI wording is replaced with the conversational fallback', async () => {
  const result = await generateRecommendationExplanations(recommendations, {
    apiKey: 'test-key', fetchImpl: async () => ({ ok: true, json: async () => ({ output_text: JSON.stringify({ explanations: recommendations.map(rec => ({ rank_position: rec.rank_position, narrative: 'The weighted scoring model selected this.' })) }) }) }),
  })
  assert.ok(result.every(rec => !needsExplanationRefresh(rec.ai_narrative)))
  assert.deepEqual(result.map(rec => rec.match_score), recommendations.map(rec => rec.match_score))
})
