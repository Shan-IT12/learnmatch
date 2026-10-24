import bcrypt from 'bcrypt'

export class AccountDeletionError extends Error {
  constructor(code, status, message) { super(message); this.code = code; this.status = status }
}

// Fixed identifiers only. Keep this inventory in sync with schema/integration tests.
export const STUDENT_TABLES = Object.freeze([
  'RECOMMENDATION', 'ASSESSMENT_ATTEMPT', 'PERSONALITY_ASSESSMENT',
  'SEMESTER_CHECKIN', 'COLLEGE_TERM', 'COLLEGE_TRACKING_CYCLE',
  'CAREER_ROADMAP', 'SAVED_COURSE', 'FEEDBACK', 'INTEREST_RESPONSE',
  'SKILL_RESPONSE', 'PROFILE', 'OTP_VERIFICATION',
])
const ownershipEdges = [
  ['ASSESSMENT_ATTEMPT', 'PERSONALITY_ASSESSMENT', 'personality_assessment_id', 'assessment_id'],
  ['RECOMMENDATION', 'PERSONALITY_ASSESSMENT', 'assessment_id', 'assessment_id'],
  ['COLLEGE_TERM', 'COLLEGE_TRACKING_CYCLE', 'tracking_cycle_id', 'tracking_cycle_id'],
  ['SEMESTER_CHECKIN', 'COLLEGE_TERM', 'term_id', 'term_id'],
]

export async function deleteStudentAccount(pool, userId, password) {
  if (!Number.isSafeInteger(userId) || userId <= 0) throw new AccountDeletionError('UNAUTHORIZED', 401, 'Please sign in again.')
  const connection = await pool.getConnection()
  let committing = false
  let destroyed = false
  try {
    await connection.beginTransaction()
    const [[integrity]] = await connection.query('SELECT @@foreign_key_checks AS enabled')
    if (Number(integrity.enabled) !== 1) throw new Error('Foreign-key enforcement is required')
    const [accounts] = await connection.execute('SELECT user_id, password, is_active FROM USER_ACCOUNT WHERE user_id = ? FOR UPDATE', [userId])
    if (accounts.length !== 1 || accounts[0].is_active !== 1) throw new AccountDeletionError('UNAUTHORIZED', 401, 'Please sign in again.')
    if (!await bcrypt.compare(password, accounts[0].password)) throw new AccountDeletionError('INVALID_PASSWORD', 400, 'Your current password is incorrect.')

    // Lock every direct parent before deleting grandchildren. New direct inserts
    // wait on the account FK; indirect inserts wait on these parent row locks.
    // Existing writers can finish first or cause a deadlock: any failure rolls back.
    for (const table of STUDENT_TABLES) {
      await connection.execute(`SELECT user_id FROM ${table} WHERE user_id = ? FOR UPDATE`, [userId])
    }
    for (const [child, parent, fk, pk] of ownershipEdges) {
      const [rows] = await connection.execute(
        `SELECT c.user_id FROM ${child} c JOIN ${parent} p ON c.${fk} = p.${pk}
         WHERE (c.user_id = ? OR p.user_id = ?) AND c.user_id <> p.user_id LIMIT 1 FOR UPDATE`, [userId, userId])
      if (rows.length) throw new AccountDeletionError('OWNERSHIP_CONFLICT', 409, 'Account deletion could not be completed safely. Please contact the LearnMatch Research Team.')
    }
    await connection.execute('DELETE i FROM RECOMMENDATION_ITEM i JOIN RECOMMENDATION r ON r.recommendation_id = i.recommendation_id WHERE r.user_id = ?', [userId])
    for (const table of ['CHECKIN_ALIGNMENT_RESPONSE', 'AI_MISMATCH_ANALYSIS']) {
      await connection.execute(`DELETE c FROM ${table} c JOIN SEMESTER_CHECKIN s ON s.checkin_id = c.checkin_id WHERE s.user_id = ?`, [userId])
    }
    for (const table of STUDENT_TABLES) {
      await connection.execute(`DELETE FROM ${table} WHERE user_id = ?`, [userId])
    }
    const [result] = await connection.execute('DELETE FROM USER_ACCOUNT WHERE user_id = ?', [userId])
    if (result.affectedRows !== 1) throw new Error('Unexpected deletion count')
    for (const table of ['USER_ACCOUNT', ...STUDENT_TABLES]) {
      const [rows] = await connection.execute(`SELECT COUNT(*) AS remaining FROM ${table} WHERE user_id = ?`, [userId])
      if (Number(rows[0].remaining) !== 0) throw new Error('Incomplete deletion')
    }
    // Child FKs remain enabled, so successful parent removal also proves no
    // recommendation/check-in grandchildren can remain attached to those parents.
    committing = true
    await connection.commit()
    return { deleted: true }
  } catch (error) {
    if (committing) {
      // COMMIT may have reached MySQL even if its acknowledgement was lost.
      // Never retry, claim rollback/success, or return this connection to the pool.
      connection.destroy()
      destroyed = true
      throw new AccountDeletionError('DELETION_OUTCOME_UNKNOWN', 503, 'We could not confirm the deletion result. Do not submit again yet. Contact the LearnMatch Research Team to verify your account status.')
    }
    try { await connection.rollback() } catch { connection.destroy(); destroyed = true }
    if (error instanceof AccountDeletionError) throw error
    throw new AccountDeletionError('DELETION_FAILED', 503, 'Account deletion was not completed. Please try again later.')
  } finally {
    if (!destroyed) connection.release()
  }
}
