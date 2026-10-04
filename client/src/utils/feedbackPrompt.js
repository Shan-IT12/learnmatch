const PREFIX = 'learnmatch:feedback-prompt:'
const ACTIVE_KEY = 'learnmatch:feedback-prompt:active'

export function feedbackPromptKey(userId, recommendationId) {
  const normalizedUserId = String(userId || '').trim()
  const normalizedRecommendationId = Number(recommendationId)
  if (!normalizedUserId || !Number.isSafeInteger(normalizedRecommendationId) || normalizedRecommendationId <= 0) return null
  return `${normalizedUserId}:${normalizedRecommendationId}`
}

export function getFeedbackPromptState(storage, promptKey) {
  if (!storage || !promptKey) return null
  try {
    return storage.getItem(`${PREFIX}${promptKey}`)
  } catch {
    return null
  }
}

export function setFeedbackPromptState(storage, promptKey, state) {
  if (!storage || !promptKey || !['dismissed', 'submitted'].includes(state)) return
  try {
    storage.setItem(`${PREFIX}${promptKey}`, state)
  } catch {
    // Feedback prompting is optional; storage restrictions must not block results.
  }
}

export function shouldShowFeedbackPrompt(storage, promptKey, milestoneReached) {
  return Boolean(milestoneReached && promptKey && !getFeedbackPromptState(storage, promptKey))
}

export function setActiveFeedbackPromptKey(storage, promptKey) {
  if (!storage || !promptKey) return
  try {
    storage.setItem(ACTIVE_KEY, promptKey)
  } catch {
    // Manual feedback remains available if storage is unavailable.
  }
}

export function getActiveFeedbackPromptKey(storage) {
  if (!storage) return null
  try {
    return storage.getItem(ACTIVE_KEY)
  } catch {
    return null
  }
}
