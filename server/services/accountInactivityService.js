import { canonicalReminderPayload } from './reminderEmailService.js'
import { canRetry } from './checkinReminderService.js'

const DAY = 86400000
// mysql2 dateStrings avoids interpreting UTC DATETIME values in the host timezone.
const utc = value => value == null ? null : Date.parse(`${String(value).replace(' ', 'T')}Z`)

export function inactivityAction(user, now) {
  if (!user?.is_active || !Number.isFinite(now)) return null
  const baseline = utc(user.last_successful_login_at ?? user.inactivity_tracking_started_at)
  if (!Number.isFinite(baseline) || now - baseline < 365 * DAY) return null
  if (!user.inactivity_warning_sent_at) return 'warning'
  const deadline = utc(user.inactivity_delete_after)
  if (!Number.isFinite(deadline)) return null
  if (!user.inactivity_final_sent_at && now >= deadline - 7 * DAY) return 'final'
  if (user.inactivity_final_sent_at && now >= deadline && !user.inactivity_eligible_at) return 'eligible'
  return null
}

// Call only after interactive authentication succeeds, never from token middleware.
// The single row update serializes cancellation with the job's account row lock.
export async function recordSuccessfulLogin(db, userId) {
  const [result] = await db.query(`UPDATE USER_ACCOUNT SET
    last_successful_login_at = UTC_TIMESTAMP(3),
    inactivity_generation = inactivity_generation + 1,
    inactivity_warning_sent_at = NULL, inactivity_delete_after = NULL,
    inactivity_final_sent_at = NULL, inactivity_eligible_at = NULL
    WHERE user_id = ? AND is_active = 1`, [userId])
  if (result.affectedRows !== 1) throw new Error('Account unavailable during authentication')
}

const readAccount = async (db, userId, lock = false) => {
  const [[row]] = await db.query({ sql: `SELECT user_id, email, is_active, inactivity_generation,
    last_successful_login_at, inactivity_tracking_started_at, inactivity_warning_sent_at,
    inactivity_delete_after, inactivity_final_sent_at, inactivity_eligible_at, UTC_TIMESTAMP(3) AS job_now
    FROM USER_ACCOUNT WHERE user_id = ?${lock ? ' FOR UPDATE' : ''}`, dateStrings: true }, [userId])
  return row
}

export async function runInactivityChecks(pool, { mode = 'dry-run', send, buildPayload } = {}) {
  if (!['dry-run', 'live'].includes(mode)) throw new Error('Invalid inactivity email mode')
  const db = await pool.getConnection()
  const counts = { considered: 0, sent: 0, eligible: 0, failed: 0, review: 0, dryRun: 0 }
  let locked = false
  try {
    const [[lock]] = await db.query("SELECT GET_LOCK('learnmatch-account-inactivity', 0) AS acquired")
    locked = Number(lock.acquired) === 1
    if (!locked) return { ...counts, busy: true }
    const [users] = await db.query(`SELECT user_id FROM USER_ACCOUNT WHERE is_active = 1
      AND COALESCE(last_successful_login_at, inactivity_tracking_started_at) <= UTC_TIMESTAMP(3) - INTERVAL 365 DAY
      AND inactivity_eligible_at IS NULL`)
    for (const { user_id: userId } of users) {
      try {
        const user = await readAccount(db, userId)
        const stage = inactivityAction(user, utc(user?.job_now))
        if (!stage) continue
        counts.considered++
        if (mode === 'dry-run') { counts.dryRun++; continue }
        let row, payload
        if (stage !== 'eligible') {
          await db.query(`INSERT INTO ACCOUNT_INACTIVITY_EMAIL (user_id, generation, stage)
            VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE email_id = email_id`, [userId, user.inactivity_generation, stage])
          const [rows] = await db.query(`SELECT *,
            TIMESTAMPDIFF(SECOND, first_attempt_at, UTC_TIMESTAMP(3)) AS attempt_age,
            TIMESTAMPDIFF(SECOND, last_attempt_at, UTC_TIMESTAMP(3)) AS retry_age
            FROM ACCOUNT_INACTIVITY_EMAIL WHERE user_id = ? AND generation = ? AND stage = ?`,
          [userId, user.inactivity_generation, stage])
          row = rows[0]
          if (row.email_status === 'sending' && (row.attempt_age >= 23 * 3600 || row.attempts >= 8)) {
            await db.query("UPDATE ACCOUNT_INACTIVITY_EMAIL SET email_status = 'review' WHERE email_id = ?", [row.email_id])
            counts.review++
            continue
          }
          if (row.email_status === 'review') { counts.review++; continue }
          if (!canRetry(row)) continue
          payload = canonicalReminderPayload(row.payload ? (typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload) : buildPayload(user, stage))
          // Commit immutable payload and retry identity before any network request.
          await db.query(`UPDATE ACCOUNT_INACTIVITY_EMAIL SET email_status = 'sending', attempts = attempts + 1,
            first_attempt_at = COALESCE(first_attempt_at, UTC_TIMESTAMP(3)), last_attempt_at = UTC_TIMESTAMP(3), payload = ?
            WHERE email_id = ?`, [JSON.stringify(payload), row.email_id])
        }
        await db.beginTransaction()
        const latest = await readAccount(db, userId, true)
        if (!latest || String(latest.inactivity_generation) !== String(user.inactivity_generation)
          || inactivityAction(latest, utc(latest.job_now)) !== stage
          || (payload && latest.email !== payload.to[0])) {
          await db.rollback()
          continue
        }
        if (stage === 'eligible') {
          await db.query('UPDATE USER_ACCOUNT SET inactivity_eligible_at = UTC_TIMESTAMP(3) WHERE user_id = ?', [userId])
        } else {
          // Login and self-service deletion wait for this row lock. Ambiguous
          // delivery retries use the same provider key within its dedup window.
          const receipt = await send(payload, `account-inactivity-${row.email_id}`)
          if (!receipt?.id) throw new Error('Missing delivery receipt')
          await db.query("UPDATE ACCOUNT_INACTIVITY_EMAIL SET email_status = 'sent', provider_id = ? WHERE email_id = ?", [receipt.id, row.email_id])
          if (stage === 'warning') {
            await db.query(`UPDATE USER_ACCOUNT SET inactivity_warning_sent_at = UTC_TIMESTAMP(3),
              inactivity_delete_after = UTC_TIMESTAMP(3) + INTERVAL 30 DAY WHERE user_id = ?`, [userId])
          } else {
            // An outage must never shorten the final notice period.
            await db.query(`UPDATE USER_ACCOUNT SET inactivity_final_sent_at = UTC_TIMESTAMP(3),
              inactivity_delete_after = GREATEST(inactivity_delete_after, UTC_TIMESTAMP(3) + INTERVAL 7 DAY)
              WHERE user_id = ?`, [userId])
          }
        }
        await db.commit()
        if (stage === 'eligible') counts.eligible++
        else counts.sent++
      } catch {
        await db.rollback()
        counts.failed++
      }
    }
    return counts
  } finally {
    try { if (locked) await db.query("SELECT RELEASE_LOCK('learnmatch-account-inactivity')") } finally { db.release() }
  }
}
