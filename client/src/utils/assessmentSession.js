export const ASSESSMENT_SESSION_KEYS = Object.freeze({
  attemptId: 'learnmatch:assessment:attempt-id',
  interests: 'learnmatch:assessment:interests',
  skills: 'learnmatch:assessment:skills',
  personality: 'learnmatch:assessment:personality',
  completedSteps: 'learnmatch:assessment:completed-steps',
})

let sessionGeneration = 0
export function invalidateAssessmentSession() {
  sessionGeneration += 1
  draftSaveQueues.clear()
}

export function getAssessmentAttemptId(storage) {
  const value = Number(storage?.getItem(ASSESSMENT_SESSION_KEYS.attemptId))
  return Number.isSafeInteger(value) && value > 0 ? value : null
}

export function assessmentHeaders(storage, headers = {}) {
  const attemptId = getAssessmentAttemptId(storage)
  return attemptId ? { ...headers, 'X-Assessment-Attempt-Id': String(attemptId) } : headers
}

export async function readActiveAttempt(apiUrl, token, storage) {
  const generation = sessionGeneration
  if (!getAssessmentAttemptId(storage)) return null
  const response = await fetch(`${apiUrl}/api/assessment-attempts/current`, {
    headers: assessmentHeaders(storage, { Authorization: `Bearer ${token}` }),
  })
  if (!response.ok) throw new Error('Could not load assessment progress.')
  const data = await response.json()
  return generation === sessionGeneration ? data : null
}

// Recover a missing browser session before allowing structured interest answers.
// Existing attempt IDs retain their normal ownership/status checks.
export async function restoreInterestAttempt(apiUrl, token, storage) {
  const generation = sessionGeneration
  if (!getAssessmentAttemptId(storage)) {
    const response = await fetch(`${apiUrl}/api/assessment-attempts/recover`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await response.json()
    if (generation !== sessionGeneration) return null
    if (!response.ok || !Number.isSafeInteger(data.attemptId) || data.attemptId <= 0) {
      throw new Error(data.message || 'Could not restore your assessment session.')
    }
    // Keep local interest answers while attaching the recovered attempt.
    storage?.setItem(ASSESSMENT_SESSION_KEYS.attemptId, String(data.attemptId))
  }
  return readActiveAttempt(apiUrl, token, storage)
}

const draftSaveQueues = new Map()

export async function saveActiveAttemptDraft(apiUrl, token, storage, draft) {
  const generation = sessionGeneration
  const attemptId = getAssessmentAttemptId(storage)
  if (!attemptId) return
  // Capture the attempt and payload now: queued writes must never move into a
  // fresh retake or finish out of order after navigation.
  const headers = assessmentHeaders(storage, { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` })
  const body = JSON.stringify(draft)
  const key = `${apiUrl}:${attemptId}`
  const pending = (draftSaveQueues.get(key) || Promise.resolve()).catch(() => {}).then(
    () => generation === sessionGeneration ? sendAttemptDraft(apiUrl, headers, body, generation) : undefined
  )
  draftSaveQueues.set(key, pending)
  try { await pending } finally {
    if (draftSaveQueues.get(key) === pending) draftSaveQueues.delete(key)
  }
}

async function sendAttemptDraft(apiUrl, headers, body, generation) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (generation !== sessionGeneration) return
    let response
    try {
      response = await fetch(`${apiUrl}/api/assessment-attempts/current`, {
        method: 'PATCH',
        headers,
        body,
      })
    } catch (error) {
      if (attempt === 1) throw error
    }
    if (response?.ok) return
    // Validation/auth/session failures need correction; repeating the identical
    // rejected request only produces another 400 and cannot save the draft.
    if (response && response.status < 500) {
      const data = await response.json().catch(() => ({}))
      const error = new Error(data.message || 'Could not save assessment progress.')
      error.status = response.status
      throw error
    }
    await new Promise((resolve) => setTimeout(resolve, 300))
  }
  throw new Error('Could not save assessment progress.')
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
