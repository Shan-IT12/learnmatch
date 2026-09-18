import { generateMismatchExplanation } from './collegeMismatchExplanationService.js'

export const CHECKIN_PHASES = ['Early', 'Mid', 'End']
export const YEAR_LEVELS = ['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year']
export const SEMESTERS = ['1st Semester', '2nd Semester', '3rd Semester', 'Summer']

export class CollegeTrackingError extends Error {
  constructor(message, code = 'COLLEGE_TRACKING_ERROR', status = 400) {
    super(message)
    this.name = 'CollegeTrackingError'
    this.code = code
    this.status = status
  }
}

function validateChoice(value, allowed, label) {
  if (!allowed.includes(value)) {
    throw new CollegeTrackingError(`Invalid ${label}.`, `INVALID_${label.toUpperCase().replace(/ /g, '_')}`)
  }
}

export function validateCheckinAnswers(answers) {
  if (!Array.isArray(answers) || answers.length !== 5) {
    throw new CollegeTrackingError('Please answer all 5 check-in questions.', 'INVALID_CHECKIN_ANSWERS')
  }

  const normalized = answers.map((answer) => ({
    question_number: Number(answer.question_number),
    score: Number(answer.score),
  }))
  const questionNumbers = normalized.map(({ question_number }) => question_number).sort((a, b) => a - b)

  if (questionNumbers.join(',') !== '1,2,3,4,5') {
    throw new CollegeTrackingError('Each check-in question must be answered exactly once.', 'INVALID_CHECKIN_ANSWERS')
  }
  if (normalized.some(({ score }) => !Number.isInteger(score) || score < 1 || score > 5)) {
    throw new CollegeTrackingError('Check-in answers must use the 1 to 5 scale.', 'INVALID_CHECKIN_ANSWERS')
  }

  return normalized.sort((left, right) => left.question_number - right.question_number)
}

export function calculateAlignmentResult(answers, { phase, gwa = null } = {}) {
  const normalizedAnswers = validateCheckinAnswers(answers)
  validateChoice(phase, CHECKIN_PHASES, 'check-in phase')

  const normalizedGwa = gwa === '' || gwa === undefined || gwa === null ? null : Number(gwa)
  if (normalizedGwa !== null && (!Number.isFinite(normalizedGwa) || normalizedGwa < 0 || normalizedGwa > 100)) {
    throw new CollegeTrackingError('GWA must be from 0 to 100.', 'INVALID_GWA')
  }
  if (phase !== 'End' && normalizedGwa !== null) {
    throw new CollegeTrackingError('GWA can only be recorded during the End check-in.', 'INVALID_GWA_PHASE')
  }

  const average = normalizedAnswers.reduce((sum, answer) => sum + answer.score, 0) / normalizedAnswers.length
  const alignmentPercent = Math.round(((average - 1) / 4) * 100)
  const mismatchScore = 100 - alignmentPercent

  let status
  if (phase === 'End' && normalizedGwa !== null) {
    const passing = normalizedGwa >= 75
    const highAlignment = alignmentPercent >= 70
    if (passing && highAlignment) status = 'On Track'
    else if (passing || highAlignment) status = 'Monitor'
    else status = 'Needs Attention'
  } else if (mismatchScore < 30) status = 'On Track'
  else if (mismatchScore < 60) status = 'Monitor'
  else status = 'Needs Attention'

  return {
    answers: normalizedAnswers,
    gwa: normalizedGwa,
    alignmentPercent,
    alignmentScore: alignmentPercent / 100,
    mismatchScore,
    status,
  }
}

export async function createCollegeSetup(pool, userId, { courseId, yearLevel, semester, startingPhase }) {
  const normalizedCourseId = Number(courseId)
  if (!Number.isInteger(normalizedCourseId) || normalizedCourseId <= 0) {
    throw new CollegeTrackingError('Please select a valid active course.', 'INVALID_COURSE')
  }
  validateChoice(yearLevel, YEAR_LEVELS, 'year level')
  validateChoice(semester, SEMESTERS, 'semester')
  validateChoice(startingPhase, CHECKIN_PHASES, 'starting phase')

  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    const [courses] = await connection.query(
      'SELECT course_id, course_code, course_name FROM COURSE WHERE course_id = ? AND is_active = 1',
      [normalizedCourseId]
    )
    if (courses.length === 0) {
      throw new CollegeTrackingError('The selected course is unavailable or inactive.', 'COURSE_UNAVAILABLE', 404)
    }

    const [existing] = await connection.query(
      `SELECT checkin_id
       FROM SEMESTER_CHECKIN
       WHERE user_id = ? AND course_id = ? AND year_level = ? AND semester = ? AND phase = ?
         AND NOT EXISTS (
           SELECT 1 FROM CHECKIN_ALIGNMENT_RESPONSE response
           WHERE response.checkin_id = SEMESTER_CHECKIN.checkin_id
         )
       ORDER BY checkin_id DESC
       LIMIT 1
       FOR UPDATE`,
      [userId, normalizedCourseId, yearLevel, semester, startingPhase]
    )
    if (existing.length > 0) {
      await connection.commit()
      return { created: false, checkinId: existing[0].checkin_id, course: courses[0] }
    }

    const [result] = await connection.query(
      `INSERT INTO SEMESTER_CHECKIN (user_id, course_id, semester, phase, year_level)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, normalizedCourseId, semester, startingPhase, yearLevel]
    )
    await connection.commit()
    return { created: true, checkinId: result.insertId, course: courses[0] }
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

export async function getCollegeStatus(database, userId) {
  const [rows] = await database.query(
    `SELECT sc.checkin_id, sc.year_level, sc.semester, sc.phase, sc.gwa,
            c.course_id, c.course_code, c.course_name,
            (SELECT previous.gwa
             FROM SEMESTER_CHECKIN previous
             WHERE previous.user_id = sc.user_id AND previous.gwa IS NOT NULL
             ORDER BY previous.checkin_id DESC LIMIT 1) AS latest_gwa
     FROM SEMESTER_CHECKIN sc
     JOIN COURSE c ON c.course_id = sc.course_id
     WHERE sc.user_id = ?
     ORDER BY sc.checkin_id DESC
     LIMIT 1`,
    [userId]
  )
  if (rows.length === 0) return null
  const row = rows[0]
  return {
    checkinId: row.checkin_id,
    courseId: row.course_id,
    courseCode: row.course_code,
    courseName: row.course_name,
    yearLevel: row.year_level,
    semester: row.semester,
    currentPhase: row.phase,
    latestGwa: row.latest_gwa === null ? null : Number(row.latest_gwa),
  }
}

export async function getPendingCheckin(database, userId) {
  const [rows] = await database.query(
    `SELECT sc.checkin_id, sc.phase, c.course_code, c.course_name
     FROM SEMESTER_CHECKIN sc
     JOIN COURSE c ON c.course_id = sc.course_id
     WHERE sc.user_id = ?
       AND NOT EXISTS (
         SELECT 1 FROM CHECKIN_ALIGNMENT_RESPONSE response
         WHERE response.checkin_id = sc.checkin_id
       )
     ORDER BY sc.checkin_id DESC
     LIMIT 1`,
    [userId]
  )
  return rows[0] || null
}

export async function submitCollegeCheckin(
  pool,
  userId,
  { checkinId, answers, gwa },
  explainMismatch = generateMismatchExplanation
) {
  const normalizedCheckinId = Number(checkinId)
  if (!Number.isInteger(normalizedCheckinId) || normalizedCheckinId <= 0) {
    throw new CollegeTrackingError('Invalid check-in.', 'INVALID_CHECKIN')
  }

  const [ownedRows] = await pool.query(
    `SELECT sc.checkin_id, sc.phase, c.course_name
     FROM SEMESTER_CHECKIN sc
     JOIN COURSE c ON c.course_id = sc.course_id
     WHERE sc.checkin_id = ? AND sc.user_id = ?`,
    [normalizedCheckinId, userId]
  )
  if (ownedRows.length === 0) {
    throw new CollegeTrackingError('Check-in not found.', 'CHECKIN_NOT_FOUND', 404)
  }

  const calculation = calculateAlignmentResult(answers, { phase: ownedRows[0].phase, gwa })
  const explanation = await explainMismatch({
    ...calculation,
    phase: ownedRows[0].phase,
    courseName: ownedRows[0].course_name,
  })

  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    const [lockedRows] = await connection.query(
      `SELECT checkin_id FROM SEMESTER_CHECKIN
       WHERE checkin_id = ? AND user_id = ? FOR UPDATE`,
      [normalizedCheckinId, userId]
    )
    if (lockedRows.length === 0) {
      throw new CollegeTrackingError('Check-in not found.', 'CHECKIN_NOT_FOUND', 404)
    }

    const [[existing]] = await connection.query(
      `SELECT
         (SELECT COUNT(*) FROM CHECKIN_ALIGNMENT_RESPONSE WHERE checkin_id = ?) AS response_count,
         (SELECT COUNT(*) FROM AI_MISMATCH_ANALYSIS WHERE checkin_id = ?) AS analysis_count`,
      [normalizedCheckinId, normalizedCheckinId]
    )
    if (Number(existing.response_count) > 0 || Number(existing.analysis_count) > 0) {
      throw new CollegeTrackingError('This check-in was already submitted.', 'CHECKIN_ALREADY_SUBMITTED', 409)
    }

    for (const answer of calculation.answers) {
      await connection.query(
        `INSERT INTO CHECKIN_ALIGNMENT_RESPONSE (checkin_id, question_number, answer_score)
         VALUES (?, ?, ?)`,
        [normalizedCheckinId, answer.question_number, answer.score]
      )
    }
    await connection.query(
      'UPDATE SEMESTER_CHECKIN SET gwa = ?, alignment_score = ? WHERE checkin_id = ?',
      [calculation.gwa, calculation.alignmentScore, normalizedCheckinId]
    )
    await connection.query(
      `INSERT INTO AI_MISMATCH_ANALYSIS
        (checkin_id, mismatch_score, status, ai_feedback, recommendation)
       VALUES (?, ?, ?, ?, ?)`,
      [
        normalizedCheckinId,
        Math.min(calculation.mismatchScore, 99.99),
        calculation.status,
        explanation.feedback,
        explanation.recommendation,
      ]
    )
    await connection.commit()
    return { ...calculation, ...explanation }
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

export async function getCheckinHistory(database, userId, limit = 10) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 10, 50))
  const [rows] = await database.query(
    `SELECT sc.checkin_id, sc.phase, sc.year_level, sc.semester, sc.gwa,
            sc.alignment_score, sc.checkin_date, c.course_code, c.course_name,
            analysis.mismatch_score, analysis.status, analysis.ai_feedback, analysis.recommendation
     FROM SEMESTER_CHECKIN sc
     JOIN COURSE c ON c.course_id = sc.course_id
     JOIN AI_MISMATCH_ANALYSIS analysis ON analysis.analysis_id = (
       SELECT MAX(latest.analysis_id) FROM AI_MISMATCH_ANALYSIS latest
       WHERE latest.checkin_id = sc.checkin_id
     )
     WHERE sc.user_id = ?
     ORDER BY sc.checkin_id DESC
     LIMIT ?`,
    [userId, safeLimit]
  )
  return rows.map((row) => ({
    checkinId: row.checkin_id,
    phase: row.phase,
    yearLevel: row.year_level,
    semester: row.semester,
    gwa: row.gwa === null ? null : Number(row.gwa),
    alignmentPercent: row.alignment_score === null
      ? Math.round(100 - Number(row.mismatch_score))
      : Math.round(Number(row.alignment_score) * 100),
    status: row.status,
    feedback: row.ai_feedback,
    recommendation: row.recommendation,
    courseCode: row.course_code,
    courseName: row.course_name,
    checkinDate: row.checkin_date,
  }))
}

export async function getCheckinStatus(database, userId) {
  const pending = await getPendingCheckin(database, userId)
  const history = await getCheckinHistory(database, userId, 1)
  const latestResult = history[0] || null

  if (pending) {
    return {
      state: 'pending',
      checkinId: pending.checkin_id,
      phase: pending.phase,
      currentPhase: pending.phase,
      courseName: pending.course_name,
      latestResult,
    }
  }

  const [rows] = await database.query(
    `SELECT sc.checkin_id, sc.phase, sc.course_id, sc.year_level, sc.semester, c.course_name
     FROM SEMESTER_CHECKIN sc
     JOIN COURSE c ON c.course_id = sc.course_id
     WHERE sc.user_id = ?
     ORDER BY sc.checkin_id DESC
     LIMIT 1`,
    [userId]
  )
  if (rows.length === 0) return { state: 'complete', latestResult }

  const currentPhase = rows[0].phase
  const nextPhase = CHECKIN_PHASES[CHECKIN_PHASES.indexOf(currentPhase) + 1]
  return nextPhase
    ? { state: 'due', nextPhase, currentPhase, courseName: rows[0].course_name, latestResult }
    : { state: 'complete', currentPhase, courseName: rows[0].course_name, latestResult }
}

export async function startNextCheckin(pool, userId) {
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    const [rows] = await connection.query(
      `SELECT checkin_id, course_id, year_level, semester, phase
       FROM SEMESTER_CHECKIN
       WHERE user_id = ?
       ORDER BY checkin_id DESC
       LIMIT 1
       FOR UPDATE`,
      [userId]
    )
    if (rows.length === 0) throw new CollegeTrackingError('No prior enrollment found.', 'NO_ENROLLMENT')

    const last = rows[0]
    const [[completion]] = await connection.query(
      'SELECT COUNT(*) AS response_count FROM CHECKIN_ALIGNMENT_RESPONSE WHERE checkin_id = ?',
      [last.checkin_id]
    )
    if (Number(completion.response_count) !== 5) {
      await connection.commit()
      return { created: false, checkinId: last.checkin_id, phase: last.phase }
    }

    const nextPhase = CHECKIN_PHASES[CHECKIN_PHASES.indexOf(last.phase) + 1]
    if (!nextPhase) throw new CollegeTrackingError('All check-ins are complete for this semester.', 'CHECKINS_COMPLETE')

    const [existing] = await connection.query(
      `SELECT checkin_id FROM SEMESTER_CHECKIN
       WHERE user_id = ? AND course_id = ? AND year_level = ? AND semester = ? AND phase = ?
       ORDER BY checkin_id DESC LIMIT 1`,
      [userId, last.course_id, last.year_level, last.semester, nextPhase]
    )
    if (existing.length > 0) {
      await connection.commit()
      return { created: false, checkinId: existing[0].checkin_id, phase: nextPhase }
    }

    const [result] = await connection.query(
      `INSERT INTO SEMESTER_CHECKIN (user_id, course_id, semester, phase, year_level)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, last.course_id, last.semester, nextPhase, last.year_level]
    )
    await connection.commit()
    return { created: true, checkinId: result.insertId, phase: nextPhase }
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}
