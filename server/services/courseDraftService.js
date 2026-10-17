import { validateCourse } from './requestValidationService.js'
import { evaluateRecommendationReadiness } from './adminCourseService.js'
import { SKILL_DOMAINS, RIASEC_DIMENSIONS } from '../config/recommendationConfig.js'
import { captureDraftReviewFields, bumpDraftReviewFields } from './draftSourceService.js'
import { validateSourceBundle, persistSourceBundle } from './sourceBundlePersistenceService.js'
import { sourcePublisherConfiguration } from './sourcePublisherPolicy.js'
import { validateCareerOpportunities } from '../shared/courseCareerFields.js'

export const courseDraftOptions = { skill_domains: SKILL_DOMAINS, riasec_dimensions: RIASEC_DIMENSIONS, max_duration_years: 5, career_opportunities_supported: true, get source_url_policy() { return sourcePublisherConfiguration() } }

export class CourseDraftError extends Error {
  constructor(message, status = 400, details = {}) {
    super(message)
    this.status = status
    this.details = details
  }
}

// The old standalone editor remains available for legacy records only. New
// drafts use the atomic draft save; published records cannot bypass read-only.
export async function requireStandaloneCareerEditable(database, { courseId, careerId }) {
  const [rows] = await database.query(`SELECT c.is_draft, p.course_id AS published_course_id FROM COURSE c
    ${careerId ? 'JOIN CAREER_OPPORTUNITY k ON k.course_id = c.course_id' : ''}
    LEFT JOIN COURSE_PUBLICATION p ON p.course_id = c.course_id
    WHERE ${careerId ? 'k.opportunity_id' : 'c.course_id'} = ?`, [careerId || courseId])
  if (!rows.length) throw new CourseDraftError('Course or career opportunity not found.', 404)
  if (rows[0].published_course_id != null) throw new CourseDraftError('Published new courses are read-only.', 409)
  if (Number(rows[0].is_draft) === 1) throw new CourseDraftError('Use Edit Draft and Save Draft Changes to manage this course’s careers.', 409)
}

export const normalizeCourseName = (name) => String(name).normalize('NFKC').trim().replace(/\s+/gu, ' ').toLowerCase()

export function validateDraftInput(body, creating = false) {
  const base = validateCourse(body)
  if (!base.valid) throw new CourseDraftError(base.message)
  const value = { ...base.value }
  if (Object.hasOwn(body, 'career_opportunities')) {
    const careers = validateCareerOpportunities(body.career_opportunities)
    if (careers.error) throw new CourseDraftError(careers.error, 400, { fieldErrors: { career_opportunities: careers.error } })
    value.career_opportunities = careers.value
  }
  for (const [key, max] of [['course_abbreviation', 50]]) {
    if (Object.hasOwn(body, key)) {
      if (typeof body[key] !== 'string' || body[key].trim().length > max) throw new CourseDraftError(`Invalid ${key}.`)
      value[key] = body[key].trim() || null
    }
  }
  const hasDuration = Object.hasOwn(body, 'program_duration_years') || Object.hasOwn(body, 'year_levels')
  if (creating || hasDuration) {
    const duration = body.program_duration_years
    if (!Number.isInteger(duration) || duration < 1 || duration > 5) throw new CourseDraftError('Program duration must be a whole number from 1 to 5 years.')
    if (!Array.isArray(body.year_levels) || body.year_levels.length !== duration) throw new CourseDraftError('Provide one year level for each program year.')
    value.program_duration_years = duration
    value.year_levels = body.year_levels.map((entry, index) => {
      if (!entry || entry.year !== index + 1 || typeof entry.label !== 'string' || !entry.label.trim() || entry.label.trim().length > 30
        || typeof entry.overview !== 'string' || entry.overview.length > 5000) throw new CourseDraftError('Invalid year level. Use consecutive years with labels and text overviews.')
      return { year: entry.year, label: entry.label.trim(), overview: entry.overview.trim() }
    })
  }
  const hasProfiles = Object.hasOwn(body, 'skill_profile') || Object.hasOwn(body, 'riasec_profile')
  if (creating || hasProfiles) {
    for (const key of ['skill_profile', 'riasec_profile']) {
      if (!Array.isArray(body[key]) || body[key].length > 6) throw new CourseDraftError('Provide both skill and RIASEC profiles.')
      value[key] = body[key].map((entry) => {
        if (!entry || typeof entry !== 'object' || !Number.isInteger(entry.weight)
          || (entry.evidence != null && (typeof entry.evidence !== 'string' || entry.evidence.length > 5000))) throw new CourseDraftError('Profile weights must be explicit integers; evidence must be text up to 5000 characters.')
        return { ...entry, evidence: entry.evidence ?? null, evidence_provided: Object.hasOwn(entry, 'evidence') }
      })
    }
    // Reuse existing profile/cluster rules without requiring an allocated code yet.
    const readiness = evaluateRecommendationReadiness({ course_code: 'NEW_DRAFT', cluster_category: value.cluster_category }, value.skill_profile, value.riasec_profile)
    if (!readiness.ready) throw new CourseDraftError('Correct the matching profiles before saving.', 400, { reasons: readiness.reasons })
  }
  return value
}

export async function allocateCourseCode(connection, nextNumber) {
  let number = Number(nextNumber)
  while (Number.isSafeInteger(number) && number <= 9999999) {
    const code = `CRS${String(number).padStart(3, '0')}`
    const [existing] = await connection.query('SELECT course_id FROM COURSE WHERE course_code = ?', [code])
    number += 1
    if (existing.length === 0) {
      await connection.query('UPDATE COURSE_CODE_ALLOCATOR SET next_number = ? WHERE allocator_id = 1', [number])
      return code
    }
  }
  throw new CourseDraftError('The course code range is exhausted. Contact the system administrator.', 409)
}

export async function saveCourseDraft(database, body, courseId = null, authenticatedAdminId = null) {
  const creating = courseId === null
  const value = validateDraftInput(body, creating)
  const bundle = Object.hasOwn(body, 'sources') ? validateSourceBundle(body.sources, authenticatedAdminId, 3) : null
  const connection = await database.getConnection()
  try {
    await connection.beginTransaction()
    // Serialize code allocation AND duplicate-name checks across create/update requests.
    const [allocator] = await connection.query('SELECT next_number FROM COURSE_CODE_ALLOCATOR WHERE allocator_id = 1 FOR UPDATE')
    if (allocator.length !== 1) throw new Error('Course code allocator has not been initialized')
    let existing = null
    if (!creating) {
      const [rows] = await connection.query('SELECT * FROM COURSE WHERE course_id = ? FOR UPDATE', [courseId])
      if (rows.length === 0) throw new CourseDraftError('Course not found.', 404)
      existing = rows[0]
      const [published] = await connection.query('SELECT course_id FROM COURSE_PUBLICATION WHERE course_id = ?', [courseId])
      if (published.length) throw new CourseDraftError('Published new courses are read-only in the draft editor.', 409)
      if (value.career_opportunities && Number(existing.is_draft) !== 1) throw new CourseDraftError('Career editing in this form is available only for new drafts.', 409)
    }
    const [names] = await connection.query('SELECT course_id, course_code, course_name FROM COURSE')
    const reviewFieldsBefore = Number(existing?.is_draft) === 1 ? await captureDraftReviewFields(connection, existing) : null
    const nameKey = normalizeCourseName(value.course_name)
    // Do not block an unchanged legacy name merely because legacy duplicates exist.
    if (creating || nameKey !== normalizeCourseName(existing.course_name)) {
      const duplicates = names.filter((row) => Number(row.course_id) !== courseId && normalizeCourseName(row.course_name) === nameKey)
      if (duplicates.length) throw new CourseDraftError('A course with this name already exists. Review the existing record or use the full distinct program/specialization name.', 409, { duplicates })
    }
    let courseCode = existing?.course_code
    if (creating) {
      courseCode = await allocateCourseCode(connection, allocator[0].next_number)
      const [result] = await connection.query(
        `INSERT INTO COURSE (course_code, course_name, cluster_category, description, obtainable_skills, program_type, psced_group, course_abbreviation, is_active, is_draft)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 1)`,
        [courseCode, value.course_name, value.cluster_category, value.description, value.obtainable_skills, null, null, value.course_abbreviation ?? null])
      courseId = result.insertId
    } else {
      await connection.query(
        `UPDATE COURSE SET course_name = ?, cluster_category = ?, description = ?, obtainable_skills = ?,
         program_type = ?, psced_group = ?, course_abbreviation = ? WHERE course_id = ?`,
        [value.course_name, value.cluster_category, value.description, value.obtainable_skills,
          Object.hasOwn(body, 'program_type') ? value.program_type : existing.program_type,
          Object.hasOwn(body, 'psced_group') ? value.psced_group : existing.psced_group,
          Object.hasOwn(value, 'course_abbreviation') ? value.course_abbreviation : existing.course_abbreviation, courseId])
    }
    if (Object.hasOwn(value, 'program_duration_years')) {
      await connection.query('UPDATE COURSE SET program_duration_years = ?, year_levels = ? WHERE course_id = ?', [value.program_duration_years, JSON.stringify(value.year_levels), courseId])
    }
    if (value.skill_profile) {
      for (const [table, key, entries] of [
        ['COURSE_SKILL_PROFILE', 'skill_domain', value.skill_profile],
        ['COURSE_RIASEC_PROFILE', 'riasec_type', value.riasec_profile],
      ]) {
        // Retain row IDs for unchanged domains and preserve all unrelated course profiles.
        for (const entry of entries) {
          await connection.query(`INSERT INTO ${table} (course_id, ${key}, weight, evidence) VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE weight = VALUES(weight), evidence = IF(?, VALUES(evidence), evidence)`, [courseId, entry[key], entry.weight, entry.evidence, entry.evidence_provided])
        }
        await connection.query(`DELETE FROM ${table} WHERE course_id = ? AND ${key} NOT IN (${entries.map(() => '?').join(',')})`, [courseId, ...entries.map((entry) => entry[key])])
      }
    }
    if (value.career_opportunities) {
      const [savedCareers] = await connection.query('SELECT opportunity_id FROM CAREER_OPPORTUNITY WHERE course_id = ? FOR UPDATE', [courseId])
      const owned = new Set(savedCareers.map(row => Number(row.opportunity_id)))
      for (const row of value.career_opportunities) {
        if (row.opportunity_id != null) {
          if (!owned.has(row.opportunity_id)) throw new CourseDraftError('A career opportunity changed or does not belong to this course. Reload the saved draft.', 409)
          await connection.query('UPDATE CAREER_OPPORTUNITY SET job_title = ?, salary_range = ?, description = ? WHERE opportunity_id = ? AND course_id = ?', [row.job_title, row.salary_range || null, row.description || null, row.opportunity_id, courseId])
        } else await connection.query('INSERT INTO CAREER_OPPORTUNITY (course_id, job_title, salary_range, description) VALUES (?, ?, ?, ?)', [courseId, row.job_title, row.salary_range || null, row.description || null])
      }
      const retained = new Set(value.career_opportunities.map(row => row.opportunity_id))
      for (const id of owned) if (!retained.has(id)) await connection.query('DELETE FROM CAREER_OPPORTUNITY WHERE opportunity_id = ? AND course_id = ?', [id, courseId])
    }
    if (reviewFieldsBefore) {
      const [savedRows] = await connection.query('SELECT * FROM COURSE WHERE course_id = ? FOR UPDATE', [courseId])
      await bumpDraftReviewFields(connection, courseId, reviewFieldsBefore, await captureDraftReviewFields(connection, savedRows[0]))
    }
    if (bundle?.length) {
      const [savedSources] = await connection.query('SELECT source_id FROM COURSE_DRAFT_SOURCE WHERE course_id = ? AND is_removed = 0', [courseId])
      if (savedSources.length + bundle.length > 3) throw new CourseDraftError('Use at most three source links.', 400)
      const [savedRows] = await connection.query('SELECT * FROM COURSE WHERE course_id = ? FOR UPDATE', [courseId])
      await persistSourceBundle(connection, savedRows[0], bundle, authenticatedAdminId)
    }
    await connection.commit()
    return { courseId, course_code: courseCode, is_draft: creating || Boolean(existing.is_draft) }
  } catch (error) {
    await connection.rollback()
    if (error.code === 'ER_DUP_ENTRY') throw new CourseDraftError('A course code or matching-profile entry already exists. Reload and try again.', 409)
    throw error
  } finally {
    connection.release()
  }
}
