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
  if (!token) return null
  const originalId = getAssessmentAttemptId(storage)
  let response = await fetch(`${apiUrl}/api/assessment-attempts/current`, {
    headers: assessmentHeaders(storage, { Authorization: `Bearer ${token}` }),
    cache: 'no-store',
  })
  // A stale, completed or foreign browser ID must never select another user's
  // draft. Fall back to the server's authenticated current-attempt lookup.
  if (response.status === 404 && originalId && generation === sessionGeneration) {
    response = await fetch(`${apiUrl}/api/assessment-attempts/current`, {
      headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
    })
  }
  if (generation !== sessionGeneration) return null
  if (response.status === 404) {
    finishAssessmentAttempt(storage)
    return null
  }
  if (!response.ok) throw new Error('Could not load assessment progress.')
  const data = await response.json()
  if (generation !== sessionGeneration) return null
  if (!Number.isSafeInteger(data.attemptId) || data.attemptId <= 0) throw new Error('Invalid assessment progress response.')
  if (data.attemptId !== getAssessmentAttemptId(storage)) beginAssessmentAttempt(storage, data.attemptId)
  return data
}

// Recover a missing browser session before allowing structured interest answers.
// Existing attempt IDs retain their normal ownership/status checks.
export async function restoreInterestAttempt(apiUrl, token, storage) {
  const generation = sessionGeneration
  const current = await readActiveAttempt(apiUrl, token, storage)
  if (current || generation !== sessionGeneration) return current
  if (!getAssessmentAttemptId(storage)) {
    const key = `${generation}:${apiUrl}:${token}`
    if (!attemptRecoveries.has(key)) {
      const request = fetch(`${apiUrl}/api/assessment-attempts/recover`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` },
      }).then(async response => ({ ok: response.ok, data: await response.json() }))
        .finally(() => attemptRecoveries.delete(key))
      attemptRecoveries.set(key, request)
    }
    const { ok, data } = await attemptRecoveries.get(key)
    if (generation !== sessionGeneration) return null
    if (!ok || !Number.isSafeInteger(data.attemptId) || data.attemptId <= 0) {
      throw new Error(data.message || 'Could not restore your assessment session.')
    }
    // Keep local interest answers while attaching the recovered attempt.
    storage?.setItem(ASSESSMENT_SESSION_KEYS.attemptId, String(data.attemptId))
  }
  return readActiveAttempt(apiUrl, token, storage)
}

const draftSaveQueues = new Map()
const attemptRecoveries = new Map()

export async function saveActiveAttemptDraft(apiUrl, token, storage, draft) {
  const generation = sessionGeneration
  const attemptId = getAssessmentAttemptId(storage)
  if (!attemptId || !token) throw new Error('Could not restore your assessment. Please refresh before saving.')
  // Capture the attempt and payload now: queued writes must never move into a
  // fresh retake or finish out of order after navigation.
  const headers = assessmentHeaders(storage, { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` })
  const body = JSON.stringify(draft)
  const key = `${apiUrl}:${token}:${attemptId}`
  const pending = (draftSaveQueues.get(key) || Promise.resolve()).catch(() => {}).then(
    () => {
      if (generation !== sessionGeneration) throw new Error('Your assessment session has changed. Please sign in again.')
      return sendAttemptDraft(apiUrl, headers, body, generation)
    }
  )
  draftSaveQueues.set(key, pending)
  try { await pending } finally {
    if (draftSaveQueues.get(key) === pending) draftSaveQueues.delete(key)
  }
}

async function sendAttemptDraft(apiUrl, headers, body, generation) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (generation !== sessionGeneration) throw new Error('Your assessment session has changed. Please sign in again.')
    let response
    try {
      response = await fetch(`${apiUrl}/api/assessment-attempts/current`, {
        method: 'PATCH',
        headers,
        body,
        keepalive: true,
      })
    } catch (error) {
      if (attempt === 1) throw error
    }
    if (generation !== sessionGeneration) throw new Error('Your assessment session has changed. Please sign in again.')
    // Drain every response, including success, before starting another queued
    // keepalive request. Unread bodies retain the browser's shared 64 KiB
    // keepalive budget and eventually prevent Skills autosave from sending.
    const data = response ? await response.json().catch(() => null) : null
    if (generation !== sessionGeneration) throw new Error('Your assessment session has changed. Please sign in again.')
    if (response?.ok) {
      if (data?.saved !== true) throw new Error('Could not confirm that your progress was saved. Please retry.')
      return
    }
    // Validation/auth/session failures need correction; repeating the identical
    // rejected request only produces another 400 and cannot save the draft.
    if (response && response.status < 500) {
      const error = new Error(data?.message || 'Could not save assessment progress.')
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
  const { pending, pendingSaveId } = readAssessmentSession(storage, key, {})
  storage.setItem(key, JSON.stringify(!Array.isArray(value) && pending !== undefined ? { pending, pendingSaveId, ...value } : value))
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
