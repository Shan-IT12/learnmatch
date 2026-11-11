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

export function getCareerPathReturnDestination(search) {
  const params = new URLSearchParams(search)
  if (params.get('returnTo') === SUMMARY_DESTINATION.key) return SUMMARY_DESTINATION
  const resultsParams = new URLSearchParams()
  if (params.get('saved') === '1') resultsParams.set('saved', '1')
  const resultsReturnTo = params.get('resultsReturnTo')
  if (['summary', 'college'].includes(resultsReturnTo)) resultsParams.set('returnTo', resultsReturnTo)
  const query = resultsParams.toString()
  return query ? { ...RESULTS_DESTINATION, path: `/results?${query}` } : RESULTS_DESTINATION
}

export function careerPathFromResultsSearch(search) {
  const resultsParams = new URLSearchParams(search)
  const params = new URLSearchParams({ returnTo: 'results' })
  if (resultsParams.get('saved') === '1') params.set('saved', '1')
  const returnTo = resultsParams.get('returnTo')
  if (['summary', 'college'].includes(returnTo)) params.set('resultsReturnTo', returnTo)
  return `?${params.toString()}`
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
