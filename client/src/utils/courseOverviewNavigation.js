const safeCourseSearchPath = (value) => (
  typeof value === 'string' && value.startsWith('/courses/search')
    ? value
    : '/courses/search'
)

export function getCourseOverviewBackNavigation(state, search = '', hasActiveCollegePhase = false) {
  const source = new URLSearchParams(search).get('source')

  if (hasActiveCollegePhase || state?.entryContext === 'results' || source === 'results') {
    return { path: '/results', label: 'Back to Results' }
  }

  const fromDashboard = source === 'dashboard'
  if (state?.entryContext === 'landing') {
    return { path: '/courses/search', label: 'Back to Course Search' }
  }

  if (state?.entryContext === 'dashboard' || fromDashboard) {
    return {
      path: state?.returnTo ? safeCourseSearchPath(state.returnTo) : '/courses/search?source=dashboard',
      label: 'Back to Course Search',
      state: { entryContext: 'dashboard' },
    }
  }

  if (state?.entryContext === 'public-search') {
    return {
      path: safeCourseSearchPath(state.returnTo),
      label: 'Back to Course Search',
    }
  }

  return { path: '/courses/search', label: 'Back to Course Search' }
}
