import pool from '../config/db.js'
import verified from '../data/schoolLocatorVerifiedOfferings.json' with { type: 'json' }
import { resolveCanonicalCourseIds } from './courseIdentityService.js'

export const SCHOOL_LOCATOR_SCOPE = 'San Jose del Monte, Bulacan'
// Historic CSV year; current locator evidence has its own verification date.
export const SCHOOL_LOCATOR_ACADEMIC_YEAR = '2024-25'

const normalizeCourseCode = (value) => String(value || '').trim().toUpperCase()
export async function getSchoolsForCourse(courseCode, database = pool) {
  const normalizedCode = normalizeCourseCode(courseCode)
  if (!/^CRS\d{3,7}$/.test(normalizedCode)) return null
  const resolvedCourseCodes = resolveCanonicalCourseIds(normalizedCode)
  if (resolvedCourseCodes.length !== 1) return null

  const [courseRows] = await database.query(
    `SELECT course_id, course_code, course_name, course_abbreviation
     FROM COURSE
     WHERE course_code = ? AND is_active = 1 AND is_draft = 0`,
    [resolvedCourseCodes[0]]
  )

  if (courseRows.length !== 1) return null
  const course = courseRows[0]

  // Locator-only evidence overlay: never mutate shared mappings or recommendations.
  const matches = verified.schools.flatMap(school => {
    const offerings = school.programs.filter(program => program.status === 'ACTIVE'
      && program.course_codes.includes(course.course_code))
    return offerings.length ? [{ ...school, offerings }] : []
  })
  let schoolRows = []
  if (matches.length) {
    ;[schoolRows] = await database.query(
      `SELECT school_id, uii, school_name, hei_type, hei_type2, address
       FROM SCHOOL WHERE is_active = 1 AND uii IN (?) ORDER BY school_name ASC`,
      [matches.map(school => school.uii)]
    )
  }
  const schools = schoolRows.flatMap(row => {
    const evidence = matches.find(school => school.uii === row.uii)
    if (!evidence) return []
    return [{
      school_id: row.school_id, uii: row.uii, school_name: evidence.school_name,
      hei_type: row.hei_type, hei_type2: row.hei_type2, address: evidence.address,
      latitude: evidence.latitude, longitude: evidence.longitude,
      location_note: evidence.location_note, coordinate_source_url: evidence.coordinate_source_url,
      offering_source_url: verified.source_url, verified_on: verified.verified_on,
      offerings: evidence.offerings.map(program => ({
        program_name: program.program_name, major: null,
        source_url: program.source_url || verified.source_url,
      })),
    }]
  })

  return {
    course: {
      course_code: course.course_code,
      course_name: course.course_name,
      course_abbreviation: course.course_abbreviation || null,
    },
    location_scope: SCHOOL_LOCATOR_SCOPE,
    evidence_note: verified.note,
    verified_on: verified.verified_on,
    schools,
  }
}
