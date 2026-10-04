import { isCurrentIndependentCourse } from './courseIdentityService.js'
import { getPublicCourse } from './publicCourseService.js'

export function normalizeCourseSearchQuery(value) {
  return String(value || '').trim().replace(/\s+/g, ' ')
}

export async function searchActiveCollegeCourses(database, value) {
  const query = normalizeCourseSearchQuery(value)
  if (!query) return []

  const searchTerm = `%${query}%`
  const compactSearchTerm = `%${query.replace(/[.\s]/g, '')}%`
  const [courses] = await database.query(
    `SELECT course_id, course_code, course_name, course_abbreviation, cluster_category
     FROM COURSE
     WHERE (
       LOWER(course_name) LIKE LOWER(?)
       OR LOWER(course_abbreviation) LIKE LOWER(?)
       OR LOWER(course_code) LIKE LOWER(?)
       OR LOWER(REPLACE(REPLACE(course_abbreviation, ' ', ''), '.', '')) LIKE LOWER(?)
     ) AND is_active = 1
     LIMIT 25`,
    [searchTerm, searchTerm, searchTerm, compactSearchTerm]
  )

  return courses
    .filter(({ course_code }) => isCurrentIndependentCourse(course_code))
    .map((course) => ({
      ...course,
      program_duration_years: getPublicCourse(course.course_code)?.program_duration_years || null,
    }))
    .slice(0, 5)
}
