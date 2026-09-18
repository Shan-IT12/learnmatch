const FACTOR_LABELS = {
  skill_match: 'skills',
  interest_match: 'interests',
  personality_match: 'personality',
  personal_factor_match: 'personal profile considerations',
}

const MAX_OUTPUT_TOKENS = 800

function strongestFactors(scoreBreakdown = {}) {
  return Object.entries(FACTOR_LABELS)
    .map(([key, label]) => ({ label, score: Number(scoreBreakdown[key]) }))
    .filter(({ score }) => Number.isFinite(score))
    .sort((left, right) => right.score - left.score)
    .slice(0, 2)
}

function developmentFactor(scoreBreakdown = {}) {
  return Object.entries(FACTOR_LABELS)
    .filter(([key]) => key !== 'personal_factor_match')
    .map(([key, label]) => ({ label, score: Number(scoreBreakdown[key]) }))
    .filter(({ score }) => Number.isFinite(score))
    .sort((left, right) => left.score - right.score)[0] || null
}

export function buildDeterministicExplanation(recommendation) {
  const factors = strongestFactors(recommendation.score_breakdown)
  const evidence = factors.length
    ? factors.map(({ label, score }) => `${label} (${score}%)`).join(' and ')
    : `the recorded ${recommendation.match_score}% compatibility score`
  const development = developmentFactor(recommendation.score_breakdown)
  const developmentSentence = development
    ? `As you explore this option, you can continue developing your ${development.label}.`
    : ''

  return `LearnMatch's weighted scoring model placed ${recommendation.course_name} at rank #${recommendation.rank_position} with ${recommendation.match_score}% compatibility. Your strongest alignment comes from ${evidence}, which supports this course's place in your Top 3. ${developmentSentence} This explanation is a friendly interpretation of your existing scores and does not change the ranking.`
}

function withFallbackExplanations(recommendations) {
  return recommendations.map((recommendation) => ({
    ...recommendation,
    ai_narrative: buildDeterministicExplanation(recommendation),
  }))
}

function logExplanationSource(source) {
  if (process.env.NODE_ENV === 'development') {
    console.info(`Recommendation explanation source: ${source}`)
  }
}

function logOpenAIUsage(model, usage = {}) {
  if (process.env.NODE_ENV === 'development') {
    console.info(`Model: ${model}`)
    console.info(`Input tokens: ${usage.input_tokens ?? 'unavailable'}`)
    console.info(`Output tokens: ${usage.output_tokens ?? 'unavailable'}`)
    console.info(`Total tokens: ${usage.total_tokens ?? 'unavailable'}`)
  }
}

function extractResponseText(responseBody) {
  if (typeof responseBody.output_text === 'string') return responseBody.output_text

  for (const output of responseBody.output || []) {
    for (const content of output.content || []) {
      if (content.type === 'output_text' && typeof content.text === 'string') {
        return content.text
      }
    }
  }
  return null
}

export async function generateRecommendationExplanations(
  recommendations,
  {
    apiKey = process.env.OPENAI_API_KEY,
    fetchImpl = globalThis.fetch,
    model = process.env.OPENAI_EXPLANATION_MODEL || 'gpt-5.6-luna',
    timeoutMs = 8000,
  } = {}
) {
  const fallbackRecommendations = withFallbackExplanations(recommendations)
  const useFallback = () => {
    logExplanationSource('deterministic fallback')
    return fallbackRecommendations
  }
  if (!apiKey || typeof fetchImpl !== 'function') return useFallback()

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const evidence = recommendations.map((recommendation) => ({
      rank_position: recommendation.rank_position,
      course_name: recommendation.course_name,
      cluster_category: recommendation.cluster_category,
      match_score: recommendation.match_score,
      strongest_alignment_factors: strongestFactors(recommendation.score_breakdown),
      area_to_develop: developmentFactor(recommendation.score_breakdown),
    }))

    const response = await fetchImpl('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        instructions: 'Write a friendly, encouraging, professional, and easy-to-understand explanation of 2 to 4 concise sentences for each already-ranked LearnMatch recommendation. Personalize it only from the supplied weighted-scoring evidence. Mention the strongest one or two alignment factors naturally without mechanically repeating every percentage, and when useful mention one area the student can continue developing. Never change or question the rank or score, invent assessment answers or other information, guarantee success, use slang or exaggerated praise, call the student a perfect fit, claim that AI selected the course, or add academic or career requirements. Clearly frame each narrative as an interpretation of a course selected by LearnMatch weighted scoring.',
        input: JSON.stringify(evidence),
        max_output_tokens: MAX_OUTPUT_TOKENS,
        text: {
          format: {
            type: 'json_schema',
            name: 'recommendation_explanations',
            strict: true,
            schema: {
              type: 'object',
              additionalProperties: false,
              properties: {
                explanations: {
                  type: 'array',
                  minItems: recommendations.length,
                  maxItems: recommendations.length,
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      rank_position: { type: 'integer' },
                      narrative: { type: 'string', minLength: 1, maxLength: 600 },
                    },
                    required: ['rank_position', 'narrative'],
                  },
                },
              },
              required: ['explanations'],
            },
          },
        },
      }),
      signal: controller.signal,
    })

    if (!response.ok) return useFallback()

    const responseBody = await response.json()
    const responseText = extractResponseText(responseBody)
    if (!responseText) return useFallback()

    const parsed = JSON.parse(responseText)
    const narrativesByRank = new Map(
      parsed.explanations.map(({ rank_position, narrative }) => [rank_position, narrative.trim()])
    )
    if (
      narrativesByRank.size !== recommendations.length ||
      recommendations.some(({ rank_position }) => !narrativesByRank.get(rank_position))
    ) {
      return useFallback()
    }

    const explainedRecommendations = recommendations.map((recommendation) => ({
      ...recommendation,
      ai_narrative: narrativesByRank.get(recommendation.rank_position),
    }))
    logExplanationSource('OpenAI')
    logOpenAIUsage(responseBody.model || model, responseBody.usage)
    return explainedRecommendations
  } catch {
    return useFallback()
  } finally {
    clearTimeout(timeout)
  }
}
