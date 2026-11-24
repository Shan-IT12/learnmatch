import { SKILL_DOMAINS } from '../config/recommendationConfig.js'
import { assessmentStatusSql } from './assessmentCompletionService.js'
import { ALIGNMENT_RULES } from './collegeTrackingService.js'
import { getEnrollmentVerificationSummary } from './enrollmentProofService.js'

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
  completedAttemptCount: "(SELECT COUNT(*) FROM ASSESSMENT_ATTEMPT attempt WHERE attempt.user_id = account.user_id AND attempt.status = 'COMPLETED')",
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

// Count retained Top 3 results across every assessment snapshot, not just the
// latest per student. Refreshes replace items, so this is not an event history.
const ALL_COURSES_QUERY = `
  SELECT course.course_id, course.course_code, course.course_name,
         COUNT(*) AS appearance_count
  FROM RECOMMENDATION recommendation
  JOIN RECOMMENDATION_ITEM item
    ON item.recommendation_id = recommendation.recommendation_id
   AND item.rank_position BETWEEN 1 AND 3
  JOIN COURSE course ON course.course_id = item.course_id
  GROUP BY course.course_id, course.course_code, course.course_name
  ORDER BY appearance_count DESC, course.course_name ASC, course.course_id ASC`

const ASSESSMENT_MODE_QUERY = `
  WITH latest_completed_attempt AS (
    SELECT user_id, camera_enabled,
           ROW_NUMBER() OVER (
             PARTITION BY user_id
             ORDER BY completed_at DESC, attempt_id DESC
           ) AS attempt_rank
    FROM ASSESSMENT_ATTEMPT
    WHERE status = 'COMPLETED'
  )
  SELECT COALESCE(SUM(camera_enabled = 1), 0) AS verified_count,
         COALESCE(SUM(camera_enabled = 0 OR camera_enabled IS NULL), 0) AS standard_count
  FROM latest_completed_attempt
  WHERE attempt_rank = 1`

const COLLEGE_ALIGNMENT_QUERY = `
  WITH tracked_users AS (
    SELECT user_id FROM COLLEGE_TRACKING_CYCLE
    UNION
    SELECT user_id FROM COLLEGE_TERM
    UNION
    SELECT user_id FROM SEMESTER_CHECKIN
  ),
  completed_checkins AS (
    SELECT sc.checkin_id, sc.user_id, sc.alignment_score, sc.phase, sc.gwa,
           sc.checkin_date, sc.created_at
    FROM SEMESTER_CHECKIN sc
    JOIN (
      SELECT checkin_id
      FROM CHECKIN_ALIGNMENT_RESPONSE
      GROUP BY checkin_id
      HAVING COUNT(response_id) = 5
    ) completed_response ON completed_response.checkin_id = sc.checkin_id
    WHERE sc.alignment_score IS NOT NULL
  ),
  latest_alignment AS (
    SELECT sc.user_id,
           CASE
             WHEN sc.phase = 'End' AND sc.gwa IS NOT NULL THEN
               CASE
                 WHEN sc.gwa >= ${ALIGNMENT_RULES.passingGwa}
                  AND ROUND(sc.alignment_score * 100) >= ${ALIGNMENT_RULES.highAlignmentPercent} THEN 'On Track'
                 WHEN sc.gwa >= ${ALIGNMENT_RULES.passingGwa}
                   OR ROUND(sc.alignment_score * 100) >= ${ALIGNMENT_RULES.highAlignmentPercent} THEN 'Monitor'
                 ELSE 'Needs Attention'
               END
             WHEN ROUND(sc.alignment_score * 100) >= ${ALIGNMENT_RULES.highAlignmentPercent} THEN 'On Track'
             WHEN 100 - ROUND(sc.alignment_score * 100) < ${ALIGNMENT_RULES.monitorMismatchExclusive} THEN 'Monitor'
             ELSE 'Needs Attention'
           END AS alignment_status,
           ROW_NUMBER() OVER (
             PARTITION BY sc.user_id
             ORDER BY COALESCE(sc.checkin_date, sc.created_at) DESC, sc.checkin_id DESC
           ) AS latest_rank
    FROM completed_checkins sc
  )
  SELECT COUNT(*) AS total_tracked,
         COALESCE(SUM(la.alignment_status = 'On Track'), 0) AS on_track,
         COALESCE(SUM(la.alignment_status = 'Monitor'), 0) AS monitor,
         COALESCE(SUM(la.alignment_status = 'Needs Attention'), 0) AS needs_attention,
         COALESCE(SUM(la.alignment_status IS NULL), 0) AS no_checkin
  FROM tracked_users tu
  LEFT JOIN latest_alignment la ON la.user_id = tu.user_id AND la.latest_rank = 1`

function roundOneDecimal(value) {
  return Math.round(Number(value) * 10) / 10
}

export async function getAdminAnalytics(database) {
  const [
    [completionRows],
    [skillRows],
    [personalityRows],
    [courseRows],
    [modeRows],
    [alignmentRows],
    enrollmentVerification,
  ] = await Promise.all([
    database.query(COMPLETION_QUERY),
    database.query(AVERAGE_SKILLS_QUERY),
    database.query(PERSONALITY_QUERY),
    database.query(ALL_COURSES_QUERY),
    database.query(ASSESSMENT_MODE_QUERY).catch(() => [[{ verified_count: 0, standard_count: 0 }]]),
    database.query(COLLEGE_ALIGNMENT_QUERY).catch(() => [[{
      total_tracked: 0, on_track: 0, monitor: 0, needs_attention: 0, no_checkin: 0,
    }]]),
    getEnrollmentVerificationSummary(database).catch(() => ({
      totalEnrolled: 0, verified: 0, pendingReview: 0, rejected: 0, unsubmitted: 0,
    })),
  ])

  const completion = completionRows[0] || {}
  const totalUsers = Number(completion.total_users || 0)
  const completed = Number(completion.completed || 0)
  const inProgress = Number(completion.in_progress || 0)
  const notStarted = Number(completion.not_started || 0)
  const modeSummary = modeRows[0] || {}
  const alignmentSummary = alignmentRows[0] || {}

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
    assessmentModes: {
      verified: Number(modeSummary.verified_count || 0),
      standard: Number(modeSummary.standard_count || 0),
    },
    collegeOverview: {
      totalTracked: Number(alignmentSummary.total_tracked || 0),
      alignment: {
        onTrack: Number(alignmentSummary.on_track || 0),
        monitor: Number(alignmentSummary.monitor || 0),
        needsAttention: Number(alignmentSummary.needs_attention || 0),
        noCheckin: Number(alignmentSummary.no_checkin || 0),
      },
      enrollmentVerification,
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
