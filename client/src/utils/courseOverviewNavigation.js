const safeCourseSearchPath = (value) => (
  typeof value === 'string' && value.startsWith('/courses/search')
    ? value
    : '/courses/search'
)

export function getCourseOverviewBackNavigation(state) {
  if (state?.entryContext === 'landing') {
    return { path: '/', label: 'Back to Landing Page' }
  }

  if (state?.entryContext === 'dashboard') {
    return {
      path: safeCourseSearchPath(state.returnTo),
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
