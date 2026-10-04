export const ATTEMPT_HEADER = 'x-assessment-attempt-id'

export function requestedAttemptId(req) {
  const value = Number(req.get?.(ATTEMPT_HEADER))
  return Number.isSafeInteger(value) && value > 0 ? value : null
}

export async function getOwnedAttempt(database, userId, attemptId, { forUpdate = false } = {}) {
  if (!attemptId) return null
  const [rows] = await database.query(
    `SELECT attempt_id, status, personal_factors, interests, skill_answers, skill_result, personality_assessment_id
     FROM ASSESSMENT_ATTEMPT WHERE attempt_id = ? AND user_id = ?${forUpdate ? ' FOR UPDATE' : ''}`,
    [attemptId, userId]
  )
  return rows[0] || null
}

export function parseAttemptJson(value, fallback = null) {
  if (value == null) return fallback
  if (typeof value === 'object') return value
  try { return JSON.parse(value) } catch { return fallback }
}

export async function updateAttempt(database, userId, attemptId, field, value) {
  const allowed = new Set(['interests', 'skill_answers', 'skill_result'])
  if (!allowed.has(field)) throw new Error('Invalid assessment attempt field')
  const [result] = await database.query(
    `UPDATE ASSESSMENT_ATTEMPT SET ${field} = ? WHERE attempt_id = ? AND user_id = ? AND status = 'IN_PROGRESS'`,
    [JSON.stringify(value), attemptId, userId]
  )
  return result.affectedRows === 1
}
