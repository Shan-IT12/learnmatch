import { calculateSemesterTiming, getNextSequentialCheckinPhase, CHECKIN_PHASE_BOUNDARIES } from './collegeTrackingService.js'
import { canonicalReminderPayload } from './reminderEmailService.js'

const DAY = 86400000
export function manilaDay(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

// The existing phase rules have no separate deadline. Use the first calendar
// day of each phase as its check-in target, without changing availability.
export function reminderTarget(term, completed = [], now = new Date()) {
  if (term.timing_mode !== 'exact' || !['student_confirmed', 'institution_calendar'].includes(term.dates_source)) return null
  const start = term.semester_start_date
  const end = term.semester_end_date
  if (!start || !end) return null
  try { calculateSemesterTiming(start, end, now) } catch { return null }
  const phase = getNextSequentialCheckinPhase(completed, term.initial_tracking_phase)
  if (!phase) return null
  const startMs = Date.parse(`${start}T00:00:00Z`)
  const durationDays = (Date.parse(`${end}T00:00:00Z`) - startMs) / DAY
  const offset = phase === 'Early' ? 0 : Math.floor(durationDays * CHECKIN_PHASE_BOUNDARIES[phase]) + 1
  const dueDate = new Date(startMs + offset * DAY).toISOString().slice(0, 10)
  const days = Math.round((Date.parse(`${manilaDay(now)}T00:00:00Z`) - Date.parse(`${dueDate}T00:00:00Z`)) / DAY)
  if (days < -7) return null
  return { phase, dueDate, stage: days < 0 ? 'upcoming' : days < 7 ? 'due' : 'overdue', days }
}

export function reminderCopy(target, term) {
  const message = target.stage === 'upcoming'
    ? 'Your semester check-in is approaching. Take a moment to reflect on your college journey.'
    : target.days > 0
      ? 'There is still time to update your college journey. Complete your check-in when you can.'
      : "It's time to update your college journey! Complete your semester check-in to track your progress."
  return { title: 'Semester Check-in Reminder', message, semester: `${term.semester} ${term.academic_year}`, ...target }
}

export async function currentReminder(database, userId, now = new Date()) {
  const [terms] = await database.query(`SELECT t.*,
      DATE_FORMAT(t.semester_start_date, '%Y-%m-%d') AS semester_start_date,
      DATE_FORMAT(t.semester_end_date, '%Y-%m-%d') AS semester_end_date
    FROM COLLEGE_TERM t JOIN COLLEGE_TRACKING_CYCLE c ON c.tracking_cycle_id = t.tracking_cycle_id
    JOIN USER_ACCOUNT u ON u.user_id = t.user_id
    WHERE t.user_id = ? AND c.status = 'active' AND u.is_active = 1
    ORDER BY t.term_id DESC LIMIT 1`, [userId])
  const term = terms[0]
  if (!term) return null
  const [completed] = await database.query(`SELECT sc.phase FROM SEMESTER_CHECKIN sc
    WHERE sc.user_id = ? AND sc.term_id = ? AND EXISTS
    (SELECT 1 FROM CHECKIN_ALIGNMENT_RESPONSE r WHERE r.checkin_id = sc.checkin_id)`, [userId, term.term_id])
  const target = reminderTarget(term, completed.map(r => r.phase), now)
  return target ? { ...reminderCopy(target, term), termId: term.term_id } : null
}

export async function ensureReminder(database, userId, target) {
  await database.query(`INSERT INTO CHECKIN_REMINDER (user_id, term_id, phase, stage, due_date)
    VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE reminder_id = reminder_id`,
  [userId, target.termId, target.phase, target.stage, target.dueDate])
  const [[row]] = await database.query(`SELECT *,
    TIMESTAMPDIFF(SECOND, first_attempt_at, UTC_TIMESTAMP()) AS attempt_age,
    TIMESTAMPDIFF(SECOND, last_attempt_at, UTC_TIMESTAMP()) AS retry_age
    FROM CHECKIN_REMINDER WHERE user_id = ? AND term_id = ? AND phase = ? AND stage = ? AND due_date = ?`,
  [userId, target.termId, target.phase, target.stage, target.dueDate])
  return row
}

export async function listReminders(database, userId) {
  const target = await currentReminder(database, userId)
  const [[preference]] = await database.query('SELECT email_enabled FROM CHECKIN_REMINDER_PREFERENCE WHERE user_id = ?', [userId])
  if (!target) return { notifications: [], emailEnabled: preference?.email_enabled !== 0 }
  const row = await ensureReminder(database, userId, target)
  return { notifications: [{ ...target, id: row.reminder_id, read: Boolean(row.read_at), href: `/college/checkin?reminder=${row.reminder_id}` }], emailEnabled: preference?.email_enabled !== 0 }
}

export function canRetry(row) {
  return !['sent', 'review'].includes(row.email_status) &&
    (row.first_attempt_at == null || (Number(row.attempt_age) < 23 * 3600 && Number(row.retry_age) >= 300 && row.attempts < 8))
}

export async function runReminders(pool, { now = new Date(), mode = 'dry-run', send, buildPayload } = {}) {
  if (!['dry-run', 'live'].includes(mode)) throw new Error('Invalid reminder email mode')
  const db = await pool.getConnection()
  const counts = { considered: 0, sent: 0, failed: 0, review: 0, dryRun: 0 }
  let locked = false
  try {
    const [[lock]] = await db.query("SELECT GET_LOCK('learnmatch-checkin-reminders', 0) AS acquired")
    locked = Number(lock.acquired) === 1
    if (!locked) return { ...counts, busy: true }
    const [users] = await db.query(`SELECT DISTINCT t.user_id FROM COLLEGE_TERM t
      JOIN COLLEGE_TRACKING_CYCLE c ON c.tracking_cycle_id = t.tracking_cycle_id WHERE c.status = 'active'`)
    for (const { user_id: userId } of users) {
      const target = await currentReminder(db, userId, now)
      if (!target) continue
      const row = await ensureReminder(db, userId, target)
      counts.considered++
      const [[user]] = await db.query(`SELECT u.email, u.username, u.is_active,
        COALESCE(p.email_enabled, 1) AS email_enabled,
        (SELECT full_name FROM PROFILE WHERE user_id = u.user_id ORDER BY profile_id DESC LIMIT 1) AS full_name
        FROM USER_ACCOUNT u LEFT JOIN CHECKIN_REMINDER_PREFERENCE p ON p.user_id = u.user_id
        WHERE u.user_id = ?`, [userId])
      if (!user?.is_active || !user.email_enabled || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email || '')) continue
      if (row.email_status === 'sending' && (row.attempt_age >= 23 * 3600 || row.attempts >= 8)) {
        await db.query("UPDATE CHECKIN_REMINDER SET email_status = 'review' WHERE reminder_id = ?", [row.reminder_id])
        counts.review++
        continue
      }
      if (!canRetry(row)) continue
      if (mode === 'dry-run') { counts.dryRun++; continue }
      const payload = canonicalReminderPayload(row.payload ? (typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload) : buildPayload(user, target, row.reminder_id))
      if (payload.to[0] !== user.email) continue
      await db.query(`UPDATE CHECKIN_REMINDER SET email_status = 'sending', attempts = attempts + 1,
        first_attempt_at = COALESCE(first_attempt_at, UTC_TIMESTAMP()), last_attempt_at = UTC_TIMESTAMP(), payload = ?
        WHERE reminder_id = ?`, [JSON.stringify(payload), row.reminder_id])
      try {
        // Claim is committed above, so a lost process retains its retry identity.
        // Locks serialize delivery with check-in submission, tracking edits,
        // account deactivation and existing preference changes.
        await db.beginTransaction()
        const [[activeUser]] = await db.query('SELECT email, is_active FROM USER_ACCOUNT WHERE user_id = ? FOR UPDATE', [userId])
        await db.query('SELECT tracking_cycle_id FROM COLLEGE_TRACKING_CYCLE WHERE user_id = ? FOR UPDATE', [userId])
        await db.query('SELECT term_id FROM COLLEGE_TERM WHERE user_id = ? FOR UPDATE', [userId])
        await db.query('SELECT checkin_id FROM SEMESTER_CHECKIN WHERE user_id = ? AND term_id = ? FOR UPDATE', [userId, target.termId])
        const [[preference]] = await db.query('SELECT email_enabled FROM CHECKIN_REMINDER_PREFERENCE WHERE user_id = ? FOR UPDATE', [userId])
        const latest = await currentReminder(db, userId, now)
        if (!activeUser?.is_active || activeUser.email !== payload.to[0] || preference?.email_enabled === 0 || JSON.stringify(latest) !== JSON.stringify(target)) {
          await db.rollback()
          continue
        }
        const result = await send(payload, `checkin-reminder-${row.reminder_id}`)
        await db.query("UPDATE CHECKIN_REMINDER SET email_status = 'sent', provider_id = ? WHERE reminder_id = ?", [result.id, row.reminder_id])
        await db.commit()
        counts.sent++
      } catch { await db.rollback(); counts.failed++ } // Ambiguous delivery retains its original key and payload.
    }
    return counts
  } finally {
    try { if (locked) await db.query("SELECT RELEASE_LOCK('learnmatch-checkin-reminders')") } finally { db.release() }
  }
}
