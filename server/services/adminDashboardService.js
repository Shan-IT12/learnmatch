const ALIGNMENT_STATUSES = ['On Track', 'Monitor', 'Needs Attention']

function toSqlDate(date) {
  return date.toISOString().slice(0, 19).replace('T', ' ')
}

function getRegistrationMonths(now, count = 6) {
  const currentMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  return Array.from({ length: count }, (_, index) => {
    const month = new Date(Date.UTC(
      currentMonth.getUTCFullYear(),
      currentMonth.getUTCMonth() - (count - 1 - index),
      1
    ))
    return {
      key: month.toISOString().slice(0, 7),
      label: new Intl.DateTimeFormat('en-US', {
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
      }).format(month),
      count: 0,
    }
  })
}

export async function getAdminDashboard(database, {
  now = new Date(),
  clusterLimit = 6,
  activityLimit = 5,
} = {}) {
  const registrationMonths = getRegistrationMonths(now)
  const registrationStart = new Date(`${registrationMonths[0].key}-01T00:00:00.000Z`)
  const registrationEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))

  const latestCompletedCte = `
    WITH latest_completed AS (
      SELECT sc.user_id, analysis.status,
             ROW_NUMBER() OVER (
               PARTITION BY sc.user_id
               ORDER BY COALESCE(sc.checkin_date, sc.created_at) DESC, sc.checkin_id DESC
             ) AS latest_rank
      FROM SEMESTER_CHECKIN sc
      JOIN AI_MISMATCH_ANALYSIS analysis ON analysis.analysis_id = (
        SELECT MAX(latest_analysis.analysis_id)
        FROM AI_MISMATCH_ANALYSIS latest_analysis
        WHERE latest_analysis.checkin_id = sc.checkin_id
      )
    )`

  const [
    [summaryRows],
    [registrationRows],
    [alignmentRows],
    [clusterRows],
    [activityRows],
  ] = await Promise.all([
    database.query(
      `${latestCompletedCte}, tracking_users AS (
         SELECT user_id FROM COLLEGE_TERM
         UNION
         SELECT user_id FROM SEMESTER_CHECKIN
       )
       SELECT
         (SELECT COUNT(*) FROM USER_ACCOUNT) AS total_users,
         (SELECT COUNT(*) FROM COURSE WHERE is_active = 1) AS active_courses,
         (SELECT COUNT(*) FROM tracking_users) AS tracking_students,
         (SELECT COUNT(*) FROM latest_completed
          WHERE latest_rank = 1 AND status IN ('Monitor', 'Needs Attention')) AS flagged_students,
         (SELECT COUNT(*) FROM FEEDBACK) AS total_feedback`
    ),
    database.query(
      `SELECT DATE_FORMAT(created_at, '%Y-%m') AS month_key, COUNT(*) AS registration_count
       FROM USER_ACCOUNT
       WHERE created_at >= ? AND created_at < ?
       GROUP BY DATE_FORMAT(created_at, '%Y-%m')
       ORDER BY month_key ASC`,
      [toSqlDate(registrationStart), toSqlDate(registrationEnd)]
    ),
    database.query(
      `${latestCompletedCte}
       SELECT status, COUNT(*) AS student_count
       FROM latest_completed
       WHERE latest_rank = 1
         AND status IN ('On Track', 'Monitor', 'Needs Attention')
       GROUP BY status`
    ),
    database.query(
      `SELECT c.cluster_category, COUNT(*) AS appearance_count
       FROM RECOMMENDATION_ITEM item
       JOIN COURSE c ON c.course_id = item.course_id
       GROUP BY c.cluster_category`
    ),
    database.query(
      `SELECT activity_type, occurred_at, detail
       FROM (
         SELECT 'registration' AS activity_type, created_at AS occurred_at,
                'New student account registered' AS detail
         FROM USER_ACCOUNT
         WHERE created_at IS NOT NULL
         UNION ALL
         SELECT 'feedback' AS activity_type, submitted_at AS occurred_at,
                CONCAT('Feedback submitted',
                  CASE WHEN category IS NULL OR category = '' THEN ''
                       ELSE CONCAT(' - ', category) END) AS detail
         FROM FEEDBACK
         WHERE submitted_at IS NOT NULL
         UNION ALL
         SELECT 'checkin' AS activity_type, analysis.analyzed_at AS occurred_at,
                CONCAT('Career Alignment check-in completed - ', analysis.status) AS detail
         FROM AI_MISMATCH_ANALYSIS analysis
         WHERE analysis.analyzed_at IS NOT NULL
           AND analysis.analysis_id = (
             SELECT MAX(latest_analysis.analysis_id)
             FROM AI_MISMATCH_ANALYSIS latest_analysis
             WHERE latest_analysis.checkin_id = analysis.checkin_id
           )
       ) activity
       ORDER BY occurred_at DESC
       LIMIT ?`,
      [Math.max(1, Math.min(Number(activityLimit) || 5, 20))]
    ),
  ])

  const summary = summaryRows[0] || {}
  const registrationsByMonth = new Map(
    registrationRows.map((row) => [row.month_key, Number(row.registration_count)])
  )
  const alignmentByStatus = new Map(
    alignmentRows.map((row) => [row.status, Number(row.student_count)])
  )
  const safeClusterLimit = Math.max(1, Math.min(Number(clusterLimit) || 6, 13))

  return {
    summary: {
      totalUsers: Number(summary.total_users || 0),
      activeCourses: Number(summary.active_courses || 0),
      trackingStudents: Number(summary.tracking_students || 0),
      flaggedStudents: Number(summary.flagged_students || 0),
      totalFeedback: Number(summary.total_feedback || 0),
    },
    registrationTrend: registrationMonths.map((month) => ({
      ...month,
      count: registrationsByMonth.get(month.key) || 0,
    })),
    alignmentDistribution: ALIGNMENT_STATUSES.map((status) => ({
      status,
      count: alignmentByStatus.get(status) || 0,
    })),
    recommendedClusters: clusterRows
      .map((row) => ({
        cluster: row.cluster_category,
        count: Number(row.appearance_count),
      }))
      .sort((a, b) => b.count - a.count || a.cluster.localeCompare(b.cluster))
      .slice(0, safeClusterLimit),
    recentActivity: activityRows.map((row) => ({
      type: row.activity_type,
      occurredAt: row.occurred_at,
      detail: row.detail,
    })),
  }
}

