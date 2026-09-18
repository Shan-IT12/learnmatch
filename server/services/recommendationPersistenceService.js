import {
  RecommendationDataError,
  RecommendationInputError,
  getTopCourseRecommendations,
  toDisplayPercent,
} from './recommendationService.js'
import {
  buildDeterministicExplanation,
  generateRecommendationExplanations,
} from './recommendationExplanationService.js'

function toNormalizedScore(displayPercent, label) {
  const score = Number(displayPercent) / 100
  if (!Number.isFinite(score) || score < 0 || score > 1) {
    throw new RecommendationDataError(`${label} must be a percentage from 0 to 100.`)
  }
  return Number(score.toFixed(4))
}

function shapeSavedRecommendation(row) {
  const recommendation = {
    rank_position: row.rank_position,
    course_id: row.course_id,
    course_code: row.course_code,
    course_name: row.course_name,
    course_abbreviation: row.course_abbreviation,
    cluster_category: row.cluster_category,
    match_score: toDisplayPercent(Number(row.match_score)),
    score_breakdown: {
      skill_match: toDisplayPercent(Number(row.skill_match)),
      interest_match: toDisplayPercent(Number(row.interest_match)),
      personality_match: toDisplayPercent(Number(row.personality_match)),
      personal_factor_match: toDisplayPercent(Number(row.personal_factor_match)),
    },
    ai_narrative: row.ai_narrative ?? null,
  }
  recommendation.ai_narrative ||= buildDeterministicExplanation(recommendation)
  return recommendation
}

export function validateTopThreeRecommendations(recommendations) {
  if (!Array.isArray(recommendations) || recommendations.length !== 3) {
    throw new RecommendationDataError('A recommendation snapshot must contain exactly three courses.')
  }

  const sorted = [...recommendations].sort((first, second) => first.rank_position - second.rank_position)
  const ranks = sorted.map(({ rank_position }) => rank_position)
  if (ranks.join(',') !== '1,2,3') {
    throw new RecommendationDataError('Recommendation ranks must be exactly 1, 2, and 3.')
  }

  const courseCodes = sorted.map(({ course_code }) => course_code)
  if (courseCodes.some((courseCode) => typeof courseCode !== 'string' || !courseCode)) {
    throw new RecommendationDataError('Every recommended course must have a stable course_code.')
  }
  if (new Set(courseCodes).size !== 3) {
    throw new RecommendationDataError('A recommendation snapshot cannot contain duplicate courses.')
  }

  for (const recommendation of sorted) {
    toNormalizedScore(recommendation.match_score, 'Match score')
    toNormalizedScore(recommendation.score_breakdown?.skill_match, 'Skill match')
    toNormalizedScore(recommendation.score_breakdown?.interest_match, 'Interest match')
    toNormalizedScore(recommendation.score_breakdown?.personality_match, 'Personality match')
    toNormalizedScore(recommendation.score_breakdown?.personal_factor_match, 'Personal factor match')
  }

  return sorted
}

async function getPersonalityAssessmentId(database, userId) {
  const [rows] = await database.query(
    `SELECT assessment_id
     FROM PERSONALITY_ASSESSMENT
     WHERE user_id = ?
     ORDER BY assessment_id DESC
     LIMIT 1`,
    [userId]
  )
  return rows[0]?.assessment_id ?? null
}

async function getRecommendationHeader(database, userId, assessmentId) {
  const [rows] = await database.query(
    `SELECT recommendation_id, assessment_id, generated_at
     FROM RECOMMENDATION
     WHERE user_id = ? AND assessment_id = ?
     LIMIT 1`,
    [userId, assessmentId]
  )
  return rows[0] ?? null
}

async function getRecommendationItems(database, recommendationId, activeOnly = false) {
  const [rows] = await database.query(
    `SELECT ri.rank_position, ri.match_score, ri.skill_match, ri.interest_match,
            ri.personality_match, ri.personal_factor_match, ri.ai_narrative,
            c.course_id, c.course_code, c.course_name, c.course_abbreviation,
            c.cluster_category
     FROM RECOMMENDATION_ITEM ri
     JOIN COURSE c ON c.course_id = ri.course_id
     WHERE ri.recommendation_id = ?${activeOnly ? ' AND c.is_active = 1' : ''}
     ORDER BY ri.rank_position ASC`,
    [recommendationId]
  )
  return rows.map(shapeSavedRecommendation)
}

export async function getSavedRecommendationForAssessment(database, userId, assessmentId) {
  const header = await getRecommendationHeader(database, userId, assessmentId)
  if (!header) return null

  const recommendations = await getRecommendationItems(database, header.recommendation_id)
  validateTopThreeRecommendations(recommendations)
  return { ...header, recommendations }
}

export async function getLatestSavedRecommendations(database, userId) {
  const [headers] = await database.query(
    `SELECT recommendation_id, assessment_id, generated_at
     FROM RECOMMENDATION
     WHERE user_id = ?
     ORDER BY generated_at DESC, recommendation_id DESC
     LIMIT 1`,
    [userId]
  )
  const header = headers[0]
  if (!header) return { recommendation: null, recommendations: [] }

  const recommendations = await getRecommendationItems(database, header.recommendation_id, true)
  return { recommendation: header, recommendations }
}

export async function saveRecommendationSnapshot(pool, userId, assessmentId, recommendations) {
  const sortedRecommendations = validateTopThreeRecommendations(recommendations)
  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()

    const existing = await getRecommendationHeader(connection, userId, assessmentId)
    if (existing) {
      await connection.rollback()
      return { created: false }
    }

    const courseCodes = sortedRecommendations.map(({ course_code }) => course_code)
    const placeholders = courseCodes.map(() => '?').join(', ')
    const [courseRows] = await connection.query(
      `SELECT course_id, course_code
       FROM COURSE
       WHERE course_code IN (${placeholders})`,
      courseCodes
    )
    const courseIdsByCode = new Map(courseRows.map((course) => [course.course_code, course.course_id]))
    if (courseIdsByCode.size !== 3 || courseCodes.some((courseCode) => !courseIdsByCode.has(courseCode))) {
      throw new RecommendationDataError('A recommended course could not be mapped to the canonical COURSE table.')
    }

    const [result] = await connection.query(
      `INSERT INTO RECOMMENDATION (user_id, assessment_id)
       VALUES (?, ?)`,
      [userId, assessmentId]
    )

    for (const recommendation of sortedRecommendations) {
      await connection.query(
        `INSERT INTO RECOMMENDATION_ITEM
          (recommendation_id, course_id, match_score, skill_match, interest_match,
           personality_match, personal_factor_match, ai_narrative, rank_position)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          result.insertId,
          courseIdsByCode.get(recommendation.course_code),
          toNormalizedScore(recommendation.match_score, 'Match score'),
          toNormalizedScore(recommendation.score_breakdown.skill_match, 'Skill match'),
          toNormalizedScore(recommendation.score_breakdown.interest_match, 'Interest match'),
          toNormalizedScore(recommendation.score_breakdown.personality_match, 'Personality match'),
          toNormalizedScore(recommendation.score_breakdown.personal_factor_match, 'Personal factor match'),
          recommendation.ai_narrative,
          recommendation.rank_position,
        ]
      )
    }

    await connection.commit()
    return { created: true, recommendationId: result.insertId }
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

export async function getOrCreateSavedRecommendations(
  pool,
  userId,
  generateRecommendations = getTopCourseRecommendations,
  explainRecommendations = generateRecommendationExplanations
) {
  const assessmentId = await getPersonalityAssessmentId(pool, userId)
  if (!assessmentId) {
    throw new RecommendationInputError(
      'A completed personality assessment is required to generate recommendations.'
    )
  }

  const saved = await getSavedRecommendationForAssessment(pool, userId, assessmentId)
  if (saved) return saved.recommendations

  const generated = await generateRecommendations(pool, userId)
  const explained = await explainRecommendations(generated)
  const narrativesByRank = new Map(
    explained.map(({ rank_position, ai_narrative }) => [rank_position, ai_narrative])
  )
  const recommendationsWithExplanations = generated.map((recommendation) => ({
    ...recommendation,
    ai_narrative: narrativesByRank.get(recommendation.rank_position) ||
      buildDeterministicExplanation(recommendation),
  }))

  try {
    const persistence = await saveRecommendationSnapshot(
      pool,
      userId,
      assessmentId,
      recommendationsWithExplanations
    )
    if (persistence.created) return recommendationsWithExplanations
  } catch (error) {
    if (error.code !== 'ER_DUP_ENTRY') throw error
  }

  const concurrentlySaved = await getSavedRecommendationForAssessment(pool, userId, assessmentId)
  if (!concurrentlySaved) {
    throw new RecommendationDataError('The recommendation snapshot could not be retrieved after persistence.')
  }
  return concurrentlySaved.recommendations
}
