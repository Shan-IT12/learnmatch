import { SKILL_DOMAINS } from '../config/recommendationConfig.js'
import { assessmentStatusSql } from './assessmentCompletionService.js'

export const MBTI_TYPES = Object.freeze([
  'ISTJ', 'ISFJ', 'INFJ', 'INTJ',
  'ISTP', 'ISFP', 'INFP', 'INTP',
  'ESTP', 'ESFP', 'ENFP', 'ENTP',
  'ESTJ', 'ESFJ', 'ENFJ', 'ENTJ',
])

const sqlList = (values) => values.map((value) => `'${value}'`).join(', ')

const COMPLETION_STATUS_SQL = assessmentStatusSql({
  profileCount: 'profile_stats.profile_count',
  interestCount: 'interest_stats.interest_count',
  skillCount: 'skill_stats.skill_count',
  personalityCount: 'personality_stats.personality_count',
})

const SKILL_DOMAIN_REQUIREMENTS_SQL = SKILL_DOMAINS
  .map((domain) => `SUM(dimension = '${domain}') = 5`)
  .join('\n       AND ')

const COMPLETION_QUERY = `
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
  assessment_states AS (
    SELECT account.user_id, ${COMPLETION_STATUS_SQL} AS status
    FROM USER_ACCOUNT account
    LEFT JOIN profile_stats ON profile_stats.user_id = account.user_id
    LEFT JOIN interest_stats ON interest_stats.user_id = account.user_id
    LEFT JOIN skill_stats ON skill_stats.user_id = account.user_id
    LEFT JOIN personality_stats ON personality_stats.user_id = account.user_id
  )
  SELECT COUNT(*) AS total_users,
         COALESCE(SUM(status = 'Completed'), 0) AS completed,
         COALESCE(SUM(status = 'In Progress'), 0) AS in_progress,
         COALESCE(SUM(status = 'Not Started'), 0) AS not_started,
         (SELECT COUNT(DISTINCT recommendation.user_id)
          FROM RECOMMENDATION recommendation
          JOIN RECOMMENDATION_ITEM item
            ON item.recommendation_id = recommendation.recommendation_id
           AND item.rank_position BETWEEN 1 AND 3) AS recommendations_generated
  FROM assessment_states`

const AVERAGE_SKILLS_QUERY = `
  WITH ranked_skill_responses AS (
    SELECT response.user_id, response.is_correct, question.dimension,
           ROW_NUMBER() OVER (
             PARTITION BY response.user_id
             ORDER BY response.skill_response_id DESC
           ) AS response_rank
    FROM SKILL_RESPONSE response
    JOIN QUESTION question ON question.question_id = response.question_id
  ),
  latest_skill_responses AS (
    SELECT user_id, is_correct, dimension
    FROM ranked_skill_responses
    WHERE response_rank <= 30
  ),
  valid_skill_students AS (
    SELECT user_id
    FROM latest_skill_responses
    GROUP BY user_id
    HAVING COUNT(*) = 30
       AND COUNT(DISTINCT dimension) = 6
       AND MIN(is_correct) >= 0
       AND MAX(is_correct) <= 1
       AND ${SKILL_DOMAIN_REQUIREMENTS_SQL}
  ),
  student_domain_scores AS (
    SELECT response.user_id, response.dimension,
           SUM(response.is_correct) / COUNT(*) * 100 AS score_percent
    FROM latest_skill_responses response
    JOIN valid_skill_students student ON student.user_id = response.user_id
    GROUP BY response.user_id, response.dimension
  )
  SELECT dimension, AVG(score_percent) AS average_score,
         COUNT(*) AS student_count
  FROM student_domain_scores
  GROUP BY dimension`

const PERSONALITY_QUERY = `
  WITH ranked_personality AS (
    SELECT user_id, mbti_type,
           ROW_NUMBER() OVER (
             PARTITION BY user_id
             ORDER BY taken_at DESC, assessment_id DESC
           ) AS result_rank
    FROM PERSONALITY_ASSESSMENT
    WHERE mbti_type IN (${sqlList(MBTI_TYPES)})
  )
  SELECT mbti_type, COUNT(*) AS student_count
  FROM ranked_personality
  WHERE result_rank = 1
  GROUP BY mbti_type
  ORDER BY student_count DESC, mbti_type ASC`

const TOP_COURSES_QUERY = `
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
  LIMIT 5`

function roundOneDecimal(value) {
  return Math.round(Number(value) * 10) / 10
}

export async function getAdminAnalytics(database) {
  const [
    [completionRows],
    [skillRows],
    [personalityRows],
    [courseRows],
  ] = await Promise.all([
    database.query(COMPLETION_QUERY),
    database.query(AVERAGE_SKILLS_QUERY),
    database.query(PERSONALITY_QUERY),
    database.query(TOP_COURSES_QUERY),
  ])

  const completion = completionRows[0] || {}
  const totalUsers = Number(completion.total_users || 0)
  const completed = Number(completion.completed || 0)
  const inProgress = Number(completion.in_progress || 0)
  const notStarted = Number(completion.not_started || 0)

  const skillsByDomain = new Map(
    skillRows.map((row) => [row.dimension, {
      domain: row.dimension,
      averagePercent: roundOneDecimal(row.average_score),
      studentCount: Number(row.student_count),
    }])
  )

  return {
    summary: {
      totalUsers,
      completedAssessments: completed,
      assessmentCompletionRate: totalUsers === 0
        ? 0
        : roundOneDecimal((completed / totalUsers) * 100),
      recommendationsGenerated: Number(completion.recommendations_generated || 0),
    },
    averageSkillScores: SKILL_DOMAINS
      .filter((domain) => skillsByDomain.has(domain))
      .map((domain) => skillsByDomain.get(domain)),
    personalityDistribution: personalityRows.map((row) => ({
      type: row.mbti_type,
      count: Number(row.student_count),
    })),
    topRecommendedCourses: courseRows.map((row) => ({
      courseId: Number(row.course_id),
      courseCode: row.course_code,
      courseName: row.course_name,
      count: Number(row.appearance_count),
    })),
    assessmentCompletion: { completed, inProgress, notStarted },
  }
}
