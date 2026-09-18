import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildDeterministicExplanation,
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

test('deterministic explanation describes existing WSM evidence', () => {
  const narrative = buildDeterministicExplanation(recommendations[0])
  assert.match(narrative, /weighted scoring model/i)
  assert.match(narrative, /rank #1/)
  assert.match(narrative, /91\.25%/)
  assert.match(narrative, /does not change the ranking/i)
})

test('missing API key returns fallback explanations without changing recommendations', async () => {
  const result = await generateRecommendationExplanations(recommendations, { apiKey: '' })
  assert.deepEqual(
    result.map(({ rank_position, course_code, match_score }) => ({ rank_position, course_code, match_score })),
    recommendations.map(({ rank_position, course_code, match_score }) => ({ rank_position, course_code, match_score }))
  )
  assert.ok(result.every(({ ai_narrative }) => ai_narrative.includes('weighted scoring model')))
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
