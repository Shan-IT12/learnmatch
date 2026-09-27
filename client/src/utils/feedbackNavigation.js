export const FEEDBACK_ENTRY_CONTEXT_KEY = 'learnmatch.feedbackEntryContext'

const validContexts = new Set(['dashboard', 'college'])

export function getFeedbackEntryContext(navigationContext, storedContext) {
  if (validContexts.has(navigationContext)) return navigationContext
  if (validContexts.has(storedContext)) return storedContext
  return 'dashboard'
}

export function getFeedbackDashboardPath(entryContext) {
  return entryContext === 'college' ? '/college' : '/dashboard'
}
