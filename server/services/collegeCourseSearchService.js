import { isCurrentIndependentCourse } from './courseIdentityService.js'
import { getPublicCourse, searchPublicCourses } from './publicCourseService.js'

const normalize = value => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const compact = value => normalize(value).replace(/ /g, '')
const catalog = searchPublicCourses('')

function matchesCourse(course, query) {
  const fields = [course.course_name, course.course_abbreviation, course.course_code]
  const tokens = normalize(query).split(' ').filter(Boolean)
  return fields.some(field => compact(field).includes(compact(query))) ||
    tokens.every(token => fields.some(field => normalize(field).includes(token)))
}

export function normalizeCourseSearchQuery(value) {
  return String(value || '').trim().replace(/\s+/g, ' ')
}

export async function searchActiveCollegeCourses(database, value) {
  const query = normalizeCourseSearchQuery(value)
  if (!query) return []
  if (!compact(query)) return []

  // Resolve catalog names/abbreviations to stable codes even when database labels are incomplete.
  const catalogCodes = catalog.filter(course => matchesCourse(course, query)).map(course => course.course_code)
  const catalogClause = catalogCodes.length ? `OR course_code IN (${catalogCodes.map(() => '?').join(', ')})` : ''

  const searchTerm = `%${query}%`
  const compactSearchTerm = `%${query.replace(/[.\s]/g, '')}%`
  const [courses] = await database.query(
    `SELECT course_id, course_code, course_name, course_abbreviation, cluster_category, program_duration_years,
            EXISTS(SELECT 1 FROM COURSE_PUBLICATION p WHERE p.course_id = COURSE.course_id) AS is_published_new
     FROM COURSE
     WHERE (
       LOWER(course_name) LIKE LOWER(?)
       OR LOWER(course_abbreviation) LIKE LOWER(?)
       OR LOWER(course_code) LIKE LOWER(?)
       OR LOWER(REPLACE(REPLACE(course_abbreviation, ' ', ''), '.', '')) LIKE LOWER(?)
       ${catalogClause}
     ) AND is_active = 1 AND is_draft = 0
     ORDER BY course_name, course_code`,
    [searchTerm, searchTerm, searchTerm, compactSearchTerm, ...catalogCodes]
  )

  return courses
    .filter(({ course_code, is_published_new }) => isCurrentIndependentCourse(course_code) && (getPublicCourse(course_code) || Number(is_published_new) === 1))
    .map((course) => ({
      ...course,
      course_abbreviation: course.course_abbreviation || getPublicCourse(course.course_code)?.course_abbreviation || null,
      program_duration_years: getPublicCourse(course.course_code)?.program_duration_years || course.program_duration_years || null,
    }))
    .sort((left, right) => {
      const exact = course => [course, getPublicCourse(course.course_code)].filter(Boolean)
        .some(item => [item.course_code, item.course_abbreviation, item.course_name].some(field => compact(field) === compact(query)))
      return Number(exact(right)) - Number(exact(left)) || left.course_name.localeCompare(right.course_name) || left.course_code.localeCompare(right.course_code)
    })
    .slice(0, 5)
}
