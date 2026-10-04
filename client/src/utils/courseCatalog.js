export const getCourseCatalogUrl = (apiUrl, query) => {
  const normalizedQuery = query.trim()
  return normalizedQuery
    ? `${apiUrl}/api/public/courses/search?q=${encodeURIComponent(normalizedQuery)}`
    : `${apiUrl}/api/public/courses`
}
