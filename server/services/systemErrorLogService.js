const ALLOWED_SOURCES = new Set(['BACKEND', 'FRONTEND'])

function truncate(value, maxLength) {
  if (typeof value !== 'string') return ''
  return value.length > maxLength ? value.slice(0, maxLength) : value
}

export async function logSystemError(database, entry = {}) {
  try {
    if (!database || typeof database.query !== 'function') return false
    const source = ALLOWED_SOURCES.has(entry.source) ? entry.source : 'BACKEND'
    const endpoint = truncate(String(entry.endpoint || 'UNKNOWN'), 255)
    const errorMessage = truncate(String(entry.errorMessage || entry.message || 'Unexpected error'), 4000)
    const stackTrace = entry.stackTrace ? truncate(String(entry.stackTrace), 12000) : null
    const parsedUserId = Number(entry.userId)
    const userId = Number.isInteger(parsedUserId) && parsedUserId > 0 ? parsedUserId : null

    await database.query(
      `INSERT INTO system_error_logs (source, endpoint, error_message, stack_trace, user_id)
       VALUES (?, ?, ?, ?, ?)`,
      [source, endpoint, errorMessage, stackTrace, userId]
    )
    return true
  } catch (loggingError) {
    // Logging failures must never crash the server or mask the original response.
    console.error('System error logging failed:', loggingError?.message || loggingError)
    return false
  }
}

export async function getSystemErrorLogs(database, { page = 1, limit = 25, includeStackTrace = false } = {}) {
  const safeLimit = Math.min(100, Math.max(1, Number.parseInt(limit, 10) || 25))
  const safePage = Math.max(1, Number.parseInt(page, 10) || 1)
  const offset = (safePage - 1) * safeLimit

  try {
    const [[countRow]] = await database.query('SELECT COUNT(*) AS total FROM system_error_logs')
    const total = Number(countRow?.total || 0)
    const totalPages = Math.max(1, Math.ceil(total / safeLimit))

    const [rows] = await database.query(
      `SELECT id, source, endpoint, error_message, stack_trace, user_id, created_at
       FROM system_error_logs
       ORDER BY created_at DESC, id DESC
       LIMIT ? OFFSET ?`,
      [safeLimit, offset]
    )

    const logs = rows.map((row) => ({
      id: row.id,
      source: row.source,
      endpoint: row.endpoint,
      error_message: row.error_message,
      stack_trace: includeStackTrace ? row.stack_trace : null,
      user_id: row.user_id,
      created_at: row.created_at,
    }))

    return {
      logs,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages,
      },
    }
  } catch (error) {
    if (error?.code === 'ER_NO_SUCH_TABLE') {
      return {
        logs: [],
        pagination: { page: safePage, limit: safeLimit, total: 0, totalPages: 1 },
        tableMissing: true,
      }
    }
    throw error
  }
}
