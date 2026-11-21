// Metadata-only assessment monitoring. Never accepts or stores video, photos or audio.

export const MONITORING_EVENT_TYPES = Object.freeze([
  'looking_away',
  'cellphone_detected',
  'no_face',
  'multiple_faces',
  'tab_switch',
  'camera_turned_off',
])
export const MAX_EVENTS_PER_ATTEMPT = 500
export const LOG_RETENTION_DAYS = 30

const STEP_PATTERN = /^[a-z0-9_-]{1,40}$/
const EVENT_FIELDS = ['event_type', 'assessment_step']

export function parseAttemptParam(value) {
  return /^[1-9]\d{0,9}$/.test(String(value)) ? Number(value) : null
}

// Returns { eventType, assessmentStep } or { error }. Unknown fields are rejected so
// nothing other than the two metadata strings can be submitted.
export function validateMonitoringEvent(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: 'A monitoring event is required.' }
  if (Object.keys(body).some(key => !EVENT_FIELDS.includes(key))) return { error: 'Only event_type and assessment_step are accepted.' }
  if (!MONITORING_EVENT_TYPES.includes(body.event_type)) return { error: 'Unsupported monitoring event type.' }
  if (typeof body.assessment_step !== 'string' || !STEP_PATTERN.test(body.assessment_step)) return { error: 'Invalid assessment step.' }
  return { eventType: body.event_type, assessmentStep: body.assessment_step }
}

async function ownedAttempt(db, userId, attemptId) {
  const [rows] = await db.query(
    'SELECT attempt_id, status FROM ASSESSMENT_ATTEMPT WHERE attempt_id = ? AND user_id = ?',
    [attemptId, userId]
  )
  return rows[0] || null
}

// Returns 'recorded', 'not_found', 'not_active' or 'limit_reached'.
export async function recordMonitoringEvent(db, userId, attemptId, { eventType, assessmentStep }) {
  const attempt = await ownedAttempt(db, userId, attemptId)
  if (!attempt) return 'not_found'
  if (attempt.status !== 'IN_PROGRESS') return 'not_active'
  const [result] = await db.query(
    `INSERT INTO assessment_monitoring_logs (user_id, attempt_id, event_type, assessment_step)
     SELECT ?, ?, ?, ?
     FROM DUAL
     WHERE (SELECT COUNT(*) FROM assessment_monitoring_logs WHERE attempt_id = ?) < ?`,
    [userId, attemptId, eventType, assessmentStep, attemptId, MAX_EVENTS_PER_ATTEMPT]
  )
  return result.affectedRows ? 'recorded' : 'limit_reached'
}

export function validateCameraToggle(body) {
  if (body === undefined || body === null) return { enabled: true }
  if (typeof body !== 'object' || Array.isArray(body)) return { error: 'Invalid camera monitoring payload.' }
  const keys = Object.keys(body)
  if (keys.some(key => key !== 'enabled')) return { error: 'Only enabled is accepted.' }
  if (body.enabled !== undefined && typeof body.enabled !== 'boolean') return { error: 'enabled must be a boolean.' }
  return { enabled: body.enabled ?? true }
}

// Returns 'updated', 'not_found' or 'not_active'.
export async function enableAttemptCamera(db, userId, attemptId, enabled = true) {
  const attempt = await ownedAttempt(db, userId, attemptId)
  if (!attempt) return 'not_found'
  if (attempt.status !== 'IN_PROGRESS') return 'not_active'
  await db.query(
    "UPDATE ASSESSMENT_ATTEMPT SET camera_enabled = ? WHERE attempt_id = ? AND user_id = ? AND status = 'IN_PROGRESS'",
    [enabled ? 1 : 0, attemptId, userId]
  )
  return 'updated'
}

// Resolves the student's most recent completed attempt (for the Results page).
export async function latestCompletedAttemptId(db, userId) {
  const [rows] = await db.query(
    "SELECT attempt_id FROM ASSESSMENT_ATTEMPT WHERE user_id = ? AND status = 'COMPLETED' ORDER BY attempt_id DESC LIMIT 1",
    [userId]
  )
  return rows[0]?.attempt_id ?? null
}

// Student view is scoped to the caller's own attempt; the admin view may read any attempt.
export async function getAttemptMonitoring(db, attemptId, { userId = null, admin = false } = {}) {
  const [attempts] = await db.query(
    `SELECT attempt_id, user_id, status, camera_enabled, completed_at FROM ASSESSMENT_ATTEMPT
     WHERE attempt_id = ?${admin ? '' : ' AND user_id = ?'}`,
    admin ? [attemptId] : [attemptId, userId]
  )
  const attempt = attempts[0]
  if (!attempt) return null
  const [events] = await db.query(
    `SELECT event_type, assessment_step, created_at FROM assessment_monitoring_logs
     WHERE attempt_id = ? ORDER BY created_at, id LIMIT ?`,
    [attemptId, MAX_EVENTS_PER_ATTEMPT]
  )
  const counts = Object.fromEntries(MONITORING_EVENT_TYPES.map(type => [type, 0]))
  for (const event of events) counts[event.event_type] = (counts[event.event_type] || 0) + 1
  const cameraEnabled = Boolean(attempt.camera_enabled)
  return {
    attemptId: attempt.attempt_id,
    ...(admin ? { userId: attempt.user_id, status: attempt.status } : {}),
    cameraEnabled,
    mode: cameraEnabled ? 'Verified' : 'Standard',
    completedAt: attempt.completed_at ?? null,
    totalEvents: events.length,
    counts,
    events: events.map(event => ({
      eventType: event.event_type,
      assessmentStep: event.assessment_step,
      createdAt: event.created_at,
    })),
  }
}

// Deletes only expired rows of assessment_monitoring_logs, in small batches.
export async function purgeExpiredMonitoringLogs(db, { retentionDays = LOG_RETENTION_DAYS, batchSize = 1000 } = {}) {
  if (!Number.isSafeInteger(retentionDays) || retentionDays < 1) throw new Error('Invalid retention period')
  let deleted = 0
  for (;;) {
    const [result] = await db.query(
      'DELETE FROM assessment_monitoring_logs WHERE created_at < (NOW() - INTERVAL ? DAY) LIMIT ?',
      [retentionDays, batchSize]
    )
    deleted += result.affectedRows
    if (result.affectedRows < batchSize) return deleted
  }
}

// Daily in-process cleanup for the web service; the timer never keeps the process alive.
export function startMonitoringRetention(db, { intervalMs = 24 * 60 * 60 * 1000 } = {}) {
  const run = () => purgeExpiredMonitoringLogs(db)
    .then(deleted => { if (deleted) console.log(`Monitoring log retention removed ${deleted} expired rows.`) })
    .catch(error => console.error('Monitoring log retention failed:', error.code || 'UNKNOWN'))
  run()
  const timer = setInterval(run, intervalMs)
  timer.unref()
  return timer
}
