export const PERSONAL_FACTOR_TEXT_MAX_LENGTH = 500

export const PERSONAL_FACTOR_CATEGORIES = Object.freeze([
  'factor_physical',
  'factor_health',
  'factor_financial',
  'factor_family',
  'factor_distance',
  'factor_working_student',
])

export const PERSONAL_FACTOR_CLASSIFICATION_STATUSES = Object.freeze([
  'MATCHED',
  'AMBIGUOUS',
  'UNMATCHED',
  'UNAVAILABLE',
])

const categorySet = new Set(PERSONAL_FACTOR_CATEGORIES)
const statusSet = new Set(PERSONAL_FACTOR_CLASSIFICATION_STATUSES)
const unavailable = Object.freeze({ status: 'UNAVAILABLE', categories: Object.freeze([]) })

export function logPersonalFactorClassification(
  result,
  { reused = false, environment = process.env.NODE_ENV, logger = console } = {}
) {
  if (environment !== 'development') return

  if (reused) {
    logger.info('[PersonalFactorClassifier] Reused stored classification')
  } else if (result.status === 'UNAVAILABLE') {
    logger.info('[PersonalFactorClassifier] Classification unavailable')
  } else {
    logger.info('[PersonalFactorClassifier] Classification completed')
  }

  if (result.status !== 'UNAVAILABLE') logger.info(`Status: ${result.status}`)
  logger.info(`Matched categories: ${result.categories.length ? result.categories.join(', ') : 'none'}`)
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

export function normalizePersonalFactorText(value) {
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'string') {
    throw new TypeError('Other personal factor must be text.')
  }

  const normalized = value.trim()
  if (!normalized) return null
  if (normalized.length > PERSONAL_FACTOR_TEXT_MAX_LENGTH) {
    throw new RangeError(
      `Other personal factor must be ${PERSONAL_FACTOR_TEXT_MAX_LENGTH} characters or fewer.`
    )
  }
  return normalized
}

export function validatePersonalFactorClassification(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return unavailable
  const { status, categories } = value
  if (!statusSet.has(status)) return unavailable
  if (!Array.isArray(categories) || categories.length > PERSONAL_FACTOR_CATEGORIES.length) {
    return unavailable
  }

  if (status === 'MATCHED') {
    if (
      categories.length === 0
      || categories.some((category) => !categorySet.has(category))
      || new Set(categories).size !== categories.length
    ) return unavailable
    return { status, categories: [...categories] }
  }

  return categories.length === 0 ? { status, categories: [] } : unavailable
}

export function parseStoredPersonalFactorCategories(value) {
  if (Array.isArray(value)) return value
  if (typeof value !== 'string') return null
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function isReusablePersonalFactorClassification(status, storedCategories) {
  if (!['MATCHED', 'AMBIGUOUS', 'UNMATCHED'].includes(status)) return false
  const categories = parseStoredPersonalFactorCategories(storedCategories)
  if (!categories) return false
  return validatePersonalFactorClassification({ status, categories }).status === status
}

export async function classifyPersonalFactorText(
  value,
  {
    apiKey = process.env.OPENAI_API_KEY,
    model = process.env.OPENAI_CLASSIFICATION_MODEL
      || process.env.OPENAI_EXPLANATION_MODEL
      || 'gpt-5.6-luna',
    fetchImpl = globalThis.fetch,
    timeoutMs = 8000,
  } = {}
) {
  let text
  try {
    text = normalizePersonalFactorText(value)
  } catch {
    return unavailable
  }
  if (!text) return { status: null, categories: [] }
  const finish = (result) => {
    logPersonalFactorClassification(result)
    return result
  }
  if (!apiKey || typeof fetchImpl !== 'function') return finish(unavailable)

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetchImpl('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        instructions: `Evaluate the student's full custom personal-factor paragraph in one request. It may be English, Filipino/Tagalog, Taglish, another language, or mixed-language. Classify its semantic meaning without translating, rewriting, summarizing, or inferring circumstances that were not expressed. Return every clearly expressed applicable category from this closed list: factor_physical for physical or mobility limitations; factor_health for health or medical needs; factor_financial for financial constraints; factor_family for family caregiving or obligations; factor_distance for distance or commute difficulty; factor_working_student for employment while studying. Return MATCHED with one or more categories when factors are clearly expressed; multiple clear factors are not ambiguous. Return AMBIGUOUS with an empty array only when meaning cannot be mapped reliably. Return UNMATCHED with an empty array when no category fits. Never create categories, scores, recommendations, course advice, or explanations.`,
        input: text,
        max_output_tokens: 80,
        text: {
          format: {
            type: 'json_schema',
            name: 'personal_factor_classification',
            strict: true,
            schema: {
              type: 'object',
              additionalProperties: false,
              properties: {
                status: { type: 'string', enum: ['MATCHED', 'AMBIGUOUS', 'UNMATCHED'] },
                categories: {
                  type: 'array',
                  minItems: 0,
                  maxItems: PERSONAL_FACTOR_CATEGORIES.length,
                  items: { type: 'string', enum: PERSONAL_FACTOR_CATEGORIES },
                },
              },
              required: ['status', 'categories'],
            },
          },
        },
      }),
      signal: controller.signal,
    })

    if (!response.ok) return finish(unavailable)
    const responseText = extractResponseText(await response.json())
    if (!responseText) return finish(unavailable)
    return finish(validatePersonalFactorClassification(JSON.parse(responseText)))
  } catch {
    return finish(unavailable)
  } finally {
    clearTimeout(timeout)
  }
}
