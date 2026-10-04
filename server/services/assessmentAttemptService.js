export const ATTEMPT_HEADER = 'x-assessment-attempt-id'

export function requestedAttemptId(req) {
  const value = Number(req.get?.(ATTEMPT_HEADER))
  return Number.isSafeInteger(value) && value > 0 ? value : null
}

export async function getOwnedAttempt(database, userId, attemptId, { forUpdate = false } = {}) {
  if (!attemptId) return null
  const [rows] = await database.query(
    `SELECT attempt_id, status, personal_factors, interests, skill_questions, skill_answers, skill_result, personality_answers, personality_assessment_id
     FROM ASSESSMENT_ATTEMPT WHERE attempt_id = ? AND user_id = ?${forUpdate ? ' FOR UPDATE' : ''}`,
    [attemptId, userId]
  )
  return rows[0] || null
}

export async function getCurrentAttempt(database, userId) {
  const [rows] = await database.query(
    `SELECT attempt_id, status, personal_factors, interests, skill_questions, skill_answers, skill_result, personality_answers, personality_assessment_id
     FROM ASSESSMENT_ATTEMPT
     WHERE user_id = ? AND status = 'IN_PROGRESS'
     ORDER BY attempt_id DESC LIMIT 1`,
    [userId]
  )
  return rows[0] || null
}

export function parseAttemptJson(value, fallback = null) {
  if (value == null) return fallback
  if (typeof value === 'object') return value
  try { return JSON.parse(value) } catch { return fallback }
}

const PERSONAL_FACTOR_FIELDS = Object.freeze([
  'physical_accessibility_areas',
  'physical_accessibility_difficulties',
  'factor_physical_impact',
  'factor_health_impact',
  'factor_financial_impact',
  'factor_family_impact',
  'factor_work_impact',
])

export function buildPersonalFactorsSnapshot(profile) {
  if (!profile) return null
  const impacts = PERSONAL_FACTOR_FIELDS.slice(2).map((field) => Number(profile[field]))
  if (impacts.some((value) => !Number.isInteger(value) || value < 1 || value > 4)) return null
  const areas = parseAttemptJson(profile.physical_accessibility_areas, null)
  const difficulties = parseAttemptJson(profile.physical_accessibility_difficulties, null)
  if (!Array.isArray(areas) || !difficulties || typeof difficulties !== 'object' || Array.isArray(difficulties)) return null
  if (impacts[0] > 1 && areas.length === 0) return null
  if (Object.keys(difficulties).length !== areas.length || areas.some((area) => typeof difficulties[area] !== 'string')) return null
  return {
    physical_accessibility_areas: areas,
    physical_accessibility_difficulties: difficulties,
    ...Object.fromEntries(PERSONAL_FACTOR_FIELDS.slice(2).map((field) => [field, Number(profile[field])])),
  }
}

export async function getProfilePersonalFactorsSnapshot(database, userId) {
  const [rows] = await database.query(
    `SELECT ${PERSONAL_FACTOR_FIELDS.join(', ')} FROM PROFILE WHERE user_id = ? LIMIT 1`,
    [userId]
  )
  return buildPersonalFactorsSnapshot(rows[0])
}

export async function createAssessmentAttempt(database, userId) {
  const snapshot = await getProfilePersonalFactorsSnapshot(database, userId)
  const [result] = await database.query(
    `INSERT INTO ASSESSMENT_ATTEMPT
      (user_id, status, personal_factors, interests, skill_questions, skill_answers,
       skill_result, personality_answers, personality_assessment_id)
     VALUES (?, 'IN_PROGRESS', ?, NULL, NULL, NULL, NULL, NULL, NULL)`,
    [userId, snapshot ? JSON.stringify(snapshot) : null]
  )
  return { attemptId: result.insertId, personalFactors: snapshot }
}

export async function setAttemptPersonalFactors(database, userId, attemptId, snapshot) {
  if (!snapshot) return false
  const [result] = await database.query(
    `UPDATE ASSESSMENT_ATTEMPT SET personal_factors = ?
     WHERE attempt_id = ? AND user_id = ? AND status = 'IN_PROGRESS'`,
    [JSON.stringify(snapshot), attemptId, userId]
  )
  return result.affectedRows === 1
}

export async function ensureAttemptPersonalFactors(database, userId, attemptId) {
  const attempt = await getOwnedAttempt(database, userId, attemptId)
  if (!attempt || attempt.status !== 'IN_PROGRESS') return null
  const existing = buildPersonalFactorsSnapshot(parseAttemptJson(attempt.personal_factors, null))
  if (existing) return existing
  const snapshot = await getProfilePersonalFactorsSnapshot(database, userId)
  if (!snapshot) return null
  return await setAttemptPersonalFactors(database, userId, attemptId, snapshot) ? snapshot : null
}

export function scoreSkillAnswers(answers, questions) {
  const questionMap = new Map(questions.map((question) => [Number(question.question_id), question]))
  let correctCount = 0
  const domainScores = {}
  const scoredAnswers = answers.map((answer) => {
    const question = questionMap.get(Number(answer.question_id))
    if (!question) throw new Error('Skill answer references an unknown question')
    const isCorrect = question.correct_answer === answer.selected_option ? 1 : 0
    correctCount += isCorrect
    if (!domainScores[question.dimension]) domainScores[question.dimension] = { correct: 0, total: 0 }
    domainScores[question.dimension].total += 1
    domainScores[question.dimension].correct += isCorrect
    return { question_id: Number(answer.question_id), selected_option: answer.selected_option, is_correct: isCorrect }
  })
  return { scoredAnswers, correctCount, domainScores }
}

export async function insertFinalizedSkillResponses(database, userId, scoredAnswers) {
  for (const answer of scoredAnswers) {
    if (answer.is_correct !== 0 && answer.is_correct !== 1) throw new Error('Finalized skill correctness must be 0 or 1')
    await database.query(
      'INSERT INTO SKILL_RESPONSE (user_id, question_id, selected_option, is_correct) VALUES (?, ?, ?, ?)',
      [userId, answer.question_id, answer.selected_option, answer.is_correct]
    )
  }
}

export function hasMatchingFinalizedSkillResponses(storedResponses = [], scoredAnswers = []) {
  if (storedResponses.length !== scoredAnswers.length) return false
  const stored = new Map(storedResponses.map((answer) => [Number(answer.question_id), answer]))
  return scoredAnswers.every((answer) => {
    const match = stored.get(Number(answer.question_id))
    return match &&
      match.selected_option === answer.selected_option &&
      (match.is_correct === 0 || match.is_correct === 1)
  })
}

export async function ensureFinalizedSkillResponses(database, userId, skillAnswers) {
  const [storedResponses] = await database.query(
    `SELECT question_id, selected_option, is_correct FROM SKILL_RESPONSE
     WHERE user_id = ? ORDER BY skill_response_id DESC LIMIT 30`,
    [userId]
  )
  if (hasMatchingFinalizedSkillResponses(storedResponses, skillAnswers)) return false

  const questionIds = skillAnswers.map((answer) => answer.question_id)
  const placeholders = questionIds.map(() => '?').join(',')
  const [questions] = await database.query(
    `SELECT question_id, correct_answer, dimension FROM QUESTION
     WHERE question_id IN (${placeholders})`,
    questionIds
  )
  if (questions.length !== skillAnswers.length) {
    throw new Error('Finalized skill answers reference an unknown question')
  }

  const { scoredAnswers } = scoreSkillAnswers(skillAnswers, questions)
  await insertFinalizedSkillResponses(database, userId, scoredAnswers)
  return true
}

function savedAnswerCount(value) {
  if (Array.isArray(value)) return value.length
  if (value && typeof value === 'object') return Object.keys(value).length
  return 0
}

export function hasCompletePersonalityPrerequisites(attempt) {
  const personalFactors = parseAttemptJson(attempt?.personal_factors, null)
  const interests = parseAttemptJson(attempt?.interests, [])
  const skillQuestions = parseAttemptJson(attempt?.skill_questions, [])
  const skillAnswers = parseAttemptJson(attempt?.skill_answers, [])
  const skillResult = parseAttemptJson(attempt?.skill_result, null)
  const personalityAnswers = parseAttemptJson(attempt?.personality_answers, null)

  return Boolean(
    attempt &&
    personalFactors &&
    interests.length >= 3 &&
    skillQuestions.length === 30 &&
    skillAnswers.length === 30 &&
    skillResult &&
    savedAnswerCount(personalityAnswers) === 40
  )
}

export async function updateAttempt(database, userId, attemptId, field, value) {
  const allowed = new Set(['interests', 'skill_questions', 'skill_answers', 'skill_result', 'personality_answers'])
  if (!allowed.has(field)) throw new Error('Invalid assessment attempt field')
  const [result] = await database.query(
    `UPDATE ASSESSMENT_ATTEMPT SET ${field} = ? WHERE attempt_id = ? AND user_id = ? AND status = 'IN_PROGRESS'`,
    [JSON.stringify(value), attemptId, userId]
  )
  return result.affectedRows === 1
}


export async function updateCurrentAttemptDraft(database, userId, draft, attemptId = null) {
  const allowed = ['interests', 'skill_questions', 'skill_answers', 'personality_answers']
  const entries = allowed.filter((field) => Object.prototype.hasOwnProperty.call(draft, field))
  if (!entries.length) throw new Error('No supported assessment draft fields were provided')

  const assignments = entries.map((field) => `${field} = ?`).join(', ')
  const values = entries.map((field) => JSON.stringify(draft[field]))
  const requestedId = Number(attemptId)
  const hasRequestedAttempt = Number.isSafeInteger(requestedId) && requestedId > 0
  const [result] = await database.query(
    `UPDATE ASSESSMENT_ATTEMPT SET ${assignments}
     WHERE user_id = ? AND status = 'IN_PROGRESS'${hasRequestedAttempt ? ' AND attempt_id = ?' : ''}
     ${hasRequestedAttempt ? '' : 'ORDER BY attempt_id DESC LIMIT 1'}`,
    hasRequestedAttempt ? [...values, userId, requestedId] : [...values, userId]
  )
  return result.affectedRows === 1
}
