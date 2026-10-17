const labels = { confirmed_duplicate: 'Duplicate', alternative_title: 'Alternate title', historical: 'Historical title', malformed: 'Malformed title', quarantine: 'Quarantined identity' }

export function archivedCourseIdentity(course) {
  if (course.catalog_identity) return course.catalog_identity
  // Older backends already expose this authoritative registry exclusion reason.
  if (course.recommendation_readiness?.reasons?.some(reason => reason.code === 'INELIGIBLE_COURSE_IDENTITY')) return { status: 'excluded_identity' }
  return null
}

export function archivedCourseLabel(course) {
  const identity = archivedCourseIdentity(course)
  if (!identity) return ''
  const target = identity.canonical_course_id || identity.successor_course_ids?.join(', ')
  return `${labels[identity.status] || 'Excluded legacy identity'}${target ? ` - see ${target}` : ''}`
}

export function matchesCatalogScope(course, scope = 'current', status = 'all') {
  const archived = Boolean(archivedCourseIdentity(course))
  if (scope === 'all') return true
  if (scope === 'archived') return archived
  return !archived && (status === 'draft' ? Number(course.is_draft) === 1 : Number(course.is_draft) !== 1)
}

export function courseCatalogCounts(courses) {
  const counts = { original: 0, published: 0, drafts: 0, archived: 0 }
  for (const course of courses) {
    if (archivedCourseIdentity(course)) counts.archived++
    else if (Number(course.is_draft) === 1) counts.drafts++
    else if (Number(course.is_published_new) === 1) counts.published++
    else counts.original++
  }
  return counts
}
