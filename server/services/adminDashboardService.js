import { assessmentStatusSql } from './assessmentCompletionService.js'

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
})

const EFFECTIVE_PERSONAL_FACTORS_SQL = `(
  COALESCE(profile.factor_physical, 0) = 1
  OR COALESCE(profile.factor_health, 0) = 1
  OR COALESCE(profile.factor_financial, 0) = 1
  OR COALESCE(profile.factor_family, 0) = 1
  OR COALESCE(profile.factor_working_student, 0) = 1
  OR (
    profile.factor_others_classification_status = 'MATCHED'
    AND (
      JSON_CONTAINS(profile.factor_others_classification, JSON_QUOTE('factor_physical'))
      OR JSON_CONTAINS(profile.factor_others_classification, JSON_QUOTE('factor_health'))
      OR JSON_CONTAINS(profile.factor_others_classification, JSON_QUOTE('factor_financial'))
      OR JSON_CONTAINS(profile.factor_others_classification, JSON_QUOTE('factor_family'))
      OR JSON_CONTAINS(profile.factor_others_classification, JSON_QUOTE('factor_working_student'))
    )
  )
)`

const ASSESSMENT_STATES_CTE = `
  WITH profile_stats AS (
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
