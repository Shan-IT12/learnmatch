const EXPECTED_DISTRIBUTION = Object.freeze({
  EI: Object.freeze({ E: 5, I: 5 }),
  SN: Object.freeze({ S: 5, N: 5 }),
  TF: Object.freeze({ T: 5, F: 5 }),
  JP: Object.freeze({ J: 5, P: 5 }),
})

const REQUIRED_ANSWER_COUNT = 40

function normalizeRating(rating) {
  if (typeof rating !== 'number' && typeof rating !== 'string') return null
  if (typeof rating === 'string' && !/^[1-5]$/.test(rating)) return null

  const normalized = Number(rating)
  return Number.isInteger(normalized) && normalized >= 1 && normalized <= 5
    ? normalized
    : null
}

export function validatePersonalitySubmission(answers) {
  if (!Array.isArray(answers)) {
    return { valid: false, message: 'answers must be an array' }
  }

  if (answers.length !== REQUIRED_ANSWER_COUNT) {
    return { valid: false, message: `Exactly ${REQUIRED_ANSWER_COUNT} answers are required.` }
  }

  const counts = Object.fromEntries(
    Object.entries(EXPECTED_DISTRIBUTION).map(([dimension, poles]) => [
      dimension,
      Object.fromEntries(Object.keys(poles).map((pole) => [pole, 0])),
    ])
  )
  const normalizedAnswers = []

  for (const answer of answers) {
    if (!answer || typeof answer !== 'object' || Array.isArray(answer)) {
      return { valid: false, message: 'Each answer must be a valid object.' }
    }

    const { dimension, pole, rating } = answer
    if (!Object.hasOwn(answer, 'dimension') || !Object.hasOwn(answer, 'pole') || !Object.hasOwn(answer, 'rating')) {
      return { valid: false, message: 'Each answer must include dimension, pole, and rating.' }
    }

    if (!EXPECTED_DISTRIBUTION[dimension] || !Object.hasOwn(EXPECTED_DISTRIBUTION[dimension], pole)) {
      return { valid: false, message: 'One or more answers has an invalid dimension or pole.' }
    }

    const normalizedRating = normalizeRating(rating)
    if (normalizedRating === null) {
      return { valid: false, message: 'Ratings must be integers from 1 through 5.' }
    }

    counts[dimension][pole] += 1
    normalizedAnswers.push({ dimension, pole, rating: normalizedRating })
  }

  for (const [dimension, poles] of Object.entries(EXPECTED_DISTRIBUTION)) {
    for (const [pole, expectedCount] of Object.entries(poles)) {
      if (counts[dimension][pole] !== expectedCount) {
        return { valid: false, message: 'Answers must match the expected personality assessment structure.' }
      }
    }
  }

  return { valid: true, answers: normalizedAnswers }
}
