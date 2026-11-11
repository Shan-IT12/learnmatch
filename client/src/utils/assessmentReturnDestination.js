export const SUMMARY_DASHBOARD_DESTINATION = Object.freeze({
  path: '/dashboard/summary',
  label: 'Return to Summary Dashboard',
})

export const COLLEGE_DASHBOARD_DESTINATION = Object.freeze({
  path: '/college',
  label: 'Return to College Dashboard',
})

export const MAIN_DASHBOARD_DESTINATION = Object.freeze({
  path: '/dashboard',
  label: 'Return to Dashboard',
})

export function getAssessmentReturnDestination(collegeStatus, returnTo) {
  if (returnTo === 'summary') return SUMMARY_DASHBOARD_DESTINATION
  return collegeStatus?.lifecycleStatus === 'active'
    ? COLLEGE_DASHBOARD_DESTINATION
    : SUMMARY_DASHBOARD_DESTINATION
}

export function getAssessmentCancelDestination(hasActiveCollegePhase) {
  return hasActiveCollegePhase
    ? COLLEGE_DASHBOARD_DESTINATION
    : MAIN_DASHBOARD_DESTINATION
}

export function getSavedResultsPath(search, returnPath) {
  const params = new URLSearchParams(search)
  params.set('saved', '1')
  params.set('returnTo', returnPath === '/college' ? 'college' : 'summary')
  return `/results?${params.toString()}`
}
