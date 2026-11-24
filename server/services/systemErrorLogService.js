import { sendResendMail } from './resendEmailService.js'

const ALLOWED_SOURCES = new Set(['BACKEND', 'FRONTEND'])

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function formatManilaDate(value) {
  if (!value) return 'Unknown'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  }).format(date)
}

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
      `SELECT id, source, endpoint, error_message, stack_trace, user_id, created_at, reported_at, reported_by
       FROM system_error_logs
       ORDER BY (reported_at IS NOT NULL) DESC, created_at DESC, id DESC
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
      reported_at: row.reported_at || null,
      reported_by: row.reported_by || null,
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

export async function reportSystemErrorToDevelopers(
  database,
  { logId, reporterUsername = 'System Administrator', send = sendResendMail } = {}
) {
  const parsedId = Number(logId)
  if (!Number.isInteger(parsedId) || parsedId <= 0) {
    const error = new Error('Invalid error log ID.')
    error.status = 400
    throw error
  }

  const [logRows] = await database.query(
    `SELECT id, source, endpoint, error_message, stack_trace, user_id, created_at
     FROM system_error_logs
     WHERE id = ?
     LIMIT 1`,
    [parsedId]
  )
  const log = logRows[0]
  if (!log) {
    const error = new Error('System error log not found.')
    error.status = 404
    throw error
  }

  const reporter = truncate(String(reporterUsername || 'System Administrator').trim() || 'System Administrator', 120)
  const reportedAt = new Date()

  await database.query(
    `UPDATE system_error_logs
     SET reported_at = NOW(), reported_by = ?
     WHERE id = ?`,
    [reporter, parsedId]
  )

  // Best-effort email notification if any System Developer email is configured.
  let emailedCount = 0
  try {
    const [devRows] = await database.query(
      `SELECT DISTINCT email
       FROM ADMIN
       WHERE role IN ('system_developer', 'admin')
         AND email IS NOT NULL
         AND TRIM(email) <> ''`
    )
    const recipients = devRows
      .map((row) => String(row.email || '').trim())
      .filter(Boolean)

    if (!recipients.length) {
      const fallbackEmail = (process.env.SYSTEM_DEVELOPER_EMAIL || process.env.SUPPORT_EMAIL || '').trim()
      if (fallbackEmail) recipients.push(fallbackEmail)
    }

    if (recipients.length) {
      const timestamp = formatManilaDate(log.created_at)
      const subject = `[LearnMatch Error Report #${log.id}] ${log.source} · ${truncate(log.endpoint || 'UNKNOWN', 80)}`
      const stackBlock = log.stack_trace ? log.stack_trace : 'No stack trace recorded.'

      const text = [
        `LearnMatch System Error Report (#${log.id})`,
        `Reported by: ${reporter}`,
        `Date/Time: ${timestamp}`,
        `Source: ${log.source}`,
        `Endpoint: ${log.endpoint}`,
        log.user_id ? `Affected User ID: ${log.user_id}` : null,
        '',
        'Error Message:',
        log.error_message,
        '',
        'Stack Trace:',
        stackBlock,
      ].filter((line) => line !== null).join('\n')

      const html = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1e293b; max-width: 680px; margin: 0 auto;">
          <h2 style="color: #c2410c; margin-bottom: 4px;">LearnMatch System Error Report (#${log.id})</h2>
          <p style="color: #64748b; font-size: 13px; margin-top: 0;">Reported by <strong>${escapeHtml(reporter)}</strong></p>
          <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin: 16px 0;">
            <tr><td style="padding: 6px 10px; background: #f8fafc; font-weight: 600; width: 140px;">Date / Time</td><td style="padding: 6px 10px; border-bottom: 1px solid #e2e8f0;">${escapeHtml(timestamp)}</td></tr>
            <tr><td style="padding: 6px 10px; background: #f8fafc; font-weight: 600;">Source</td><td style="padding: 6px 10px; border-bottom: 1px solid #e2e8f0;">${escapeHtml(log.source)}</td></tr>
            <tr><td style="padding: 6px 10px; background: #f8fafc; font-weight: 600;">Endpoint</td><td style="padding: 6px 10px; border-bottom: 1px solid #e2e8f0; font-family: monospace;">${escapeHtml(log.endpoint)}</td></tr>
            ${log.user_id ? `<tr><td style="padding: 6px 10px; background: #f8fafc; font-weight: 600;">Affected User ID</td><td style="padding: 6px 10px; border-bottom: 1px solid #e2e8f0;">${escapeHtml(log.user_id)}</td></tr>` : ''}
          </table>
          <p style="font-size: 13px; font-weight: 600; margin-bottom: 6px;">Error Message</p>
          <div style="background: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px; padding: 12px; font-size: 13px; color: #9a3412;">${escapeHtml(log.error_message)}</div>
          <p style="font-size: 13px; font-weight: 600; margin: 16px 0 6px;">Stack Trace</p>
          <pre style="background: #0f172a; color: #f1f5f9; border-radius: 8px; padding: 12px; font-size: 11px; overflow-x: auto; white-space: pre-wrap;">${escapeHtml(stackBlock)}</pre>
        </div>
      `.trim()

      await Promise.all(recipients.map((to) => send({ to, subject, html, text })))
      emailedCount = recipients.length
    }
  } catch (emailError) {
    // In-app report is already saved; email failure should not block reporting.
    console.error('Optional System Developer email notification skipped:', emailError?.message || emailError)
  }

  return {
    logId: log.id,
    reportedAt: reportedAt.toISOString(),
    reportedBy: reporter,
    recipientCount: emailedCount,
  }
}
