import { sourceReportHeading } from '../../utils/draftSourceCheckForm'
import SourceAnalysisDetails from './SourceAnalysisDetails'
import SourceEvidenceExcerpts from './SourceEvidenceExcerpts'
import ReopenedDraftSourceCheck from './ReopenedDraftSourceCheck'
import { pendingSourceAnalysisBinding } from '../../../../shared/pendingSourceReview'
import { useEffect, useState } from 'react'
import { COURSE_SOURCE_FIELDS, validateCourseSource } from '../../../../shared/courseSourceFields'
import { sourceUrlError, validateApprovedCourseSource } from '../../../../shared/sourceUrlPolicy'
import { FieldError, RequiredMark } from '../FormValidation'
import { savedSourceCoverage, sourceSupportLabels, sourceConfirmationPayload } from '../../utils/sourceReviewForm'
import DraftDisclosure from './DraftDisclosure'
import SourceCheckReport from './SourceCheckReport'

const blankSource = { title: '', url: '', supported_fields: [], notes: '' }
const inputClass = 'mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm'
const labels = { confirmed: 'Admin confirmed', unconfirmed: 'Not confirmed', review_again: 'Review required after changes', removed: 'Removed' }

function ReviewInformation({ information, supportedFields = [] }) {
  return <div className="mt-2 space-y-2 text-sm">
    <p><strong>Course being reviewed:</strong> {information.course_name.name}{information.course_name.abbreviation ? ` (${information.course_name.abbreviation})` : ''}</p>
    {!supportedFields.includes('course_name') && <p className="text-xs text-amber-800">The course name identifies this draft. This reference is not selected as evidence for Course name.</p>}
    {['description', 'obtainable_skills'].filter((key) => Object.hasOwn(information, key)).map((key) => <p key={key} className="whitespace-pre-wrap"><strong>{COURSE_SOURCE_FIELDS[key]}:</strong> {information[key] || 'Not supplied'}</p>)}
    {information.duration && <div><p><strong>Duration:</strong> {information.duration.years || 'Not supplied'} years</p>{information.duration.year_levels?.map((year) => <p key={year.year}>{year.label}: {year.overview || 'No overview supplied'}</p>)}</div>}
    {information.matching_profile_evidence && <div><p><strong>Matching-profile evidence:</strong> {information.matching_profile_evidence.cluster}</p>
      {[...information.matching_profile_evidence.skills, ...information.matching_profile_evidence.riasec].map((row) => <p key={row.skill_domain || row.riasec_type}>{row.skill_domain || row.riasec_type} (weight {row.weight}): {row.evidence || 'No evidence supplied'}</p>)}
    </div>}
  </div>
}

function SourceHistory({ reviews }) {
  if (!reviews.length) return null
  return <details className="mt-3 text-sm"><summary className="cursor-pointer font-medium">Review history ({reviews.length})</summary>
    {reviews.map((review) => <article key={review.review_id} className="mt-2 rounded-lg bg-gray-50 p-3">
      <p>{review.reviewer_label} (admin #{review.reviewer_id}) · {new Date(review.reviewed_at).toLocaleString('en-US')}</p>
      <p>{review.current ? 'Current confirmation' : 'Previous confirmation'} · Source revision {review.source_revision}</p>
      <p className="mt-1 break-words">{review.source_snapshot.title} · {review.source_snapshot.url}</p>
      <p>Supported information: {review.source_snapshot.supported_fields.map((key) => COURSE_SOURCE_FIELDS[key]).join(', ')}</p>
      {review.source_snapshot.notes && <p>{review.source_snapshot.notes}</p>}
      <details className="mt-2"><summary className="cursor-pointer">Information recorded at review</summary><ReviewInformation information={review.claim_snapshot} supportedFields={review.source_snapshot.supported_fields} /></details>
    </article>)}
  </details>
}

function SavedSupportCoverage({ sources }) {
  const coverage = savedSourceCoverage(sources)
  return <div className={`rounded-lg border p-3 text-sm ${coverage.missing.length ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'}`} role="status">
    <p className="font-medium">Saved source support: {coverage.confirmed.length} of 5 information types confirmed</p>
    {!!coverage.confirmed.length && <p className="mt-1">Current confirmed support: {coverage.confirmed.map(key => COURSE_SOURCE_FIELDS[key]).join(', ')}.</p>}
    {!!coverage.missing.length && <p className="mt-1">Missing current confirmed support: {coverage.missing.map(key => COURSE_SOURCE_FIELDS[key]).join(', ')}.</p>}
    <p className="mt-2">Sources can cover different information. Only selected information in a recorded, current confirmation counts. Save Draft Changes does not add source support or record a confirmation.</p>
  </div>
}

export default function DraftCourseSources({ courseId, adminToken, courseDirty, refreshKey, onUnauthorized, sourceUrlPolicy, form, formRevision = 0, allowChecking = false, onWorkingChange, readOnly = false, onEditorChange }) {
  const [sources, setSources] = useState([])
  const [editor, setEditor] = useState(null)
  const [errors, setErrors] = useState({})
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(Boolean(courseId))
  const [busy, setBusy] = useState(false)
  const [confirmation, setConfirmation] = useState({})
  useEffect(() => {
    onEditorChange?.(Boolean(editor) || busy)
    return () => onEditorChange?.(false)
  }, [editor, busy, onEditorChange])
  const base = `${import.meta.env.VITE_API_URL}/api/admin/courses/${courseId}/sources`
  const request = async (suffix = '', method = 'GET', body) => {
    const response = await fetch(base + suffix, { method, headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })
    if (response.status === 401 || response.status === 403) { onUnauthorized(response); throw new Error('Administrator access required.') }
    const data = await response.json()
    if (!response.ok) { if (data.fieldErrors) setErrors(data.fieldErrors); throw new Error(data.message || 'Could not save or load sources.') }
    return data
  }
  const reload = async () => {
    const data = await request()
    setSources(data.sources)
    setConfirmation({})
  }
  useEffect(() => {
    if (!courseId) return
    let active = true
    const load = async () => {
      setLoading(true)
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/courses/${courseId}/sources`, { headers: { Authorization: `Bearer ${adminToken}` } })
        if (response.status === 401 || response.status === 403) { onUnauthorized(response); return }
        const data = await response.json()
        if (!response.ok) throw new Error(data.message || 'Could not load sources.')
        if (active) { setSources(data.sources); setError(''); setConfirmation({}) }
      } catch (failure) { if (active) setError(failure.message) } finally { if (active) setLoading(false) }
    }
    load()
    return () => { active = false }
  }, [courseId, adminToken, refreshKey, onUnauthorized])
  const act = async (operation, successMessage = '') => {
    setBusy(true); setError(''); setNotice('')
    try { await operation(); await reload(); setNotice(successMessage) } catch (failure) { setError(failure.message) } finally { setBusy(false) }
  }
  const set = (key, value) => { setEditor((current) => ({ ...current, [key]: value })); setErrors((current) => ({ ...current, [key]: undefined })) }
  const save = () => {
    const validation = validateApprovedCourseSource(editor, sourceUrlPolicy)
    setErrors(validation.errors)
    if (Object.keys(validation.errors).length) return
    act(async () => {
      await request(editor.source_id ? `/${editor.source_id}` : '', editor.source_id ? 'PUT' : 'POST', { ...validation.value, source_revision: editor.source_revision })
      setEditor(null)
    }, 'Source selections saved. Open the reference and record a new admin confirmation for these saved selections. Saving the course alone does not confirm them.')
  }
  const currentSources = sources.filter((source) => !source.is_removed)
  const analysisSources = currentSources.map(source => editor?.source_id === source.source_id ? { ...source, ...editor } : source)
  if (editor && !editor.source_id && (editor.url || editor.title || editor.notes || editor.supported_fields.length)) analysisSources.push(editor)
  const checkKey = allowChecking ? JSON.stringify([formRevision, refreshKey, analysisSources.map(source => pendingSourceAnalysisBinding(source, form))]) : ''
  const confirmationFor = source => confirmation[source.source_id] === `${source.review_token}:${formRevision}` ? source.review_token : null
  const validSources = currentSources.filter(source => !sourceUrlError(source.url, sourceUrlPolicy))
  if (readOnly) return <DraftDisclosure title="Sources" defaultOpen><div className="space-y-4">
    <p className="text-sm text-gray-600">Saved source confirmations are separate from matching-profile review and publication. Use Edit Draft to change a reference or record a missing source confirmation.</p>
    {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    {loading && <p className="text-sm">Loading sources...</p>}
    {!loading && !error && <SavedSupportCoverage sources={validSources} />}
    {!loading && !currentSources.length && <p className="text-sm text-gray-500">No saved sources.</p>}
    {currentSources.map(source => <DraftDisclosure key={source.source_id} level="h3" title={source.title} summary={<div className="space-y-2"><p className="text-sm">{labels[source.review_status]}</p><p className="text-sm">{source.review_status === 'confirmed' ? 'Confirmed support only' : 'Saved selections'}: {sourceSupportLabels(source)}.</p>{source.checks?.[0] && <>{!source.checks[0].current && <p className="text-sm text-amber-800">Previous automated check: this result is not current for the saved revision.</p>}<SourceCheckReport report={source.checks[0].report} sourceUrlPolicy={sourceUrlPolicy} summaryOnly /></>}</div>} actions={<a href={validateCourseSource(source).errors.url ? undefined : source.url} target="_blank" rel="noopener noreferrer" className="text-sm text-orange-700 underline">Open Source</a>}>
      <p className="text-sm">Supports: {source.supported_fields.map(key => COURSE_SOURCE_FIELDS[key]).join(', ')}</p>
      {source.notes && <p className="mt-2 whitespace-pre-wrap text-sm">{source.notes}</p>}
      {source.reviews.filter(review => review.current).map(review => <p key={review.review_id} className="mt-2 text-sm">Confirmed by {review.reviewer_label} on {new Date(review.reviewed_at).toLocaleString('en-US')}.</p>)}
      {source.checks?.[0] && <SourceCheckReport report={source.checks[0].report} sourceUrlPolicy={sourceUrlPolicy} detailsOnly />}
      {source.checks?.slice(1).map(check => <details key={check.check_id} className="mt-3 text-sm"><summary className="cursor-pointer">Previous automated check</summary><SourceCheckReport report={check.report} sourceUrlPolicy={sourceUrlPolicy} /></details>)}
      <SourceHistory reviews={source.reviews} />
    </DraftDisclosure>)}
  </div></DraftDisclosure>
  return <section className="mb-8 rounded-2xl border border-orange-100 bg-white p-5 shadow-sm sm:p-7">
    <h2 className="font-semibold text-gray-900">Course sources</h2>
    <p className="mt-2 text-sm text-gray-600">Confirm only that a saved source supports its selected information. This does not approve matching weights or publish the course.</p>
    {courseDirty && courseId && <p className="mt-2 text-sm text-amber-700">Save or discard course changes before confirming a source.</p>}
    {!loading && !error && <div className="mt-3"><SavedSupportCoverage sources={validSources} /></div>}
    <p className="mt-2 text-sm text-gray-600">To change supported information: Edit source, select the information, Save Source Selections, then Record Admin Confirmation. Save the course first if its details changed.</p>
    {notice && <p role="status" className="mt-3 text-sm text-emerald-800">{notice}</p>}
    {sourceUrlPolicy?.error && <p role="alert" className="mt-2 text-sm text-red-600">{sourceUrlPolicy.error}</p>}
    {allowChecking && <ReopenedDraftSourceCheck key={checkKey} sources={analysisSources} form={form} courseId={courseId} adminToken={adminToken} sourceUrlPolicy={sourceUrlPolicy} onUnauthorized={onUnauthorized} onWorkingChange={onWorkingChange} hasUnsavedChanges={courseDirty || Boolean(editor)} saving={busy || loading} />}
    {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
    <button type="button" disabled={!courseId || busy || loading || Boolean(editor) || currentSources.length >= 3} onClick={() => { setEditor({ ...blankSource }); setErrors({}); setError('') }} className="mt-4 rounded-lg bg-orange-500 px-4 py-2 text-sm text-white disabled:opacity-50">Add Source</button>
    {loading && <p className="mt-3 text-sm">Loading sources...</p>}
    {editor && <div className="mt-4 space-y-3 rounded-xl border border-gray-200 p-4">
      <h3 className="font-medium">{editor.source_id ? 'Edit source' : 'Add source'}</h3>
      {['title', 'url', 'notes'].map((key) => <label key={key} className="block text-sm">{key === 'url' ? 'URL' : key === 'title' ? 'Title' : 'Notes (optional)'}{key !== 'notes' && <RequiredMark />}
        {key === 'notes' ? <textarea disabled={busy} className={inputClass} maxLength={5000} value={editor[key] || ''} onChange={(e) => set(key, e.target.value)} /> : <input disabled={busy} required aria-required="true" className={inputClass} type={key === 'url' ? 'url' : 'text'} maxLength={key === 'url' ? 2048 : 255} value={editor[key]} onBlur={() => { if (key === 'url') setErrors(current => ({ ...current, url: sourceUrlError(editor.url, sourceUrlPolicy) })) }} aria-invalid={Boolean(key === 'url' ? sourceUrlError(editor.url, sourceUrlPolicy) || errors.url : errors[key])} aria-describedby={errors[key] ? `source-${key}-error` : undefined} onChange={(e) => set(key, e.target.value)} />}
        <FieldError id={`source-${key}-error`}>{key === 'url' ? sourceUrlError(editor.url, sourceUrlPolicy) || errors.url : errors[key]}</FieldError>
      </label>)}
      <fieldset disabled={busy} aria-describedby={errors.supported_fields ? 'source-fields-error' : undefined}><legend className="text-sm">Information supported (select at least one) <RequiredMark /></legend>
        {Object.entries(COURSE_SOURCE_FIELDS).map(([key, label]) => <label key={key} className="mt-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={editor.supported_fields.includes(key)} onChange={(e) => set('supported_fields', e.target.checked ? [...editor.supported_fields, key] : editor.supported_fields.filter((field) => field !== key))} />{label}</label>)}
        <FieldError id="source-fields-error">{errors.supported_fields}</FieldError>
      </fieldset>
      <div className="flex gap-3"><button type="button" disabled={busy || Boolean(sourceUrlError(editor.url, sourceUrlPolicy))} onClick={save} className="rounded-lg bg-orange-500 px-3 py-2 text-sm text-white disabled:opacity-50">Save Source Selections</button><button type="button" disabled={busy} onClick={() => setEditor(null)} className="px-3 py-2 text-sm">Cancel</button></div>
    </div>}
    {!loading && !currentSources.length && <p className="mt-4 text-sm text-gray-500">No saved sources.</p>}
    {currentSources.map((source) => <article key={source.source_id} className="mt-4 rounded-xl border border-gray-200 p-4">
      <h3 className="break-words font-medium">{source.title}</h3><p className="mt-1 text-sm">{labels[source.review_status]}</p>
      <p className="mt-2 text-sm">Supports: {source.supported_fields.map((key) => COURSE_SOURCE_FIELDS[key]).join(', ')}</p>
      {source.checks?.map((check) => <details key={check.check_id} className="mt-3 text-sm"><summary className="cursor-pointer">Saved check: {sourceReportHeading(check.report)}{check.report.selected_program && ` - ${check.report.selected_program}`}{check.current ? '' : ' (previous source revision)'}</summary>{check.report.context_sha256 && <SourceAnalysisDetails report={check.report} />}<ul className="mt-2 list-disc pl-5">{check.report.reasons.map((reason, i) => <li key={i}>{reason}</li>)}</ul><SourceEvidenceExcerpts report={check.report} sourceUrlPolicy={sourceUrlPolicy} /></details>)}
      {source.notes && <p className="mt-2 whitespace-pre-wrap text-sm">{source.notes}</p>}
      <details className="mt-3" open><summary className="cursor-pointer text-sm font-medium">Saved information for this confirmation</summary><ReviewInformation information={source.review_information} supportedFields={source.supported_fields} /></details>
      <div className="mt-3 flex flex-wrap gap-3 text-sm">
        <a href={validateCourseSource(source).errors.url ? undefined : source.url} target="_blank" rel="noopener noreferrer" className="break-all text-orange-700 underline">Open Source</a>
        <button type="button" disabled={busy || Boolean(editor)} onClick={() => { setEditor({ ...source, notes: source.notes || '' }); setErrors({}); setConfirmation({}) }}>Edit source</button>
        <button type="button" disabled={busy || Boolean(editor)} onClick={() => { if (window.confirm('Remove this source? Its review history will be retained.')) act(() => request(`/${source.source_id}`, 'DELETE', { source_revision: source.source_revision })) }}>Remove source</button>
      </div>
      <label className="mt-4 flex items-start gap-2 text-sm"><input className="mt-1" type="checkbox" disabled={busy || courseDirty || Boolean(editor) || loading} checked={Boolean(confirmationFor(source))} onChange={(e) => setConfirmation((current) => ({ ...current, [source.source_id]: e.target.checked ? `${source.review_token}:${formRevision}` : null }))} />I opened this source and confirm support only for: {sourceSupportLabels(source)}.</label>
      <button type="button" className="mt-2 rounded-lg border border-orange-200 px-3 py-2 text-sm disabled:opacity-50" disabled={!sourceConfirmationPayload(source, confirmationFor(source), busy || loading || courseDirty || Boolean(editor) || Boolean(sourceUrlError(source.url, sourceUrlPolicy)))} onClick={() => {
        const payload = sourceConfirmationPayload(source, confirmationFor(source), busy || loading || courseDirty || Boolean(editor) || Boolean(sourceUrlError(source.url, sourceUrlPolicy)))
        if (payload) act(() => request(`/${source.source_id}/reviews`, 'POST', payload), `Admin confirmation recorded for: ${sourceSupportLabels(source)}. Other information is not confirmed by this action.`)
      }}>Record Admin Confirmation</button>
      <SourceHistory reviews={source.reviews} />
    </article>)}
    {sources.some((source) => source.is_removed) && <details className="mt-4 text-sm"><summary className="cursor-pointer">Removed sources and history</summary>{sources.filter((source) => source.is_removed).map((source) => <div key={source.source_id} className="mt-3"><p>{source.title} · Removed</p><SourceHistory reviews={source.reviews} /></div>)}</details>}
  </section>
}
