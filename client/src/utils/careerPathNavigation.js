const RESULTS_DESTINATION = Object.freeze({
  path: '/results',
  label: 'Back to Results',
  key: 'results',
})

const SUMMARY_DESTINATION = Object.freeze({
  path: '/dashboard/summary',
  label: 'Back to Summary Dashboard',
  key: 'summary',
})

export function getCareerPathReturnDestination(search, hasActiveCollegePhase) {
  if (hasActiveCollegePhase) return RESULTS_DESTINATION
  const source = new URLSearchParams(search).get('returnTo')
  return source === SUMMARY_DESTINATION.key ? SUMMARY_DESTINATION : RESULTS_DESTINATION
}

export function careerPathChooserSearch(search) {
  const params = new URLSearchParams(search)
  params.delete('via')
  const query = params.toString()
  return query ? `?${query}` : ''
}

export function careerPathDetailSearch(search) {
  const params = new URLSearchParams(search)
  params.set('via', 'chooser')
  const query = params.toString()
  return query ? `?${query}` : ''
}

export function cameFromCareerPathChooser(search, navigationState) {
  return navigationState?.source === 'career-paths'
    || new URLSearchParams(search).get('via') === 'chooser'
}
