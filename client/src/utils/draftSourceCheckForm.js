import { pendingSourceBinding, pendingSourceAnalysisBinding } from '../../../shared/pendingSourceReview.js'
export const MAX_DRAFT_SOURCES = 3
export const createDraftSource = () => ({ client_id: crypto.randomUUID(), title: '', url: '', notes: '', supported_fields: [] })
export const enteredDraftSources = sources => sources.filter(source => ['title', 'url', 'notes'].some(key => source[key]?.trim()) || source.supported_fields.length || source.check_receipt || source.confirmation_receipt)

export function updatePendingSource(source, patch) {
  const next = { ...source, ...patch }
  // Keep the last analysis as read-only context when choosing what to confirm.
  // Its old receipt must still be invalidated by the normal binding checks.
  if (Object.hasOwn(patch, 'supported_fields') && source.report && source.check_binding) next.previous_analysis = {
    report: source.report, binding: source.check_binding, supported_fields: [...source.supported_fields],
  }
  if (Object.hasOwn(patch, 'url') && patch.url !== source.url) Object.assign(next, {
    report: null, check_receipt: null, check_binding: null, confirmation_receipt: null, confirmation_binding: null,
    previous_analysis: null,
    confirmation_invalidated: Boolean(source.report || source.check_receipt || source.confirmation_receipt || source.confirmation_binding || source.confirmation_invalidated),
  })
  return next
}

export function invalidatePendingReviews(sources, form) {
  return sources.map(source => {
    const staleCheck = source.report && (source.report.target_course_name !== form.course_name.trim() || source.report.original_url !== source.url.trim() || source.check_binding && source.check_binding !== pendingSourceAnalysisBinding(source, form))
    let next = staleCheck ? { ...source, report: null, check_receipt: null, check_binding: null, confirmation_receipt: null, confirmation_binding: null, confirmation_invalidated: true } : source
    if (next.previous_analysis && next.previous_analysis.binding !== pendingSourceAnalysisBinding({ ...next, supported_fields: next.previous_analysis.supported_fields }, form)) next = { ...next, previous_analysis: null }
    if (next.confirmation_receipt && next.confirmation_binding !== pendingSourceBinding(next, form)) next = { ...next, confirmation_receipt: null, confirmation_binding: null, confirmation_invalidated: true }
    return next
  })
}
export function applyCurrentSourceResults(current, form, snapshots, results) {
  return current.map(source => {
    const index = snapshots.findIndex(item => item.id === source.client_id)
    if (index < 0 || snapshots[index].binding !== pendingSourceAnalysisBinding(source, form)) return source
    return { ...source, ...results[index], check_binding: snapshots[index].binding, previous_analysis: null, confirmation_receipt: null, confirmation_binding: null }
  })
}
export const visibleSourceReport = source => source.report || source.previous_analysis?.report
export function sourceReportHeading(report) {
  if (report.error_code === 'SIZE_LIMIT' || report.reasons?.some(reason => reason.startsWith('SIZE_LIMIT:'))) return 'Needs Review \u2014 Source exceeds the download limit.'
  if (report.analysis_completed === false || report.fetch_status === 'failed' || report.parse_status === 'failed') return 'Needs Review — Analysis not completed'
  if (report.parse_status === 'succeeded' && report.publisher_origin?.verified === false) return 'Needs Review \u2014 Source origin not verified'
  if (report.relationship?.kind === 'Unrelated program') return 'Needs Review — Course mismatch'
  if (report.relationship?.kind === 'Insufficient evidence' && report.parse_status !== 'not_attempted' && report.fetch_status !== 'failed') return 'Needs Review — Target course not established'
  return report.status
}
