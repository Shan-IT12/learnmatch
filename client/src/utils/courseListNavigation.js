export function courseListLocation({ search = '', cluster = 'all', status = 'all', sort = 'name-asc', scope = 'current' } = {}, screen = {}) {
  const params = new URLSearchParams()
  if (search) params.set('search', search)
  if (cluster !== 'all') params.set('cluster', cluster)
  if (status !== 'all') params.set('status', status)
  if (sort !== 'name-asc') params.set('sort', sort)
  if (scope !== 'current') params.set('scope', scope)
  if (screen.courseId) params.set('course', String(screen.courseId))
  else if (screen.add) params.set('add', '1')
  const query = params.toString()
  return `/admin/courses${query ? `?${query}` : ''}`
}

export function readCourseListLocation(query) {
  const params = new URLSearchParams(query)
  return {
    search: params.get('search') || '', cluster: params.get('cluster') || 'all',
    status: ['active', 'inactive', 'draft'].includes(params.get('status')) ? params.get('status') : 'all',
    sort: ['name-asc', 'name-desc', 'code-asc', 'code-desc', 'active-first', 'inactive-first'].includes(params.get('sort')) ? params.get('sort') : 'name-asc',
    scope: ['current', 'archived', 'all'].includes(params.get('scope')) ? params.get('scope') : 'current',
    courseId: /^[1-9]\d*$/.test(params.get('course') || '') ? Number(params.get('course')) : null,
    add: params.get('add') === '1',
  }
}

export function matchesCourseStatus(course, status) {
  if (status === 'draft') return Number(course.is_draft) === 1
  const active = course.is_active === true || Number(course.is_active) === 1
  return status === 'all' || (status === 'active' ? active : !active)
}
