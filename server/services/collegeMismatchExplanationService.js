const DIMENSIONS = [
  'interest and enjoyment',
  'perceived skill fit and workload',
  'available support and resources',
  'career motivation',
  'intention to continue and overall satisfaction',
]

function lowestDimension(answers) {
  return answers
    .map((answer) => ({
      dimension: DIMENSIONS[answer.question_number - 1],
      score: answer.score,
    }))
    .sort((left, right) => left.score - right.score)[0]
}

export function buildMismatchFallback({ status, alignmentPercent, answers, gwa }) {
  const lowest = lowestDimension(answers)
  const gwaContext = gwa === null
    ? ''
    : ` Your recorded GWA is ${gwa}, which is considered together with your check-in responses.`

  if (status === 'On Track') {
    return {
      feedback: `Your ${alignmentPercent}% alignment result suggests that your course experience is generally matching your interests, abilities, and goals.${gwaContext}`,
      recommendation: 'Keep using the study habits and support systems that are working for you, and continue checking in honestly as the semester progresses.',
    }
  }
  if (status === 'Monitor') {
    return {
      feedback: `Your ${alignmentPercent}% alignment result shows a mixed experience that is worth monitoring.${gwaContext} Your lowest-rated area was ${lowest.dimension}.`,
      recommendation: `Consider one practical step to strengthen ${lowest.dimension}, such as speaking with an instructor, adviser, or trusted classmate and reviewing your progress at the next check-in.`,
    }
  }
  return {
    feedback: `Your ${alignmentPercent}% alignment result suggests that several parts of your current course experience may need support.${gwaContext} Your lowest-rated area was ${lowest.dimension}.`,
    recommendation: `You do not have to make a major decision immediately. Start by discussing ${lowest.dimension} with an academic adviser or trusted support person and identify one manageable next step.`,
  }
}

function extractResponseText(responseBody) {
  if (typeof responseBody.output_text === 'string') return responseBody.output_text
  for (const output of responseBody.output || []) {
    for (const content of output.content || []) {
      if (content.type === 'output_text' && typeof content.text === 'string') return content.text
    }
  }
  return null
}

export async function generateMismatchExplanation(
  result,
  {
    apiKey = process.env.OPENAI_API_KEY,
    model = process.env.OPENAI_EXPLANATION_MODEL || 'gpt-5.6-luna',
    fetchImpl = globalThis.fetch,
    timeoutMs = 8000,
  } = {}
) {
  const fallback = buildMismatchFallback(result)
  if (result.status === 'On Track' || !apiKey || typeof fetchImpl !== 'function') return fallback

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const evidence = {
      deterministic_status: result.status,
      alignment_percent: result.alignmentPercent,
      phase: result.phase,
      gwa: result.gwa,
      dimension_scores: result.answers.map((answer) => ({
        dimension: DIMENSIONS[answer.question_number - 1],
        score: answer.score,
      })),
    }
    const response = await fetchImpl('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        instructions: 'Explain the supplied deterministic college-alignment result in friendly, supportive, concise, professional, and non-alarmist language. Do not diagnose the student, override or change the status, invent information, guarantee success, or tell the student to leave or change courses. Give one practical and manageable next step. Return only the requested structured fields.',
        input: JSON.stringify(evidence),
        max_output_tokens: 350,
        text: {
          format: {
            type: 'json_schema',
            name: 'college_alignment_explanation',
            strict: true,
            schema: {
              type: 'object',
              additionalProperties: false,
              properties: {
                feedback: { type: 'string', minLength: 1, maxLength: 500 },
                recommendation: { type: 'string', minLength: 1, maxLength: 500 },
              },
              required: ['feedback', 'recommendation'],
            },
          },
        },
      }),
      signal: controller.signal,
    })
    if (!response.ok) return fallback
    const body = await response.json()
    const text = extractResponseText(body)
    if (!text) return fallback
    const parsed = JSON.parse(text)
    if (!parsed.feedback?.trim() || !parsed.recommendation?.trim()) return fallback
    return {
      feedback: parsed.feedback.trim(),
      recommendation: parsed.recommendation.trim(),
    }
  } catch {
    return fallback
  } finally {
    clearTimeout(timeout)
  }
}
