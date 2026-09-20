import { ALIGNMENT_RULES, determineAlignmentStatus } from './collegeTrackingService.js'
import { assessmentStatusSql, getAssessmentStatus } from './assessmentCompletionService.js'

const ASSESSMENT_STATUS_SQL = assessmentStatusSql({
  profileCount: 'profile_stats.profile_count',
  interestCount: 'interest_stats.interest_count',
  skillCount: 'skill_stats.skill_count',
  personalityCount: 'personality_stats.personality_count',
})

const ALIGNMENT_STATUS_SQL = `CASE
  WHEN sc.phase = 'End' AND sc.gwa IS NOT NULL THEN
    CASE
      WHEN sc.gwa >= ${ALIGNMENT_RULES.passingGwa}
       AND ROUND(sc.alignment_score * 100) >= ${ALIGNMENT_RULES.highAlignmentPercent} THEN 'On Track'
      WHEN sc.gwa >= ${ALIGNMENT_RULES.passingGwa}
        OR ROUND(sc.alignment_score * 100) >= ${ALIGNMENT_RULES.highAlignmentPercent} THEN 'Monitor'
      ELSE 'Needs Attention'
    END
  WHEN 100 - ROUND(sc.alignment_score * 100) < ${ALIGNMENT_RULES.onTrackMismatchExclusive} THEN 'On Track'
  WHEN 100 - ROUND(sc.alignment_score * 100) < ${ALIGNMENT_RULES.monitorMismatchExclusive} THEN 'Monitor'
  ELSE 'Needs Attention'
END`

const USER_MONITORING_CTE = `
  WITH completed_checkins AS (
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
  latest_completed AS (
    SELECT sc.user_id, ${ALIGNMENT_STATUS_SQL} AS status,
           ROW_NUMBER() OVER (
             PARTITION BY sc.user_id
             ORDER BY COALESCE(sc.checkin_date, sc.created_at) DESC, sc.checkin_id DESC
           ) AS latest_rank
    FROM completed_checkins sc
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
  tracking_users AS (
    SELECT user_id FROM COLLEGE_TERM
    UNION
    SELECT user_id FROM SEMESTER_CHECKIN
  ),
  recommendation_users AS (
    SELECT DISTINCT user_id FROM RECOMMENDATION
  ),
  user_monitoring AS (
    SELECT u.user_id, u.email, u.username, u.is_active, u.created_at,
           profile.full_name,
           ${ASSESSMENT_STATUS_SQL} AS assessment_status,
           CASE WHEN recommendation_users.user_id IS NULL THEN 0 ELSE 1 END AS has_recommendation,
           CASE WHEN tracking_users.user_id IS NULL THEN 0 ELSE 1 END AS tracking_started,
           latest_completed.status AS alignment_status
    FROM USER_ACCOUNT u
    LEFT JOIN PROFILE profile ON profile.user_id = u.user_id
    LEFT JOIN profile_stats ON profile_stats.user_id = u.user_id
    LEFT JOIN interest_stats ON interest_stats.user_id = u.user_id
    LEFT JOIN skill_stats ON skill_stats.user_id = u.user_id
    LEFT JOIN personality_stats ON personality_stats.user_id = u.user_id
    LEFT JOIN tracking_users ON tracking_users.user_id = u.user_id
    LEFT JOIN recommendation_users ON recommendation_users.user_id = u.user_id
    LEFT JOIN latest_completed
      ON latest_completed.user_id = u.user_id AND latest_completed.latest_rank = 1
  )`

const ACCOUNT_FILTERS = new Set(['active', 'inactive'])
const ASSESSMENT_FILTERS = new Map([
  ['completed', 'Completed'],
  ['in_progress', 'In Progress'],
  ['not_started', 'Not Started'],
])
const TRACKING_FILTERS = new Set(['started', 'not_started'])
const ALIGNMENT_FILTERS = new Map([
  ['on_track', 'On Track'],
  ['monitor', 'Monitor'],
  ['needs_attention', 'Needs Attention'],
  ['no_checkin', null],
])

function buildFilters({ search = '', account = '', assessment = '', tracking = '', alignment = '' }) {
  const clauses = []
  const values = []
  const normalizedSearch = String(search).trim().slice(0, 100)
  if (normalizedSearch) {
    clauses.push('(full_name LIKE ? OR email LIKE ? OR username LIKE ?)')
    const searchPattern = `%${normalizedSearch}%`
    values.push(searchPattern, searchPattern, searchPattern)
  }
  if (ACCOUNT_FILTERS.has(account)) {
    clauses.push('is_active = ?')
    values.push(account === 'active' ? 1 : 0)
  }
  if (ASSESSMENT_FILTERS.has(assessment)) {
    clauses.push('assessment_status = ?')
    values.push(ASSESSMENT_FILTERS.get(assessment))
  }
  if (TRACKING_FILTERS.has(tracking)) {
    clauses.push('tracking_started = ?')
    values.push(tracking === 'started' ? 1 : 0)
  }
  if (ALIGNMENT_FILTERS.has(alignment)) {
    const status = ALIGNMENT_FILTERS.get(alignment)
    if (status === null) clauses.push('alignment_status IS NULL')
    else {
      clauses.push('alignment_status = ?')
      values.push(status)
    }
  }
  return {
    sql: clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '',
    values,
  }
}

function shapeListUser(row) {
  return {
    userId: Number(row.user_id),
    displayName: row.full_name || row.username || row.email,
    email: row.email,
    accountStatus: Number(row.is_active) === 1 ? 'Active' : 'Inactive',
    assessmentStatus: row.assessment_status,
    recommendationStatus: Number(row.has_recommendation) === 1 ? 'Available' : 'Not Yet Generated',
    trackingStatus: Number(row.tracking_started) === 1 ? 'Tracking Started' : 'Not Started',
    latestAlignment: row.alignment_status || null,
    registeredAt: row.created_at,
  }
}

export async function getAdminUsers(database, options = {}) {
  const page = Math.max(1, Number.parseInt(options.page, 10) || 1)
  const pageSize = Math.max(1, Math.min(Number.parseInt(options.pageSize, 10) || 10, 50))
  const filters = buildFilters(options)
  const offset = (page - 1) * pageSize

  const [countResult, usersResult] = await Promise.all([
    database.query(
      `${USER_MONITORING_CTE}
       SELECT COUNT(*) AS total FROM user_monitoring${filters.sql}`,
      filters.values
    ),
    database.query(
      `${USER_MONITORING_CTE}
       SELECT user_id, email, username, is_active, created_at, full_name,
              assessment_status, has_recommendation, tracking_started, alignment_status
       FROM user_monitoring${filters.sql}
       ORDER BY created_at DESC, user_id DESC
       LIMIT ? OFFSET ?`,
      [...filters.values, pageSize, offset]
    ),
  ])

  const countRow = countResult[0][0]
  const rows = usersResult[0]
  const total = Number(countRow?.total || 0)
  return {
    users: rows.map(shapeListUser),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  }
}

function toNumber(value) {
  return value === null || value === undefined ? null : Number(value)
}

export async function getAdminUserDetail(database, userId) {
  const normalizedUserId = Number(userId)
  if (!Number.isInteger(normalizedUserId) || normalizedUserId <= 0) return null

  const [accountRows] = await database.query(
    `SELECT u.user_id, u.email, u.username, u.is_active, u.created_at, profile.full_name,
            (SELECT COUNT(*) FROM PROFILE WHERE user_id = u.user_id) AS profile_count,
            (SELECT COUNT(*) FROM INTEREST_RESPONSE WHERE user_id = u.user_id) AS interest_count,
            (SELECT COUNT(*) FROM SKILL_RESPONSE WHERE user_id = u.user_id) AS skill_count,
            (SELECT COUNT(*) FROM PERSONALITY_ASSESSMENT WHERE user_id = u.user_id) AS personality_count
     FROM USER_ACCOUNT u
     LEFT JOIN PROFILE profile ON profile.user_id = u.user_id
     WHERE u.user_id = ?
     LIMIT 1`,
    [normalizedUserId]
  )
  if (accountRows.length === 0) return null
  const account = accountRows[0]

  const [
    [personalityRows],
    [skillRows],
    [recommendationRows],
    [termRows],
    [alignmentRows],
  ] = await Promise.all([
    database.query(
      `SELECT mbti_type, taken_at
       FROM PERSONALITY_ASSESSMENT
       WHERE user_id = ?
       ORDER BY assessment_id DESC
       LIMIT 1`,
      [normalizedUserId]
    ),
    database.query(
      `SELECT COUNT(*) AS answer_count, COALESCE(SUM(is_correct), 0) AS correct_count
       FROM (
         SELECT is_correct FROM SKILL_RESPONSE
         WHERE user_id = ?
         ORDER BY skill_response_id DESC
         LIMIT 30
       ) latest_skill_assessment`,
      [normalizedUserId]
    ),
    database.query(
      `SELECT recommendation.generated_at, item.rank_position, item.match_score,
              course.course_id, course.course_code, course.course_name
       FROM RECOMMENDATION recommendation
       JOIN RECOMMENDATION_ITEM item ON item.recommendation_id = recommendation.recommendation_id
       JOIN COURSE course ON course.course_id = item.course_id
       WHERE recommendation.recommendation_id = (
         SELECT latest.recommendation_id FROM RECOMMENDATION latest
         WHERE latest.user_id = ?
         ORDER BY latest.generated_at DESC, latest.recommendation_id DESC
         LIMIT 1
       )
       ORDER BY item.rank_position ASC
       LIMIT 3`,
      [normalizedUserId]
    ),
    database.query(
      `SELECT term.term_id, term.academic_year, term.year_level, term.semester,
              term.timing_mode, term.dates_source,
              course.course_id, course.course_code, course.course_name
       FROM COLLEGE_TERM term
       JOIN COURSE course ON course.course_id = term.course_id
       WHERE term.user_id = ?
       ORDER BY term.term_id DESC
       LIMIT 1`,
      [normalizedUserId]
    ),
    database.query(
      `WITH completed AS (
         SELECT sc.checkin_id, sc.alignment_score, sc.phase, sc.gwa,
                sc.checkin_date, sc.created_at
         FROM SEMESTER_CHECKIN sc
         JOIN (
           SELECT checkin_id
           FROM CHECKIN_ALIGNMENT_RESPONSE
           GROUP BY checkin_id
           HAVING COUNT(response_id) = 5
         ) completed_response ON completed_response.checkin_id = sc.checkin_id
         WHERE sc.user_id = ? AND sc.alignment_score IS NOT NULL
       )
       SELECT
         (SELECT COUNT(*) FROM completed) AS completed_checkins,
         (SELECT alignment_score FROM completed
          ORDER BY COALESCE(checkin_date, created_at) DESC, checkin_id DESC LIMIT 1) AS alignment_score,
         (SELECT phase FROM completed
          ORDER BY COALESCE(checkin_date, created_at) DESC, checkin_id DESC LIMIT 1) AS phase,
         (SELECT gwa FROM completed
          ORDER BY COALESCE(checkin_date, created_at) DESC, checkin_id DESC LIMIT 1) AS gwa,
         (SELECT COALESCE(checkin_date, created_at) FROM completed
          ORDER BY COALESCE(checkin_date, created_at) DESC, checkin_id DESC LIMIT 1) AS latest_checkin_at`,
      [normalizedUserId]
    ),
  ])

  let tracking = termRows[0] || null
  if (!tracking) {
    const [legacyRows] = await database.query(
      `SELECT sc.year_level, sc.semester, course.course_id, course.course_code, course.course_name
       FROM SEMESTER_CHECKIN sc
       JOIN COURSE course ON course.course_id = sc.course_id
       WHERE sc.user_id = ? AND sc.term_id IS NULL
       ORDER BY sc.checkin_id DESC
       LIMIT 1`,
      [normalizedUserId]
    )
    tracking = legacyRows[0]
      ? { ...legacyRows[0], academic_year: null, timing_mode: 'manual', dates_source: null }
      : null
  }

  const counts = {
    profileCount: Number(account.profile_count),
    interestCount: Number(account.interest_count),
    skillCount: Number(account.skill_count),
    personalityCount: Number(account.personality_count),
  }
  const latestSkills = skillRows[0] || { answer_count: 0, correct_count: 0 }
  const alignment = alignmentRows[0] || {}
  const alignmentScore = toNumber(alignment.alignment_score)
  const alignmentPercent = alignmentScore === null ? null : Math.round(alignmentScore * 100)
  const alignmentStatus = alignmentPercent === null
    ? null
    : determineAlignmentStatus(alignmentPercent, {
        phase: alignment.phase,
        gwa: toNumber(alignment.gwa),
      })

  return {
    account: {
      userId: Number(account.user_id),
      displayName: account.full_name || account.username || account.email,
      username: account.username,
      email: account.email,
      status: Number(account.is_active) === 1 ? 'Active' : 'Inactive',
      registeredAt: account.created_at,
    },
    profile: {
      available: counts.profileCount > 0,
      fullName: account.full_name || null,
    },
    assessment: {
      status: getAssessmentStatus(counts),
      components: {
        profile: counts.profileCount > 0,
        interests: counts.interestCount >= 3,
        skills: counts.skillCount >= 30,
        personality: counts.personalityCount > 0,
      },
      mbtiType: personalityRows[0]?.mbti_type || null,
      personalityTakenAt: personalityRows[0]?.taken_at || null,
      interestCount: counts.interestCount,
      skillScore: Number(latestSkills.answer_count) >= 30
        ? {
            correct: Number(latestSkills.correct_count),
            total: Number(latestSkills.answer_count),
            percent: Math.round((Number(latestSkills.correct_count) / Number(latestSkills.answer_count)) * 100),
          }
        : null,
    },
    recommendation: {
      available: recommendationRows.length > 0,
      generatedAt: recommendationRows[0]?.generated_at || null,
      courses: recommendationRows.map((row) => ({
        rank: Number(row.rank_position),
        courseId: Number(row.course_id),
        courseCode: row.course_code,
        courseName: row.course_name,
        matchPercent: Math.round(Number(row.match_score) * 100),
      })),
    },
    tracking: {
      started: Boolean(tracking),
      course: tracking
        ? {
            courseId: Number(tracking.course_id),
            courseCode: tracking.course_code,
            courseName: tracking.course_name,
          }
        : null,
      academicYear: tracking?.academic_year || null,
      yearLevel: tracking?.year_level || null,
      semester: tracking?.semester || null,
      timingMode: tracking?.timing_mode || null,
      datesSource: tracking?.dates_source || null,
      completedCheckins: Number(alignment.completed_checkins || 0),
      latestAlignment: alignmentStatus,
      latestAlignmentPercent: alignmentPercent,
      latestCheckinAt: alignment.latest_checkin_at || null,
    },
  }
}
