const SORT_DIRECTIONS = new Map([
  ['newest', 'DESC'],
  ['oldest', 'ASC'],
])

function buildFilters({ search = '', category = '', rating = '' } = {}) {
  const clauses = []
  const values = []
  const normalizedSearch = String(search).trim().slice(0, 100)
  const normalizedCategory = String(category).trim().slice(0, 100)
  const normalizedRating = Number.parseInt(rating, 10)

  if (normalizedSearch) {
    clauses.push(`(
      profile.full_name LIKE ? OR account.username LIKE ? OR account.email LIKE ?
      OR feedback.comment LIKE ? OR feedback.category LIKE ?
    )`)
    const pattern = `%${normalizedSearch}%`
    values.push(pattern, pattern, pattern, pattern, pattern)
  }
  if (normalizedCategory) {
    clauses.push('feedback.category = ?')
    values.push(normalizedCategory)
  }
  if (Number.isInteger(normalizedRating) && normalizedRating >= 1 && normalizedRating <= 5) {
    clauses.push('feedback.rating = ?')
    values.push(normalizedRating)
  }

  return {
    sql: clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '',
    values,
  }
}

function shapeFeedback(row, { includeFullComment = false } = {}) {
  const feedback = {
    feedbackId: Number(row.feedback_id),
    user: {
      userId: Number(row.user_id),
      displayName: row.full_name || row.username || row.email || 'Unknown User',
      email: row.email || null,
    },
    rating: Number(row.rating),
    category: row.category || 'Uncategorized',
    submittedAt: row.submitted_at,
  }
  if (includeFullComment) feedback.comment = row.comment || ''
  else feedback.commentPreview = row.comment_preview || ''
  return feedback
}

export async function getAdminFeedback(database, options = {}) {
  const page = Math.max(1, Number.parseInt(options.page, 10) || 1)
  const pageSize = Math.max(1, Math.min(Number.parseInt(options.pageSize, 10) || 10, 50))
  const filters = buildFilters(options)
  const sortDirection = SORT_DIRECTIONS.get(options.sort) || SORT_DIRECTIONS.get('newest')
  const offset = (page - 1) * pageSize

  const joinSql = `
    FROM FEEDBACK feedback
    JOIN USER_ACCOUNT account ON account.user_id = feedback.user_id
    LEFT JOIN PROFILE profile ON profile.user_id = feedback.user_id`

  const [
    [summaryRows],
    [categoryRows],
    [countRows],
    [feedbackRows],
  ] = await Promise.all([
    database.query(
      `SELECT COUNT(*) AS total_feedback,
              ROUND(AVG(rating), 1) AS average_rating,
              COALESCE(SUM(submitted_at >= DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 30 DAY)), 0) AS recent_feedback
       FROM FEEDBACK`
    ),
    database.query(
      `SELECT COALESCE(category, 'Uncategorized') AS category, COUNT(*) AS feedback_count
       FROM FEEDBACK
       GROUP BY COALESCE(category, 'Uncategorized')
       ORDER BY feedback_count DESC, category ASC`
    ),
    database.query(
      `SELECT COUNT(*) AS total ${joinSql}${filters.sql}`,
      filters.values
    ),
    database.query(
      `SELECT feedback.feedback_id, feedback.user_id, feedback.rating, feedback.category,
              feedback.submitted_at,
              LEFT(COALESCE(feedback.comment, ''), 240) AS comment_preview,
              profile.full_name, account.username, account.email
       ${joinSql}${filters.sql}
       ORDER BY feedback.submitted_at ${sortDirection}, feedback.feedback_id ${sortDirection}
       LIMIT ? OFFSET ?`,
      [...filters.values, pageSize, offset]
    ),
  ])

  const summary = summaryRows[0] || {}
  const total = Number(countRows[0]?.total || 0)
  return {
    summary: {
      totalFeedback: Number(summary.total_feedback || 0),
      averageRating: summary.average_rating === null || summary.average_rating === undefined
        ? null
        : Number(summary.average_rating),
      recentFeedback: Number(summary.recent_feedback || 0),
    },
    categoryDistribution: categoryRows.map((row) => ({
      category: row.category,
      count: Number(row.feedback_count),
    })),
    feedback: feedbackRows.map((row) => shapeFeedback(row)),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  }
}

export async function getAdminFeedbackDetail(database, feedbackId) {
  const normalizedFeedbackId = Number(feedbackId)
  if (!Number.isInteger(normalizedFeedbackId) || normalizedFeedbackId <= 0) return null

  const [rows] = await database.query(
    `SELECT feedback.feedback_id, feedback.user_id, feedback.rating, feedback.category,
            feedback.comment, feedback.submitted_at,
            profile.full_name, account.username, account.email
     FROM FEEDBACK feedback
     JOIN USER_ACCOUNT account ON account.user_id = feedback.user_id
     LEFT JOIN PROFILE profile ON profile.user_id = feedback.user_id
     WHERE feedback.feedback_id = ?
     LIMIT 1`,
    [normalizedFeedbackId]
  )

  return rows[0] ? shapeFeedback(rows[0], { includeFullComment: true }) : null
}
