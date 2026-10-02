const navigationBySource = Object.freeze({
  results: Object.freeze({ path: '/results', label: 'Back to Results' }),
  explorer: Object.freeze({ path: '/dashboard', label: 'Back to Dashboard' }),
  'public-search': Object.freeze({ path: '/courses/search', label: 'Back to Course Search' }),
})

export function getSchoolLocatorBackNavigation(source, isAuthenticated) {
  if (source?.name === 'course-overview' && /^\/courses\/[^/?#]+(?:[?#].*)?$/.test(source.returnTo || '')) {
    return {
      path: source.returnTo,
      label: 'Back to Course Overview',
      state: source.returnState || undefined,
    }
  }

  return navigationBySource[source]
    || (isAuthenticated
      ? navigationBySource.explorer
      : navigationBySource['public-search'])
}
