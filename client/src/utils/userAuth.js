import { ASSESSMENT_SESSION_KEYS, invalidateAssessmentSession } from './assessmentSession.js'
import { FEEDBACK_ENTRY_CONTEXT_KEY } from './feedbackNavigation.js'

function browserSessionStorage() {
  try { return globalThis.sessionStorage } catch { return null }
}

export function clearStudentBrowserData(storage, session = browserSessionStorage()) {
  invalidateAssessmentSession()
  for (const target of new Set([storage, session])) {
    if (!target) continue
    const keys = new Set([...Object.values(ASSESSMENT_SESSION_KEYS), FEEDBACK_ENTRY_CONTEXT_KEY, 'learnmatch:feedback-prompt:active'])
    try {
      for (let index = 0; index < target.length; index += 1) {
        const key = target.key(index)
        if (key?.startsWith('learnmatch:assessment:') || key?.startsWith('learnmatch:feedback-prompt:')) keys.add(key)
      }
    } catch { /* Still clear known keys when enumeration is unavailable. */ }
    for (const key of keys) {
      try { target.removeItem(key) } catch { /* Restricted storage must not block logout. */ }
    }
  }
}

function announceAuthChange() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('learnmatch:auth-change'))
}

export function storeUserAuth(storage, auth, session = browserSessionStorage()) {
  // Also clears orphaned drafts when no previous account ID remains.
  clearStudentBrowserData(storage, session)
  storage.setItem('token', auth.token)
  storage.setItem('userId', String(auth.userId))
  storage.setItem('username', auth.username)
  announceAuthChange()
}

export function clearUserAuth(storage, session = browserSessionStorage()) {
  clearStudentBrowserData(storage, session)
  storage.removeItem('token')
  storage.removeItem('userId')
  storage.removeItem('username')
  announceAuthChange()
}

export function getPostRegistrationDestination() {
  return '/dashboard'
}
