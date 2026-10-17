import crypto from 'node:crypto'
import { validateCourse } from './requestValidationService.js'
import { evaluateRecommendationReadiness } from './adminCourseService.js'
import { validateDraftInput } from './courseDraftService.js'
import { COURSE_SOURCE_FIELDS } from '../../shared/courseSourceFields.js'
import { validateAdminCourseSource } from './sourcePublisherPolicy.js'
import { captureDraftReviewFields, revisionMap, sourceContext, stableJson, parseJson } from './draftSourceService.js'

export class CoursePublicationError extends Error {
  constructor(message, status = 400, fieldErrors = {}) { super(message); this.status = status; this.fieldErrors = fieldErrors }
}
const digest = (value) => crypto.createHash('sha256').update(stableJson(value)).digest('hex')

export function publicationFieldErrors(course, fields, sources) {
  const errors = {}
  for (const [key, max] of [['course_name', 255], ['course_abbreviation', 50], ['description', 5000], ['obtainable_skills', 5000]]) {
    if (typeof course[key] !== 'string' || !course[key].trim()) errors[key] = 'Complete this field before publication.'
    else if (course[key].length > max) errors[key] = `Use at most ${max} characters.`
  }
  const base = validateCourse(course)
  if (!base.valid) errors.course_details = base.message
  if (!String(course.obtainable_skills || '').split(',').some((skill) => skill.trim())) errors.obtainable_skills = 'Enter at least one source-supported skill, separated by commas.'
  if (!/^CRS\d{3,7}$/.test(course.course_code || '')) errors.course_code = 'A valid stable course code is required.'
  const readiness = evaluateRecommendationReadiness(course, fields.matching_profile_evidence.skills, fields.matching_profile_evidence.riasec)
  for (const reason of readiness.reasons) errors[reason.code === 'INVALID_CLUSTER' ? 'cluster_category' : 'matching_profiles'] = reason.message
  const years = Number(course.program_duration_years)
  if (!Number.isInteger(years) || years < 1 || years > 5) errors.program_duration_years = 'Set a supported duration from one to five years.'
  const levels = fields.duration.year_levels
  if (!Array.isArray(levels) || levels.length !== years || levels.some((year, index) => !year || year.year !== index + 1 || typeof year.label !== 'string' || !year.label.trim() || year.label.length > 30 || typeof year.overview !== 'string' || !year.overview.trim() || year.overview.length > 5000)) errors.year_levels = 'Provide consecutive years with labels and a source-supported overview for every program year.'
  if (!errors.program_duration_years && !errors.year_levels && base.valid) {
    try {
      validateDraftInput({ ...course, program_duration_years: years, year_levels: levels, skill_profile: fields.matching_profile_evidence.skills, riasec_profile: fields.matching_profile_evidence.riasec }, true)
    } catch (error) { errors.matching_profiles = error.message }
  }
  for (const [key, rows] of [['skill_profile', fields.matching_profile_evidence.skills], ['riasec_profile', fields.matching_profile_evidence.riasec]]) {
    if (rows.some((row) => typeof row.evidence !== 'string' || !row.evidence.trim())) errors[key] = 'Document the basis/reference for every assigned weight, including RIASEC zero weights.'
  }
  if (sources.length < 1 || sources.length > 3) errors.sources = 'Provide one to three current manually confirmed sources.'
  const covered = new Set()
  for (const source of sources) {
    const validation = validateAdminCourseSource(source)
    if (Object.keys(validation.errors).length) errors[`source_${source.source_id}`] = validation.errors.url || 'Correct the source title, URL and supported information.'
    if (!source.current_review) errors[`source_${source.source_id}`] ||= 'Open and manually confirm this source for the current saved information.'
    else for (const field of source.supported_fields) covered.add(field)
  }
  for (const field of Object.keys(COURSE_SOURCE_FIELDS)) if (!covered.has(field)) errors[`source_${field}`] = `A current manual source confirmation must support ${COURSE_SOURCE_FIELDS[field].toLowerCase()}.`
  return errors
}

async function context(connection, course) {
  const fields = await captureDraftReviewFields(connection, course)
  const revisions = await revisionMap(connection, course.course_id)
  const [sourceRows] = await connection.query('SELECT * FROM COURSE_DRAFT_SOURCE WHERE course_id = ? ORDER BY source_id', [course.course_id])
  const [reviews] = await connection.query('SELECT r.* FROM COURSE_DRAFT_SOURCE_REVIEW r JOIN COURSE_DRAFT_SOURCE s ON s.source_id = r.source_id WHERE s.course_id = ? ORDER BY r.review_id DESC', [course.course_id])
  const sources = sourceRows.filter((source) => !Number(source.is_removed)).map((source) => {
    const saved = { ...source, supported_fields: parseJson(source.supported_fields) }
    const token = sourceContext(saved, fields, revisions).token
    return { ...saved, current_review: reviews.find((review) => Number(review.source_id) === Number(source.source_id) && review.context_token === token) || null }
  })
  const profileSnapshot = { fields, revisions, course_code: course.course_code }
  const profileToken = digest(profileSnapshot)
  const [history] = await connection.query('SELECT * FROM COURSE_MATCHING_REVIEW WHERE course_id = ? ORDER BY matching_review_id DESC', [course.course_id])
  const matchingReview = history.find((review) => review.context_token === profileToken) || null
  const [careers] = await connection.query('SELECT * FROM CAREER_OPPORTUNITY WHERE course_id = ? ORDER BY opportunity_id ASC', [course.course_id])
  const snapshot = { ...profileSnapshot, sources, careers, matching_review_id: matchingReview?.matching_review_id || null }
  return { fields, sources, profileSnapshot, profileToken, matchingReview, history, snapshot, token: digest(snapshot) }
}
async function transaction(database, courseId, action) {
  const connection = await database.getConnection()
  try {
    await connection.beginTransaction()
    // Draft edits and source mutations lock this same row before changing review state.
    const [courses] = await connection.query('SELECT * FROM COURSE WHERE course_id = ? FOR UPDATE', [courseId])
    if (!courses.length) throw new CoursePublicationError('Course not found.', 404)
    const [published] = await connection.query('SELECT * FROM COURSE_PUBLICATION WHERE course_id = ?', [courseId])
    const result = await action(connection, courses[0], published[0] || null)
    await connection.commit()
    return result
  } catch (error) { await connection.rollback(); throw error } finally { connection.release() }
}
function requireDraft(course, published) {
  if (published) throw new CoursePublicationError('This course is already published and read-only.', 409)
  if (Number(course.is_draft) !== 1 || Number(course.is_active) !== 0) throw new CoursePublicationError('Only inactive new drafts can be published.', 409)
}
async function admin(connection, adminId) {
  if (!Number.isInteger(adminId) || adminId < 1) throw new CoursePublicationError('Administrator access required.', 403)
  const [rows] = await connection.query('SELECT admin_id, username FROM ADMIN WHERE admin_id = ?', [adminId])
  if (!rows.length) throw new CoursePublicationError('Administrator access required.', 403)
  return rows[0]
}
function requireRevision(input, current) {
  if (typeof input?.expected_token !== 'string' || input.expected_token !== current.token) throw new CoursePublicationError('Saved course information or reviews changed. Reload Review & Publish.', 409)
}
export async function getPublicationReview(database, courseId) {
  return transaction(database, courseId, async (connection, course, published) => {
    if (published) return { published, read_only: true }
    requireDraft(course, published)
    const current = await context(connection, course)
    const fieldErrors = publicationFieldErrors(course, current.fields, current.sources)
    if (!current.matchingReview) fieldErrors.matching_review = 'Separately review and confirm the matching profile for this saved revision.'
    return { course, careers: current.snapshot.careers, review_token: current.token, fields: current.fields, sources: current.sources, matching_review: current.matchingReview, matching_history: current.history, fieldErrors, ready: !Object.keys(fieldErrors).length }
  })
}
export async function confirmMatchingReview(database, courseId, input, adminId) {
  return transaction(database, courseId, async (connection, course, published) => {
    const reviewer = await admin(connection, adminId)
    requireDraft(course, published)
    const current = await context(connection, course)
    requireRevision(input, current)
    if (input.confirmed !== true) throw new CoursePublicationError('Explicit matching-profile review confirmation is required.')
    // Validate the saved profile using the same rules as draft saves/WSM; never generate weights.
    const profileErrors = publicationFieldErrors(course, current.fields, current.sources)
    const relevantErrors = Object.fromEntries(Object.entries(profileErrors).filter(([key]) => ['matching_profiles', 'skill_profile', 'riasec_profile', 'cluster_category'].includes(key)))
    if (Object.keys(relevantErrors).length) throw new CoursePublicationError('Correct the saved matching profile.', 422, relevantErrors)
    if (current.matchingReview) throw new CoursePublicationError('This matching revision is already confirmed.', 409)
    const [result] = await connection.query('INSERT INTO COURSE_MATCHING_REVIEW (course_id, context_token, review_snapshot, reviewer_id, reviewer_label) VALUES (?, ?, ?, ?, ?)', [courseId, current.profileToken, JSON.stringify(current.profileSnapshot), adminId, reviewer.username])
    return { matching_review_id: result.insertId }
  })
}
export async function publishCourse(database, courseId, input, adminId) {
  return transaction(database, courseId, async (connection, course, published) => {
    const publisher = await admin(connection, adminId)
    requireDraft(course, published)
    const current = await context(connection, course)
    requireRevision(input, current)
    const errors = publicationFieldErrors(course, current.fields, current.sources)
    if (!current.matchingReview) errors.matching_review = 'A separate current matching-profile confirmation is required.'
    if (input.publish_confirmed !== true) errors.publish_confirmation = 'Explicitly confirm publication.'
    if (Object.keys(errors).length) throw new CoursePublicationError('Publication is blocked. Correct the listed fields and review again.', 422, errors)
    await connection.query('INSERT INTO COURSE_PUBLICATION (course_id, matching_review_id, context_token, publication_snapshot, published_by, publisher_label) VALUES (?, ?, ?, ?, ?, ?)', [courseId, current.matchingReview.matching_review_id, current.token, JSON.stringify(current.snapshot), adminId, publisher.username])
    const [updated] = await connection.query('UPDATE COURSE SET is_draft = 0, is_active = 1 WHERE course_id = ? AND is_draft = 1 AND is_active = 0', [courseId])
    if (updated.affectedRows !== 1) throw new CoursePublicationError('The draft state changed. Reload publication review.', 409)
    return { course_id: courseId, course_code: course.course_code, published: true }
  })
}
