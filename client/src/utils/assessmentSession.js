export const ASSESSMENT_SESSION_KEYS = Object.freeze({
  attemptId: 'learnmatch:assessment:attempt-id',
  interests: 'learnmatch:assessment:interests',
  skills: 'learnmatch:assessment:skills',
  personality: 'learnmatch:assessment:personality',
  completedSteps: 'learnmatch:assessment:completed-steps',
})

export function getAssessmentAttemptId(storage) {
  const value = Number(storage?.getItem(ASSESSMENT_SESSION_KEYS.attemptId))
  return Number.isSafeInteger(value) && value > 0 ? value : null
}

export function assessmentHeaders(storage, headers = {}) {
  const attemptId = getAssessmentAttemptId(storage)
  return attemptId ? { ...headers, 'X-Assessment-Attempt-Id': String(attemptId) } : headers
}

export function beginAssessmentAttempt(storage, attemptId) {
  if (!storage) return
  Object.values(ASSESSMENT_SESSION_KEYS).forEach((key) => storage.removeItem(key))
  storage.setItem(ASSESSMENT_SESSION_KEYS.attemptId, String(attemptId))
}

export function finishAssessmentAttempt(storage) {
  if (!storage) return
  Object.values(ASSESSMENT_SESSION_KEYS).forEach((key) => storage.removeItem(key))
}

export function isEmptyAttemptProfileResponse(response, attemptId) {
  return Boolean(attemptId) && (response.status === 404 || response.status === 204)
}

export function readAssessmentSession(storage, key, fallback) {
  if (!storage) return fallback
  try {
    const value = JSON.parse(storage.getItem(key))
    return value && typeof value === 'object' ? value : fallback
  } catch {
    return fallback
  }
}

export function writeAssessmentSession(storage, key, value) {
  if (!storage) return
  storage.setItem(key, JSON.stringify(value))
}

export function boundedQuestionIndex(index, questionCount) {
  if (!Number.isInteger(index) || questionCount <= 0) return 0
  return Math.min(Math.max(index, 0), questionCount - 1)
}

export function firstUnansweredQuestionIndex(questions, answers, getId) {
  return questions.findIndex((question) => !answers[getId(question)])
}

export function readCompletedAssessmentSteps(storage) {
  const steps = readAssessmentSession(storage, ASSESSMENT_SESSION_KEYS.completedSteps, [])
  return Array.isArray(steps) ? steps.filter(Number.isInteger) : []
}

export function markAssessmentStepComplete(storage, stepNumber) {
  const completedSteps = readCompletedAssessmentSteps(storage)
  if (!completedSteps.includes(stepNumber)) completedSteps.push(stepNumber)
  writeAssessmentSession(storage, ASSESSMENT_SESSION_KEYS.completedSteps, completedSteps)
}
