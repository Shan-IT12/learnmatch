const DIMENSIONS = [
  'interest and enjoyment',
  'perceived skill fit and workload',
  'available support and resources',
  'career motivation',
  'intention to continue and overall satisfaction',
]

const EVERYDAY_DIMENSIONS = [
  { strength: 'you seem to enjoy what you’re studying', concern: 'enjoying what you’re studying', next: 'Pick one topic you enjoyed and one that felt less engaging. Talk them through with your instructor to see what you could try next.' },
  { strength: 'you seem to be keeping up with the coursework', concern: 'keeping up with the coursework', next: 'Choose one task you’re finding difficult and ask your instructor or a classmate to work through the first part with you.' },
  { strength: 'you seem to have support you can turn to', concern: 'getting the support you need', next: 'Think of one thing that would make studying easier, then ask your instructor or adviser where you can get that help.' },
  { strength: 'you can see a connection between your course and the career you want', concern: 'seeing how your course connects to the career you want', next: 'Look into one career connected to your course and compare its day-to-day work with what you’d like to do.' },
  { strength: 'you seem to feel good about choosing this course', concern: 'feeling good about your course choice', next: 'Write down one thing you like about your course and one concern. Bring those to a conversation with your adviser.' },
]

export function buildMismatchFallback({ status, answers }) {
  const rated = answers.filter(answer => EVERYDAY_DIMENSIONS[answer.question_number - 1])
    .map(answer => ({ ...EVERYDAY_DIMENSIONS[answer.question_number - 1], score: answer.score }))
    .sort((left, right) => left.score - right.score)
  const lowest = rated[0]
  const strongest = rated.at(-1)
  const opening = status === 'On Track'
    ? 'Your answers suggest your course is working well for you overall.'
    : status === 'Monitor'
      ? 'Your answers suggest your course experience feels mixed right now.'
      : 'Your answers suggest things haven’t been feeling easy in your course lately.'
  const strength = strongest?.score >= 4 ? ` One encouraging sign is that ${strongest.strength}.` : ''
  const concern = lowest?.score <= 3
    ? ` You ${lowest.score <= 2 ? 'seem to be having a harder time with' : 'may still feel unsure about'} ${lowest.concern}.`
    : ''
  return {
    feedback: `${opening}${strength}${concern}`,
    recommendation: lowest?.score <= 3
      ? lowest.next
      : 'Pick one study habit or source of support that’s been helping you, and make room for it again in your next study session.',
  }
}

function usableNarrative(value) {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= 500 &&
    !/current college alignment result|alignment level|perceived skill fit|available alignment measures|no gwa|gwa (?:was )?not provided|deterministic|dimension[_ ]scores|weighted scoring|\bWSM\b/i.test(value)
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
        instructions: 'Write like a warm, casual but respectful student guide, using the same conversational style as a personal course-fit explanation. Speak directly to the student using you and your, natural English and contractions. In feedback, write 2 to 3 concise sentences (around 40-65 words) connecting one or two actual check-in answers to what their course experience may feel like. Scores run from 1 (not true at all) to 5 (completely true): 4-5 can support a positive observation, 3 means unsure or neutral, and 1-2 suggests a difficulty. Do not call a low or neutral score a strength. If no answers support a strength, acknowledge the difficulty without inventing a positive trait. Use everyday phrases such as keeping up with coursework or getting the help you need, rather than dimension labels like perceived skill fit, alignment measures or overall satisfaction. Do not recite the status, percentage or phase already shown on the page. Do not mention absent GWA, missing data or calculation limitations. If GWA is present, do not infer its grading scale or that it proves ability, effort or failure. In recommendation, give one specific, manageable next step in 1 to 2 short sentences (around 20-40 words), tied to an answer where help could be useful; when all answers are positive, suggest maintaining something that is working. Do not repeat the feedback. Keep the supplied status and scores unchanged. Do not diagnose the student, invent interests, habits, circumstances, course subjects or career goals, guarantee success, minimize difficulties, or tell the student to leave or change courses. Avoid report-like openings, technical jargon, formal disclaimers, headings, lists, emojis and repeated boilerplate. Return only the requested structured fields.',
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
    if (!usableNarrative(parsed.feedback) || !usableNarrative(parsed.recommendation)) return fallback
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
