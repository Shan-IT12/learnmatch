import pool from '../config/db.js'

export const SCHOOL_LOCATOR_SCOPE = 'San Jose del Monte, Bulacan'
export const SCHOOL_LOCATOR_ACADEMIC_YEAR = '2024-25'

const normalizeCourseCode = (value) => String(value || '').trim().toUpperCase()
const normalizeMajor = (value) => String(value || '').trim().toLowerCase()

export async function getSchoolsForCourse(courseCode, database = pool) {
  const normalizedCode = normalizeCourseCode(courseCode)
  if (!/^CRS\d{3}$/.test(normalizedCode)) return null

  const [courseRows] = await database.query(
    `SELECT course_id, course_code, course_name, course_abbreviation
     FROM COURSE
     WHERE course_code = ? AND is_active = 1`,
    [normalizedCode]
  )

  if (courseRows.length !== 1) return null
  const course = courseRows[0]

  const [offeringRows] = await database.query(
    `SELECT s.school_id, s.uii, s.school_name, s.hei_type, s.hei_type2, s.address,
            sc.major
     FROM SCHOOL_COURSE sc
     JOIN SCHOOL s ON s.school_id = sc.school_id
     WHERE sc.course_id = ? AND s.is_active = 1
     ORDER BY s.school_name ASC, sc.major ASC`,
    [course.course_id]
  )

  const schoolsById = new Map()
  for (const row of offeringRows) {
    if (!schoolsById.has(row.school_id)) {
      schoolsById.set(row.school_id, {
        school_id: row.school_id,
        school_name: row.school_name,
        uii: row.uii,
        hei_type: row.hei_type,
        hei_type2: row.hei_type2,
        address: row.address,
        offerings: [],
      })
    }

    const school = schoolsById.get(row.school_id)
    const normalizedMajor = normalizeMajor(row.major)
    if (!school.offerings.some((offering) => normalizeMajor(offering.major) === normalizedMajor)) {
      school.offerings.push({ major: row.major || null })
    }
  }

  return {
    course: {
      course_code: course.course_code,
      course_name: course.course_name,
      course_abbreviation: course.course_abbreviation || null,
    },
    location_scope: SCHOOL_LOCATOR_SCOPE,
    academic_year: SCHOOL_LOCATOR_ACADEMIC_YEAR,
    schools: [...schoolsById.values()],
  }
}
