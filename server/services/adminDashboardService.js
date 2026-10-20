import { assessmentStatusSql } from './assessmentCompletionService.js'
import { PERSONAL_FACTOR_KEYS } from '../shared/personalFactors.js'

function toSqlDate(date) {
  return date.toISOString().slice(0, 19).replace('T', ' ')
}

function getRegistrationMonths(now, count = 6) {
  const currentMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  return Array.from({ length: count }, (_, index) => {
    const month = new Date(Date.UTC(currentMonth.getUTCFullYear(), currentMonth.getUTCMonth() - (count - 1 - index), 1))
    return {
      key: month.toISOString().slice(0, 7),
      label: new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(month),
      count: 0,
    }
  })
}

const COMPLETION_STATUS_SQL = assessmentStatusSql({
  profileCount: 'profile_stats.profile_count',
  interestCount: 'interest_stats.interest_count',
  skillCount: 'skill_stats.skill_count',
  personalityCount: 'personality_stats.personality_count',
  completedAttemptCount: "(SELECT COUNT(*) FROM ASSESSMENT_ATTEMPT attempt WHERE attempt.user_id = account.user_id AND attempt.status = 'COMPLETED')",
})

// Match personalFactorResponses: No is disclosed; Yes requires impact 1–4.
// Missing/invalid metadata falls back only to unambiguous historical impacts 2–4.
// BINARY preserves the shared helper's case-sensitive answer interpretation.
const EFFECTIVE_PERSONAL_FACTORS_SQL = `(${PERSONAL_FACTOR_KEYS.map((factor) => `
  CASE BINARY JSON_UNQUOTE(JSON_EXTRACT(metadata.answers, '$.${factor}'))
    WHEN 'no' THEN 1
    WHEN 'yes' THEN COALESCE(profile.factor_${factor}_impact IN (1, 2, 3, 4), 0)
    WHEN 'unknown' THEN 0
    WHEN 'legacy_unknown' THEN 0
    ELSE COALESCE(profile.factor_${factor}_impact IN (2, 3, 4), 0)
  END`).join(' OR ')}
)`

// The shared helper also accepts JSON-encoded strings. Decode them for reporting
// only, and evaluate the terminal value once (never an intermediate fallback).
const ASSESSMENT_STATES_CTE = `
  WITH RECURSIVE personal_factor_metadata AS (
    SELECT profile_id, personal_factor_answers AS answers FROM PROFILE
    UNION ALL
    SELECT profile_id, JSON_EXTRACT(JSON_UNQUOTE(answers), '$')
    FROM personal_factor_metadata
    WHERE JSON_TYPE(answers) = 'STRING' AND JSON_VALID(JSON_UNQUOTE(answers))
  ),
  profile_stats AS (
    SELECT user_id, COUNT(*) AS profile_count FROM PROFILE GROUP BY user_id
  ),
  interest_stats AS (
    SELECT user_id, COUNT(*) AS interest_count FROM INTEREST_RESPONSE GROUP BY user_id
  ),
  skill_stats AS (
    SELECT user_id, COUNT(*) AS skill_count FROM SKILL_RESPONSE GROUP BY user_id
  ),
  personality_stats AS (
    SELECT user_id, COUNT(*) AS personality_count FROM PERSONALITY_ASSESSMENT GROUP BY user_id
  ),
  personal_factor_stats AS (
    SELECT user_id, MAX(${EFFECTIVE_PERSONAL_FACTORS_SQL}) AS has_personal_factors
    FROM PROFILE profile
    JOIN personal_factor_metadata metadata ON metadata.profile_id = profile.profile_id
    WHERE NOT (COALESCE(JSON_TYPE(metadata.answers) = 'STRING', 0)
      AND JSON_VALID(JSON_UNQUOTE(metadata.answers)))
    GROUP BY user_id
  ),
  assessment_states AS (
    SELECT account.user_id, ${COMPLETION_STATUS_SQL} AS status
    FROM USER_ACCOUNT account
    LEFT JOIN profile_stats ON profile_stats.user_id = account.user_id
    LEFT JOIN interest_stats ON interest_stats.user_id = account.user_id
    LEFT JOIN skill_stats ON skill_stats.user_id = account.user_id
    LEFT JOIN personality_stats ON personality_stats.user_id = account.user_id
  )`

const SUMMARY_QUERY = `${ASSESSMENT_STATES_CTE}
  SELECT COUNT(*) AS registered_students,
         COALESCE(SUM(state.status = 'Completed'), 0) AS completed_assessments,
         COALESCE(SUM(
           state.status = 'Completed' AND COALESCE(factors.has_personal_factors, 0) = 1
         ), 0)
           AS completed_with_personal_factors
  FROM assessment_states state
  LEFT JOIN personal_factor_stats factors ON factors.user_id = state.user_id`

const COURSE_POPULARITY_QUERY = `
  WITH ranked_recommendations AS (
    SELECT recommendation_id, user_id,
           ROW_NUMBER() OVER (
             PARTITION BY user_id
             ORDER BY generated_at DESC, recommendation_id DESC
           ) AS snapshot_rank
    FROM RECOMMENDATION
  )
  SELECT course.course_id, course.course_code, course.course_name,
         COUNT(*) AS appearance_count
  FROM ranked_recommendations recommendation
  JOIN RECOMMENDATION_ITEM item
    ON item.recommendation_id = recommendation.recommendation_id
   AND item.rank_position BETWEEN 1 AND 3
  JOIN COURSE course ON course.course_id = item.course_id
  WHERE recommendation.snapshot_rank = 1
  GROUP BY course.course_id, course.course_code, course.course_name
  ORDER BY appearance_count DESC, course.course_name ASC
  LIMIT ?`

function roundOneDecimal(value) {
  return Math.round(Number(value) * 10) / 10
}

export async function getAdminDashboard(database, {
  now = new Date(), courseLimit = 8, recentUserLimit = 5,
} = {}) {
  const registrationMonths = getRegistrationMonths(now)
  const registrationStart = new Date(`${registrationMonths[0].key}-01T00:00:00.000Z`)
  const registrationEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
  const safeCourseLimit = Math.max(1, Math.min(Number(courseLimit) || 8, 20))
  const safeRecentUserLimit = Math.max(1, Math.min(Number(recentUserLimit) || 5, 20))

  const [[summaryRows], [registrationRows], [courseRows], [recentUserRows]] = await Promise.all([
    database.query(SUMMARY_QUERY),
    database.query(
      `SELECT DATE_FORMAT(created_at, '%Y-%m') AS month_key, COUNT(*) AS registration_count
       FROM USER_ACCOUNT
       WHERE created_at >= ? AND created_at < ?
       GROUP BY DATE_FORMAT(created_at, '%Y-%m')
       ORDER BY month_key ASC`,
      [toSqlDate(registrationStart), toSqlDate(registrationEnd)]
    ),
    database.query(COURSE_POPULARITY_QUERY, [safeCourseLimit]),
    database.query(
      `SELECT user_id, username, created_at
       FROM USER_ACCOUNT
       WHERE created_at IS NOT NULL
       ORDER BY created_at DESC, user_id DESC
       LIMIT ?`,
      [safeRecentUserLimit]
    ),
  ])

  const summary = summaryRows[0] || {}
  const registeredStudents = Number(summary.registered_students || 0)
  const completedAssessments = Number(summary.completed_assessments || 0)
  const registrationsByMonth = new Map(
    registrationRows.map((row) => [row.month_key, Number(row.registration_count)])
  )
  const coursePopularity = courseRows.map((row) => ({
    courseId: Number(row.course_id),
    courseCode: row.course_code,
    courseName: row.course_name,
    count: Number(row.appearance_count),
  }))

  return {
    summary: {
      registeredStudents,
      completedAssessments,
      consideredPersonalFactors: Number(summary.completed_with_personal_factors || 0),
      assessmentCompletionRate: registeredStudents === 0
        ? 0
        : roundOneDecimal((completedAssessments / registeredStudents) * 100),
    },
    registrationTrend: registrationMonths.map((month) => ({
      ...month,
      count: registrationsByMonth.get(month.key) || 0,
    })),
    coursePopularity,
    topRecommendedCourses: coursePopularity.slice(0, 5),
    recentlyRegisteredUsers: recentUserRows.map((row) => ({
      userId: Number(row.user_id),
      username: row.username,
      registeredAt: row.created_at,
    })),
  }
}
