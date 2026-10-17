import crypto from 'node:crypto'
import { COURSE_SOURCE_FIELDS } from '../../shared/courseSourceFields.js'
import { validateAdminCourseSource, checkedSourceOriginError } from './sourcePublisherPolicy.js'
import { sourceAnalysisBinding } from '../../shared/pendingSourceReview.js'

export class DraftSourceError extends Error {
  constructor(message, status = 400, details = {}) { super(message); this.status = status; this.details = details }
}
export const parseJson = (value) => typeof value === 'string' ? JSON.parse(value) : value
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]))
  return value ?? null
}
export const stableJson = (value) => JSON.stringify(canonical(value))
export async function captureDraftReviewFields(database, course) {
  const [[skills], [riasec]] = await Promise.all([
    database.query('SELECT skill_domain, weight, evidence FROM COURSE_SKILL_PROFILE WHERE course_id = ? ORDER BY skill_domain', [course.course_id]),
    database.query('SELECT riasec_type, weight, evidence FROM COURSE_RIASEC_PROFILE WHERE course_id = ? ORDER BY riasec_type', [course.course_id]),
  ])
  return canonical({
    course_name: { name: course.course_name, abbreviation: course.course_abbreviation },
    description: course.description,
    obtainable_skills: course.obtainable_skills,
    duration: { years: course.program_duration_years, year_levels: parseJson(course.year_levels) },
    matching_profile_evidence: { cluster: course.cluster_category, skills, riasec },
  })
}
export async function bumpDraftReviewFields(database, courseId, before, after) {
  for (const key of Object.keys(COURSE_SOURCE_FIELDS)) {
    if (stableJson(before[key]) !== stableJson(after[key])) await database.query(
      `INSERT INTO COURSE_DRAFT_FIELD_REVISION (course_id, field_key, revision) VALUES (?, ?, 2)
       ON DUPLICATE KEY UPDATE revision = revision + 1`, [courseId, key])
  }
}
export function sourceContext(source, fields, revisions) {
  const keys = [...new Set(['course_name', ...parseJson(source.supported_fields)])].sort()
  const fieldRevisions = Object.fromEntries(keys.map((key) => [key, revisions[key] || 1]))
  const claims = Object.fromEntries(keys.map((key) => [key, fields[key]]))
  const snapshot = { title: source.title, url: source.url, supported_fields: parseJson(source.supported_fields), notes: source.notes, is_removed: Number(source.is_removed) }
  // Preserve old Phase 2A tokens when a source has no check attached.
  if (source.check_digest) snapshot.check_digest = source.check_digest
  const token = crypto.createHash('sha256').update(stableJson({ source_id: source.source_id, course_id: source.course_id, source_revision: source.source_revision, snapshot, fieldRevisions, claims })).digest('hex')
  return { token, fieldRevisions, claims, snapshot }
}
async function lockDraft(connection, courseId) {
  const [rows] = await connection.query('SELECT * FROM COURSE WHERE course_id = ? FOR UPDATE', [courseId])
  if (!rows.length) throw new DraftSourceError('Course not found.', 404)
  if (Number(rows[0].is_draft) !== 1 || Number(rows[0].is_active) !== 0) throw new DraftSourceError('Sources and reviews can only be managed for inactive drafts.', 409)
  return rows[0]
}
async function transact(database, courseId, action) {
  const connection = await database.getConnection()
  try {
    await connection.beginTransaction()
    const course = await lockDraft(connection, courseId)
    const result = await action(connection, course)
    await connection.commit()
    return result
  } catch (error) { await connection.rollback(); throw error } finally { connection.release() }
}
async function sourceRows(connection, courseId) {
  const [rows] = await connection.query('SELECT * FROM COURSE_DRAFT_SOURCE WHERE course_id = ? ORDER BY source_id', [courseId])
  return rows
}
export async function revisionMap(connection, courseId) {
  const [rows] = await connection.query('SELECT field_key, revision FROM COURSE_DRAFT_FIELD_REVISION WHERE course_id = ?', [courseId])
  return Object.fromEntries(rows.map((row) => [row.field_key, row.revision]))
}
// Read-only snapshot for reopened-draft analysis. Never save/lock a course just to check it.
export async function draftSourceCheckSnapshot(database, courseId) {
  const [courses] = await database.query('SELECT course_id, is_draft, is_active FROM COURSE WHERE course_id = ?', [courseId])
  if (!courses.length) throw new DraftSourceError('Course not found.', 404)
  const [published] = await database.query('SELECT course_id FROM COURSE_PUBLICATION WHERE course_id = ?', [courseId])
  if (Number(courses[0].is_draft) !== 1 || Number(courses[0].is_active) !== 0 || published.length) throw new DraftSourceError('Source checking is only available for unpublished new-workflow drafts.', 409)
  const [sources] = await database.query('SELECT source_id, source_revision, is_removed FROM COURSE_DRAFT_SOURCE WHERE course_id = ? ORDER BY source_id', [courseId])
  return stableJson({ course: courses[0], sources, revisions: await revisionMap(database, courseId) })
}
export async function listDraftSources(database, courseId) {
  return transact(database, courseId, async (connection, course) => {
    const sources = await sourceRows(connection, courseId)
    const fields = await captureDraftReviewFields(connection, course)
    const revisions = await revisionMap(connection, courseId)
    const [history] = await connection.query(
      `SELECT r.* FROM COURSE_DRAFT_SOURCE_REVIEW r JOIN COURSE_DRAFT_SOURCE s ON s.source_id = r.source_id
       WHERE s.course_id = ? ORDER BY r.review_id DESC`, [courseId])
    const [checks] = await connection.query(
      `SELECT c.* FROM COURSE_DRAFT_SOURCE_CHECK c JOIN COURSE_DRAFT_SOURCE s ON s.source_id = c.source_id
       WHERE s.course_id = ? ORDER BY c.check_id DESC`, [courseId])
    return sources.map((source) => {
      const context = sourceContext(source, fields, revisions)
      const reviews = history.filter((review) => review.source_id === source.source_id).map((review) => ({ ...review,
        source_snapshot: parseJson(review.source_snapshot), claim_snapshot: parseJson(review.claim_snapshot), field_revisions: parseJson(review.field_revisions),
        current: !source.is_removed && review.context_token === context.token,
      }))
      return { ...source, supported_fields: parseJson(source.supported_fields), review_token: context.token, review_information: context.claims, reviews,
        checks: checks.filter((check) => check.source_id === source.source_id).map((check) => {
          const report = parseJson(check.report)
          const contextCurrent = !report.context_sha256 || report.context_sha256 === crypto.createHash('sha256').update(sourceAnalysisBinding({ ...source, supported_fields: parseJson(source.supported_fields) }, fields)).digest('hex')
          const revisionsCurrent = !report.saved_field_revisions || Object.entries(report.saved_field_revisions).every(([key, revision]) => revision === (revisions[key] || 1))
          return { ...check, report, current: !source.is_removed && check.source_revision === source.source_revision && contextCurrent && revisionsCurrent }
        }),
        review_status: source.is_removed ? 'removed' : reviews.some((review) => review.current) ? 'confirmed' : reviews.length ? 'review_again' : 'unconfirmed' }
    })
  })
}
export async function saveDraftSource(database, courseId, input, sourceId = null) {
  const validation = validateAdminCourseSource(input)
  if (Object.keys(validation.errors).length) throw new DraftSourceError('Correct the source fields.', 400, { fieldErrors: validation.errors })
  return transact(database, courseId, async (connection) => {
    const value = validation.value
    if (sourceId === null) {
      const activeSources = (await sourceRows(connection, courseId)).filter((source) => !Number(source.is_removed))
      if (activeSources.length >= 3) throw new DraftSourceError('Use at most three source links.', 400)
      const [result] = await connection.query('INSERT INTO COURSE_DRAFT_SOURCE (course_id, title, url, supported_fields, notes) VALUES (?, ?, ?, ?, ?)', [courseId, value.title, value.url, JSON.stringify(value.supported_fields), value.notes])
      return { source_id: result.insertId }
    }
    const source = (await sourceRows(connection, courseId)).find((row) => row.source_id === sourceId && !row.is_removed)
    if (!source) throw new DraftSourceError('Source not found.', 404)
    if (input.source_revision !== source.source_revision) throw new DraftSourceError('This source changed. Reload before saving.', 409)
    const old = { title: source.title, url: source.url, supported_fields: parseJson(source.supported_fields), notes: source.notes }
    if (stableJson(old) !== stableJson(value)) await connection.query(
      `UPDATE COURSE_DRAFT_SOURCE SET title = ?, url = ?, supported_fields = ?, notes = ?, source_revision = source_revision + 1${source.url !== value.url ? ', check_digest = NULL' : ''}
       WHERE course_id = ? AND source_id = ?`, [value.title, value.url, JSON.stringify(value.supported_fields), value.notes, courseId, sourceId])
    return { source_id: sourceId }
  })
}
export async function removeDraftSource(database, courseId, sourceId, revision) {
  return transact(database, courseId, async (connection) => {
    const source = (await sourceRows(connection, courseId)).find((row) => row.source_id === sourceId && !row.is_removed)
    if (!source) throw new DraftSourceError('Source not found.', 404)
    if (revision !== source.source_revision) throw new DraftSourceError('This source changed. Reload before removing it.', 409)
    await connection.query('UPDATE COURSE_DRAFT_SOURCE SET is_removed = 1, source_revision = source_revision + 1 WHERE course_id = ? AND source_id = ?', [courseId, sourceId])
  })
}
export async function reviewDraftSource(database, courseId, sourceId, input, authenticatedAdminId) {
  if (!Number.isInteger(authenticatedAdminId) || authenticatedAdminId < 1) throw new DraftSourceError('Administrator authentication required.', 401)
  if (input?.confirmed !== true || typeof input.expected_token !== 'string' || !/^[a-f0-9]{64}$/.test(input.expected_token)) throw new DraftSourceError('Explicit confirmation and the saved review revision are required.')
  return transact(database, courseId, async (connection, course) => {
    const source = (await sourceRows(connection, courseId)).find((row) => row.source_id === sourceId && !row.is_removed)
    if (!source) throw new DraftSourceError('Source not found.', 404)
    const validation = validateAdminCourseSource(source)
    if (validation.errors.url) throw new DraftSourceError('Correct the source URL before confirming.', 400, { fieldErrors: { url: validation.errors.url } })
    if (source.check_digest) {
      const [checks] = await connection.query('SELECT report FROM COURSE_DRAFT_SOURCE_CHECK WHERE source_id = ? AND source_revision = ? ORDER BY check_id DESC LIMIT 1', [sourceId, source.source_revision])
      const error = checkedSourceOriginError(checks[0] ? parseJson(checks[0].report) : null)
      if (error) throw new DraftSourceError('Correct the checked source URL before confirming.', 400, { fieldErrors: { url: error } })
    }
    const context = sourceContext(source, await captureDraftReviewFields(connection, course), await revisionMap(connection, courseId))
    if (input.expected_token !== context.token) throw new DraftSourceError('The source or supported course information changed. Reload and review again.', 409)
    return appendSourceReview(connection, source, context, authenticatedAdminId)
  })
}
export async function appendSourceReview(connection, source, context, authenticatedAdminId) {
  const [admins] = await connection.query('SELECT admin_id, username FROM ADMIN WHERE admin_id = ?', [authenticatedAdminId])
  if (!admins.length) throw new DraftSourceError('Administrator authentication required.', 403)
  // Attribution and date are exclusively server-controlled. No client identity/date is read.
  const [result] = await connection.query(
    `INSERT INTO COURSE_DRAFT_SOURCE_REVIEW (source_id, source_revision, context_token, field_revisions, source_snapshot, claim_snapshot, reviewer_id, reviewer_label)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [source.source_id, source.source_revision, context.token, JSON.stringify(context.fieldRevisions), JSON.stringify(context.snapshot), JSON.stringify(context.claims), authenticatedAdminId, admins[0].username])
  return { review_id: result.insertId }
}
