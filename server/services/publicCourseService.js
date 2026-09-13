import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import pool from '../config/db.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataPath = path.join(__dirname, '../data/learnmatch_courses_final_342_with_ids.json')
const { courses } = JSON.parse(fs.readFileSync(dataPath, 'utf8'))

const normalize = (value = '') =>
  String(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

const ignoredTokens = new Set([
  'a', 'an', 'and', 'course', 'degree', 'for', 'in', 'major', 'no', 'of', 'or', 'program',
  'such', 'the', 'to', 'with',
])

const publicCourse = (course, includeDetails = false) => {
  const result = {
    course_code: course.course_id,
    course_name: course.course_name,
    course_abbreviation: course.course_abbreviation || null,
    cluster_category: course.parent_cluster,
    description: course.course_description || null,
  }

  if (includeDetails) {
    result.obtainable_skills = course.obtainable_skills || []
    result.career_paths = course.career_paths || []
    result.sources = course.sources || []
  }

  return result
}

const indexedCourses = courses.map((course) => ({
  course,
  code: normalize(course.course_id),
  abbreviation: normalize(course.course_abbreviation),
  name: normalize(course.course_name),
  cluster: normalize(course.parent_cluster),
  description: normalize(course.course_description),
  skills: normalize((course.obtainable_skills || []).join(' ')),
  careers: normalize((course.career_paths || []).join(' ')),
}))

function fieldScore(field, phrase, tokens, weight) {
  if (!field) return 0
  let score = 0
  if (field === phrase) score += weight * 5
  else if (field.startsWith(phrase)) score += weight * 3
  else if (field.includes(phrase)) score += weight * 2
  score += tokens.filter((token) => field.includes(token)).length * weight
  return score
}

export function searchPublicCourses(query, { limit = 342, courseCodes = null } = {}) {
  const phrase = normalize(query)
  if (!phrase) return []

  const tokens = [...new Set(
    phrase.split(' ').filter((token) => token.length > 1 && !ignoredTokens.has(token))
  )]
  if (tokens.length === 0) return []

  return indexedCourses
    .filter(({ course }) => !courseCodes || courseCodes.has(course.course_id))
    .map((item) => {
      const score =
        fieldScore(item.code, phrase, tokens, 16) +
        fieldScore(item.abbreviation, phrase, tokens, 18) +
        fieldScore(item.name, phrase, tokens, 12) +
        fieldScore(item.cluster, phrase, tokens, 5) +
        fieldScore(item.skills, phrase, tokens, 4) +
        fieldScore(item.careers, phrase, tokens, 4) +
        fieldScore(item.description, phrase, tokens, 2)

      return { item, score }
    })
    .filter(({ score }) => score > 0)
    .sort((left, right) =>
      right.score - left.score ||
      left.item.course.course_name.localeCompare(right.item.course.course_name)
    )
    .slice(0, Math.max(0, Math.min(Number(limit) || 342, 342)))
    .map(({ item }) => publicCourse(item.course))
}

export function getPublicCourse(courseCode) {
  const normalizedCode = normalize(courseCode).replace(/ /g, '')
  const match = indexedCourses.find(({ code }) => code === normalizedCode)
  return match ? publicCourse(match.course, true) : null
}

export function getPublicCourseCount() {
  return indexedCourses.length
}

export async function getActivePublicCourseCodes(database = pool) {
  const [rows] = await database.query(
    'SELECT course_code FROM COURSE WHERE is_active = 1'
  )
  return new Set(rows.map(({ course_code }) => course_code))
}

export async function searchAvailablePublicCourses(query, options = {}, database = pool) {
  const activeCourseCodes = await getActivePublicCourseCodes(database)
  return searchPublicCourses(query, { ...options, courseCodes: activeCourseCodes })
}

export async function getAvailablePublicCourse(courseCode, database = pool) {
  const course = getPublicCourse(courseCode)
  if (!course) return null

  const activeCourseCodes = await getActivePublicCourseCodes(database)
  return activeCourseCodes.has(course.course_code) ? course : null
}
