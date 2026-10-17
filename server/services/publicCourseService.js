import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import pool from '../config/db.js'
import {
  COURSE_IDENTITY_METADATA,
  isCurrentIndependentCourse,
  resolveCanonicalCourseIds,
} from './courseIdentityService.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataPath = path.join(__dirname, '../data/learnmatch_courses_final_342_with_ids.json')
const enrichmentDataPath = path.join(__dirname, '../data/learnmatch_342_year_levels_and_careers_final.json')
const { courses } = JSON.parse(fs.readFileSync(dataPath, 'utf8'))
const { courses: enrichedCourses } = JSON.parse(fs.readFileSync(enrichmentDataPath, 'utf8'))
const enrichmentByCourseId = new Map(enrichedCourses.map((course) => [course.course_id, course]))

if (enrichmentByCourseId.size !== courses.length) {
  throw new Error('Course enrichment dataset must contain the same unique course IDs as the canonical catalog')
}

for (const course of courses) {
  if (!enrichmentByCourseId.has(course.course_id)) {
    throw new Error(`Course enrichment is missing canonical course ${course.course_id}`)
  }
}

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
    const enrichment = enrichmentByCourseId.get(course.course_id) || course
    result.obtainable_skills = course.obtainable_skills || []
    result.career_paths = course.career_paths || []
    result.program_duration_years = enrichment.program_duration_years
    result.year_levels = enrichment.year_levels || []
    result.career_opportunities = enrichment.career_opportunities || []
  }

  return result
}

const indexCourse = (course) => ({
  course,
  code: normalize(course.course_id),
  abbreviation: normalize(course.course_abbreviation),
  name: normalize(course.course_name),
  cluster: normalize(course.parent_cluster),
  description: normalize(course.course_description),
  skills: normalize((course.obtainable_skills || []).join(' ')),
  careers: normalize((course.career_paths || []).join(' ')),
})
const indexedCourses = courses.map(indexCourse)
const currentIndexedCourses = indexedCourses.filter(({ course }) => (
  isCurrentIndependentCourse(course.course_id)
))

if (currentIndexedCourses.length !== COURSE_IDENTITY_METADATA.active_independent_programs) {
  throw new Error('Active independent course count does not match the course identity registry')
}

function fieldScore(field, phrase, tokens, weight) {
  if (!field) return 0
  let score = 0
  if (field === phrase) score += weight * 5
  else if (field.startsWith(phrase)) score += weight * 3
  else if (field.includes(phrase)) score += weight * 2
  score += tokens.filter((token) => field.includes(token)).length * weight
  return score
}

export function searchPublicCourses(query, { limit, courseCodes = null, additionalCourses = [] } = {}) {
  const extra = additionalCourses.filter((course) => !enrichmentByCourseId.has(course.course_id)).map(indexCourse)
  const available = [...currentIndexedCourses, ...extra].filter(({ course }) => isCurrentIndependentCourse(course.course_id))
  const phrase = normalize(query)
  const normalizedLimit = Math.max(0, Math.min(
    Number(limit) || available.length,
    available.length
  ))
  if (!phrase) {
    return available
      .filter(({ course }) => !courseCodes || courseCodes.has(course.course_id))
      .sort((left, right) => left.course.course_name.localeCompare(right.course.course_name))
      .slice(0, normalizedLimit)
      .map(({ course }) => publicCourse(course))
  }

  const hasKnownExactAbbreviation = [...indexedCourses, ...extra].some(({ abbreviation }) => abbreviation === phrase)
  if (hasKnownExactAbbreviation) {
    return available
      .filter(({ course, abbreviation }) => (
        abbreviation === phrase && (!courseCodes || courseCodes.has(course.course_id))
      ))
      .sort((left, right) => left.course.course_name.localeCompare(right.course.course_name))
      .slice(0, normalizedLimit)
      .map(({ course }) => publicCourse(course))
  }

  const tokens = [...new Set(
    phrase.split(' ').filter((token) => token.length > 1 && !ignoredTokens.has(token))
  )]
  if (tokens.length === 0) return []

  return available
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
    .slice(0, normalizedLimit)
    .map(({ item }) => publicCourse(item.course))
}

export function getPublicCourse(courseCode) {
  const normalizedCode = normalize(courseCode).replace(/ /g, '')
  const match = indexedCourses.find(({ code }) => code === normalizedCode)
  return match ? publicCourse(match.course, true) : null
}

export function getPublicCourseCount() {
  return currentIndexedCourses.length
}

export async function getActivePublicCourseCodes(database = pool) {
  const [rows] = await database.query(
    'SELECT course_code FROM COURSE WHERE is_active = 1 AND is_draft = 0'
  )
  return new Set(rows.map(({ course_code }) => course_code))
}

export async function searchAvailablePublicCourses(query, options = {}, database = pool) {
  const [activeCourseCodes, published] = await Promise.all([getActivePublicCourseCodes(database), publishedCourses(database)])
  return searchPublicCourses(query, { ...options, additionalCourses: published, courseCodes: activeCourseCodes })
}

// Only explicitly published new records supplement the unchanged bundled catalog.
export function publishedCatalogRecord(row) {
  return {
    course_id: row.course_code, course_name: row.course_name,
    course_abbreviation: row.course_abbreviation, parent_cluster: row.cluster_category,
    course_description: row.description,
    obtainable_skills: String(row.obtainable_skills || '').split(',').map((skill) => skill.trim()).filter(Boolean),
    program_duration_years: row.program_duration_years,
    year_levels: typeof row.year_levels === 'string' ? JSON.parse(row.year_levels) : row.year_levels,
    career_paths: (row.careers || []).map(career => career.job_title),
    career_opportunities: (row.careers || []).map(career => ({ career_id: career.opportunity_id, career_title: career.job_title,
      philippines_description: career.description || '', estimated_monthly_salary_php: career.salary_range ? { display: career.salary_range } : null })),
  }
}
async function publishedCourses(database, courseCode = null) {
  const [rows] = await database.query(
    `SELECT c.* FROM COURSE c JOIN COURSE_PUBLICATION p ON p.course_id = c.course_id
     WHERE c.is_active = 1 AND c.is_draft = 0${courseCode ? ' AND c.course_code = ?' : ''}`,
    courseCode ? [courseCode] : [])
  const eligible = rows.filter((row) => !enrichmentByCourseId.has(row.course_code) && isCurrentIndependentCourse(row.course_code))
  if (!eligible.length) return []
  const [careers] = await database.query(`SELECT * FROM CAREER_OPPORTUNITY WHERE course_id IN (${eligible.map(() => '?').join(',')}) ORDER BY opportunity_id ASC`, eligible.map(row => row.course_id))
  return eligible.map(row => publishedCatalogRecord({ ...row, careers: careers.filter(career => Number(career.course_id) === Number(row.course_id)) }))
}

export async function getAvailablePublicCourse(courseCode, database = pool) {
  const resolvedCourseCodes = resolveCanonicalCourseIds(courseCode)
  if (resolvedCourseCodes.length !== 1) return null

  const course = getPublicCourse(resolvedCourseCodes[0])
  if (!course) {
    const published = await publishedCourses(database, resolvedCourseCodes[0])
    return published.length === 1 ? publicCourse(published[0], true) : null
  }

  const activeCourseCodes = await getActivePublicCourseCodes(database)
  return activeCourseCodes.has(course.course_code) ? course : null
}
