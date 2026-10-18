export function getProfileReturnDestination(search = '', state = null) {
  const returnTo = new URLSearchParams(search).get('returnTo')
  if (returnTo === 'summary' || (!returnTo && state?.assessmentComplete === true)) {
    return { path: '/dashboard/summary', label: 'Back to Summary Dashboard', search: '?returnTo=summary' }
  }
  return { path: '/dashboard', label: 'Back to Dashboard', search: '' }
}
