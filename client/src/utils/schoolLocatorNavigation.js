const navigationBySource = Object.freeze({
  results: Object.freeze({ path: '/results', label: 'Back to Results' }),
  explorer: Object.freeze({ path: '/dashboard', label: 'Back to Dashboard' }),
  'public-search': Object.freeze({ path: '/courses/search', label: 'Back to Course Search' }),
})

export function getSchoolLocatorBackNavigation(source, isAuthenticated) {
  return navigationBySource[source]
    || (isAuthenticated
      ? navigationBySource.explorer
      : navigationBySource['public-search'])
}

