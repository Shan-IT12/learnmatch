import { validateAdminCourseSource, checkedSourceOriginError } from './sourcePublisherPolicy.js'
import { sourceClaimsBinding, sourceAnalysisBinding, sourceAnalysisFields } from '../../shared/pendingSourceReview.js'
import { DraftSourceError, captureDraftReviewFields, revisionMap, sourceContext, appendSourceReview, stableJson } from './draftSourceService.js'
import { readSourceReceipt, sourceDigest } from './sourceCheckService.js'

export function validateSourceBundle(sources, adminId, maxSources = 3) {
  if (!Number.isInteger(adminId) || adminId < 1) throw new DraftSourceError('Administrator authentication required.', 401)
  if (!Array.isArray(sources) || sources.length > maxSources) throw new DraftSourceError(`Save at most ${maxSources} new sources at a time.`)
  return sources.map((input, index) => {
    const validation = validateAdminCourseSource(input)
    if (Object.keys(validation.errors).length) throw new DraftSourceError(`Correct source ${index + 1}.`, 400, { fieldErrors: { [`source_${index}`]: validation.errors } })
    const report = input.check_receipt ? readSourceReceipt(input.check_receipt, 'check', adminId) : null
    if (checkedSourceOriginError(report)) throw new DraftSourceError('Correct the checked source URL.', 400, { fieldErrors: { [`source_${index}`]: { url: checkedSourceOriginError(report) } } })
    if (report && report.original_url !== validation.value.url) throw new DraftSourceError('A source URL changed after checking. Check it again.', 409)
    const confirmation = input.confirmation_receipt ? readSourceReceipt(input.confirmation_receipt, 'confirmation', adminId) : null
    if (confirmation) {
      let confirmedUrl
      try { confirmedUrl = JSON.parse(confirmation.binding).source.url } catch { throw new DraftSourceError('This source confirmation is invalid. Confirm it again.', 409) }
      if (confirmedUrl !== validation.value.url) throw new DraftSourceError('A source URL changed after confirmation. Confirm it again.', 409)
    }
    const checkDigest = input.check_receipt ? sourceDigest(input.check_receipt) : null
    if (confirmation && confirmation.checkDigest !== checkDigest) throw new DraftSourceError('A source result changed after confirmation. Confirm it again.', 409)
    return { source: validation.value, report, confirmation }
  })
}
export async function persistSourceBundle(connection, course, bundle, adminId) {
  if (Number(course.is_draft) !== 1 || Number(course.is_active) !== 0) throw new DraftSourceError('Sources can only be attached to inactive drafts.', 409)
  const fields = await captureDraftReviewFields(connection, course)
  const revisions = await revisionMap(connection, course.course_id)
  for (const item of bundle) {
    if (item.report && item.report.target_course_name !== course.course_name.trim()) throw new DraftSourceError('The course name changed after checking. Check sources again.', 409)
    if (item.report?.context_sha256 && item.report.context_sha256 !== sourceDigest(sourceAnalysisBinding(item.source, fields))) throw new DraftSourceError('Relevant draft information changed after checking. Check sources again or discard the old check.', 409)
    const report = item.report?.context_sha256 ? { ...item.report, saved_field_revisions: Object.fromEntries(sourceAnalysisFields(item.source).map(key => [key, revisions[key] || 1])) } : item.report
    const reportDigest = report ? sourceDigest(stableJson(report)) : null
    if (item.confirmation && item.confirmation.binding !== sourceClaimsBinding(item.source, fields)) throw new DraftSourceError('Supported course information changed after source confirmation. Confirm it again.', 409)
    const [insert] = await connection.query(
      'INSERT INTO COURSE_DRAFT_SOURCE (course_id, title, url, supported_fields, notes, check_digest) VALUES (?, ?, ?, ?, ?, ?)',
      [course.course_id, item.source.title, item.source.url, JSON.stringify(item.source.supported_fields), item.source.notes, reportDigest])
    const source = { ...item.source, source_id: insert.insertId, course_id: course.course_id, source_revision: 1, is_removed: 0, check_digest: reportDigest }
    if (report) await connection.query(
      'INSERT INTO COURSE_DRAFT_SOURCE_CHECK (source_id, source_revision, report, checked_by, checked_at) VALUES (?, 1, ?, ?, ?)',
      [source.source_id, JSON.stringify(report), adminId, new Date(report.checked_at)])
    if (item.confirmation) await appendSourceReview(connection, source, sourceContext(source, fields, revisions), adminId)
  }
}
