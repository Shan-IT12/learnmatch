import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'
import { safeFetchSource, FETCH_LIMITS, SourceFetchError } from './safeSourceFetchService.js'
import { parseSourceContent } from './sourceParserService.js'
import { PARSER_LIMITS } from './sourceTextReading.js'
import { detectCourseSupport, DETECTION_VERSION } from './sourceDetectionService.js'
import { DraftSourceError } from './draftSourceService.js'
import { pendingSourceBinding, draftReviewFields, sourceAnalysisBinding, sourceAnalysisFields } from '../../shared/pendingSourceReview.js'
import { applyPublisherPolicy, approvedSourceUrlError, validateAdminCourseSource } from './sourcePublisherPolicy.js'
import { JWT_ISSUER } from '../config/security.js'
import { analyzeSourceContent, sourceAiFacts } from './sourceAiAnalysisService.js'

const audience = 'learnmatch-admin-source-review'
const digest = (value) => crypto.createHash('sha256').update(value).digest('hex')
function sign(kind, data, adminId) {
  const token = jwt.sign({ kind, data, adminId }, process.env.JWT_SECRET, { algorithm: 'HS256', audience, issuer: JWT_ISSUER, expiresIn: '45m' })
  if (token.length > 28000) throw new DraftSourceError('Source contains too much source information. Use a narrower source.', 400)
  return token
}
export function readSourceReceipt(token, kind, adminId) {
  try {
    if (typeof token !== 'string' || token.length > 28000) throw new Error()
    const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'], audience, issuer: JWT_ISSUER })
    if (payload.kind !== kind || payload.adminId !== adminId) throw new Error()
    if (kind === 'check') {
      if (payload.data.version !== DETECTION_VERSION) throw new Error()
      const age = Date.now() - Date.parse(payload.data.checked_at)
      if (!Number.isFinite(age) || age < -60000 || age > 45 * 60000) throw new Error()
    }
    return kind === 'check' ? applyPublisherPolicy(payload.data) : payload.data
  } catch { throw new DraftSourceError('This source result or confirmation is expired, changed, or belongs to another administrator. Check or confirm it again.', 409) }
}
export async function checkUnsavedSource(url, adminId, { courseName, source, course, analyze = analyzeSourceContent, fetch = safeFetchSource, parse = parseSourceContent, signal, now = Date.now, onFailure = failure => console.warn('Source check not completed:', JSON.stringify(failure)) } = {}) {
  if (typeof courseName !== 'string' || !courseName.trim() || courseName.trim().length > 255) throw new DraftSourceError('Enter the course name before checking sources.')
  const urlError = approvedSourceUrlError(url)
  if (!url?.trim() || urlError) throw new DraftSourceError('Correct the source URL.', 400, { fieldErrors: { url: urlError || 'Enter a source URL.' } })
  const validateUrl = value => {
    const error = approvedSourceUrlError(value)
    if (error) throw Object.assign(new Error(error), { code: 'UNAPPROVED_SOURCE_HOST' })
  }
  const target = courseName.trim()
  let report, fetched
  let stage = 'fetch'
  const started = now()
  let stageStarted = started
  const fields = course ? draftReviewFields(course) : null
  const contextHash = fields && source ? digest(sourceAnalysisBinding(source, fields)) : null
  const base = { version: DETECTION_VERSION, original_url: url, target_course_name: target, context_sha256: contextHash, checked_at: new Date().toISOString() }
  try {
    signal?.throwIfAborted()
    fetched = await fetch(url, { signal, validateUrl })
    validateUrl(fetched.final_url)
    signal?.throwIfAborted()
    stage = 'parse'
    stageStarted = now()
    const type = fetched.bytes.subarray(0, 5).equals(Buffer.from('%PDF-')) ? 'application/pdf' : fetched.type
    const parsed = await parse(fetched.bytes, type, { signal, allowScannedPdf: Boolean(course && source), allowPartialPdf: true })
    signal?.throwIfAborted()
    stage = 'analysis'; stageStarted = now()
    const analysis = course && source ? await analyze({ parsed, courseName: target, url: fetched.final_url, source,
      courseFacts: sourceAiFacts(fields, sourceAnalysisFields(source)), pdfBytes: type === 'application/pdf' ? fetched.bytes : undefined, contentHash: digest(fetched.bytes), contextHash, signal })
      : { ...detectCourseSupport(parsed, target, fetched.final_url), method: 'Basic', analysis_notice: 'Basic check used — no draft comparison context supplied.' }
    signal?.throwIfAborted()
    report = { ...base, ...analysis, final_url: fetched.final_url,
      content_sha256: digest(fetched.bytes), fetch_status: 'succeeded', parse_status: 'succeeded',
      analysis_completed: analysis.analysis_completed ?? ['AI', 'Basic'].includes(analysis.method) }
    if (parsed.pdf?.partial) {
      report.pdf_scope = { total_pages: parsed.pdf.total_pages, read_pages: parsed.pdf.pages, partial: true }
      report.coverage = [`Partial PDF review: only pages 1–${parsed.pdf.pages} of ${parsed.pdf.total_pages} were read. Later pages were not checked.`, ...(report.coverage || [])]
    }
  } catch (error) {
    signal?.throwIfAborted()
    const elapsed = Math.max(0, now() - stageStarted)
    const timeout = stage === 'fetch' ? FETCH_LIMITS.timeout : stage === 'parse' ? PARSER_LIMITS.milliseconds : null
    const phases = new Set(['dns', 'download', 'connection', 'response_headers', 'response_body', 'url_validation'])
    const phase = stage === 'fetch' && phases.has(error.fetch_phase) ? error.fetch_phase : null
    const timedOut = error.code === 'TIMEOUT' || error.code === 'PARSER_TIMEOUT'
    const reason = timedOut ? stage === 'fetch'
      ? `${phase === 'dns' ? 'Source DNS lookup' : 'Source download'} timed out after ${(elapsed / 1000).toFixed(1)} seconds. The shared DNS/redirect/download limit is ${FETCH_LIMITS.timeout / 1000} seconds. Parsing and AI analysis were not started.`
      : stage === 'parse' ? `Source parsing timed out after ${(elapsed / 1000).toFixed(1)} seconds (${PARSER_LIMITS.milliseconds / 1000}-second parser limit). AI analysis was not started.`
        : 'Analysis timed out before completing. Review the source manually.'
      : error.code === 'SIZE_LIMIT' ? 'Source exceeds the download limit.'
      : error.code === 'PDF_NO_TEXT' ? 'This PDF has no readable text and may be scanned. Open it and review it manually.'
      : error.code === 'PDF_PAGE_LIMIT' && /^PDF has \d+ pages; the parser limit is \d+\. Review the source manually\.$/.test(error.message) ? error.message
      : error instanceof SourceFetchError ? `${error.code}: ${error.message}`
      : error.code === 'UNAPPROVED_SOURCE_HOST' ? 'UNAPPROVED_SOURCE_HOST: The checked source publisher host is not approved.'
      : 'Source content could not be read within supported limits. Review it manually.'
    report = { ...base, final_url: fetched?.final_url || null, content_sha256: fetched ? digest(fetched.bytes) : null,
      failure_stage: stage, error_code: error.code || null, fetch_status: fetched ? 'succeeded' : 'failed',
      parse_status: stage === 'fetch' ? 'not_attempted' : stage === 'parse' ? 'failed' : 'succeeded',
      status: 'Needs Review', method: 'Analysis not completed', analysis_completed: false,
      analysis_failure: { stage, code: /^[A-Z_]{1,40}$/.test(error.code || '') ? error.code : 'SOURCE_ERROR', message: reason,
        elapsed_ms: elapsed, timeout_ms: timeout, total_elapsed_ms: Math.max(0, now() - started), fetch_phase: phase },
      reasons: [reason], excerpts: [], coverage: ['Analysis not completed. No course relevance determination was made. Open the source for manual review.'] }
    try { onFailure(report.analysis_failure) } catch { /* Logging must not alter source review. */ }
  }
  report = applyPublisherPolicy(report)
  return { report, check_receipt: sign('check', report, adminId) }
}
export function confirmUnsavedSource(input, adminId) {
  const validation = validateAdminCourseSource(input?.source)
  if (Object.keys(validation.errors).length) throw new DraftSourceError('Complete the source fields before confirming.', 400, { fieldErrors: validation.errors })
  if (input.confirmed !== true || !input.course?.course_name?.trim()) throw new DraftSourceError('Enter the course name and explicitly confirm source support first.')
  const binding = pendingSourceBinding(validation.value, input.course)
  let checkDigest = null
  if (input.check_receipt) {
    const report = readSourceReceipt(input.check_receipt, 'check', adminId)
    const redirectError = report.final_url ? approvedSourceUrlError(report.final_url) : null
    if (redirectError || report.error_code === 'UNAPPROVED_SOURCE_HOST') throw new DraftSourceError('A checked redirect destination is not approved. Use an approved reference URL.', 400, { fieldErrors: { url: redirectError || 'The checked redirect destination is not approved.' } })
    if (report.original_url !== validation.value.url) throw new DraftSourceError('The source URL changed. Check it again.', 409)
    if (report.target_course_name !== input.course.course_name.trim()) throw new DraftSourceError('The course name changed. Check sources again.', 409)
    if (report.context_sha256 && report.context_sha256 !== digest(sourceAnalysisBinding(validation.value, draftReviewFields(input.course)))) throw new DraftSourceError('Relevant course or source information changed. Check sources again or discard the old check before manual confirmation.', 409)
    checkDigest = digest(input.check_receipt)
  }
  return { confirmation_binding: binding, confirmation_receipt: sign('confirmation', { binding, checkDigest }, adminId) }
}
export { digest as sourceDigest }
