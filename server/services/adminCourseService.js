import { PARENT_CLUSTERS, RIASEC_DIMENSIONS, SKILL_DOMAINS } from '../config/recommendationConfig.js'
import { isCurrentIndependentCourse } from './courseIdentityService.js'

const reasonMessages = Object.freeze({
  MISSING_COURSE_CODE: 'Missing stable course code',
  INELIGIBLE_COURSE_IDENTITY: 'Course code is not an eligible independent program',
  INVALID_CLUSTER: 'Invalid cluster',
  MISSING_SKILL_PROFILE: 'Missing skill matching profile',
  INVALID_SKILL_PROFILE: 'Invalid skill matching profile',
  INCOMPLETE_RIASEC_PROFILE: 'Incomplete RIASEC profile',
  INVALID_RIASEC_PROFILE: 'Invalid RIASEC profile',
})

function addReason(reasons, code) {
  if (!reasons.some((reason) => reason.code === code)) {
    reasons.push({ code, message: reasonMessages[code] })
  }
}

export function evaluateRecommendationReadiness(course, skillProfile = [], riasecProfile = []) {
  const reasons = []
  const courseCode = typeof course?.course_code === 'string' ? course.course_code.trim() : ''

  if (!courseCode) addReason(reasons, 'MISSING_COURSE_CODE')
  else if (!isCurrentIndependentCourse(courseCode)) addReason(reasons, 'INELIGIBLE_COURSE_IDENTITY')
  if (!PARENT_CLUSTERS.includes(course?.cluster_category)) addReason(reasons, 'INVALID_CLUSTER')

  if (!Array.isArray(skillProfile) || skillProfile.length === 0) {
    addReason(reasons, 'MISSING_SKILL_PROFILE')
  } else {
    const domains = new Set()
    for (const entry of skillProfile) {
      const weight = Number(entry.weight)
      if (!SKILL_DOMAINS.includes(entry.skill_domain)
        || domains.has(entry.skill_domain)
        || !Number.isInteger(weight)
        || weight < 1
        || weight > 3) {
        addReason(reasons, 'INVALID_SKILL_PROFILE')
      }
      domains.add(entry.skill_domain)
    }
  }

  if (!Array.isArray(riasecProfile) || riasecProfile.length !== RIASEC_DIMENSIONS.length) {
    addReason(reasons, 'INCOMPLETE_RIASEC_PROFILE')
  }
  const dimensions = new Set()
  for (const entry of riasecProfile || []) {
    const weight = Number(entry.weight)
    if (!RIASEC_DIMENSIONS.includes(entry.riasec_type)
      || dimensions.has(entry.riasec_type)
      || !Number.isInteger(weight)
      || weight < 0
      || weight > 3) {
      addReason(reasons, 'INVALID_RIASEC_PROFILE')
    }
    dimensions.add(entry.riasec_type)
  }
  if (RIASEC_DIMENSIONS.some((dimension) => !dimensions.has(dimension))) {
    addReason(reasons, 'INCOMPLETE_RIASEC_PROFILE')
  }

  return { ready: reasons.length === 0, reasons }
}

function groupByCourseId(rows) {
  const grouped = new Map()
  for (const row of rows) {
    const courseId = Number(row.course_id)
    grouped.set(courseId, [...(grouped.get(courseId) || []), row])
  }
  return grouped
}

export async function getCourseRecommendationReadiness(database, courseId) {
  const [[courses], [skillRows], [riasecRows]] = await Promise.all([
    database.query('SELECT course_id, course_code, cluster_category FROM COURSE WHERE course_id = ? LIMIT 1', [courseId]),
    database.query('SELECT skill_domain, weight FROM COURSE_SKILL_PROFILE WHERE course_id = ?', [courseId]),
    database.query('SELECT riasec_type, weight FROM COURSE_RIASEC_PROFILE WHERE course_id = ?', [courseId]),
  ])
  if (courses.length === 0) return null
  return evaluateRecommendationReadiness(courses[0], skillRows, riasecRows)
}

export async function getAdminCourses(database) {
  const [[courses], [skillRows], [riasecRows]] = await Promise.all([
    database.query(
      `SELECT course_id, course_code, course_name, course_abbreviation, program_type, cluster_category, psced_group, is_active
       FROM COURSE
       ORDER BY course_name ASC`
    ),
    database.query('SELECT course_id, skill_domain, weight FROM COURSE_SKILL_PROFILE'),
    database.query('SELECT course_id, riasec_type, weight FROM COURSE_RIASEC_PROFILE'),
  ])
  const skillsByCourse = groupByCourseId(skillRows)
  const riasecByCourse = groupByCourseId(riasecRows)

  return courses.map((course) => ({
    ...course,
    recommendation_readiness: evaluateRecommendationReadiness(
      course,
      skillsByCourse.get(Number(course.course_id)) || [],
      riasecByCourse.get(Number(course.course_id)) || []
    ),
  }))
}

export async function setCourseActiveStatus(database, courseId, isActive) {
  if (typeof isActive !== 'boolean') {
    const error = new TypeError('is_active must be a boolean')
    error.code = 'INVALID_COURSE_STATUS'
    throw error
  }

  const [result] = await database.query(
    'UPDATE COURSE SET is_active = ? WHERE course_id = ?',
    [isActive ? 1 : 0, courseId]
  )

  return result.affectedRows > 0
}
