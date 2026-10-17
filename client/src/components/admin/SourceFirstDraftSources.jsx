import DraftCourseExample from './DraftCourseExample'
import SourceAnalysisDetails from './SourceAnalysisDetails'
import SourceEvidenceExcerpts from './SourceEvidenceExcerpts'
import SourceCheckResults from './SourceCheckResults'
import SourceCheckProgress from './SourceCheckProgress'
import SourceCheckReport from './SourceCheckReport'
import DraftDisclosure, { DraftGuidance } from './DraftDisclosure'
import { useEffect, useRef, useState } from 'react'
import { COURSE_SOURCE_FIELDS } from '../../../../shared/courseSourceFields'
import { sourceUrlError, validateApprovedCourseSource, hasInvalidSourceUrls } from '../../../../shared/sourceUrlPolicy'
import { pendingSourceBinding, pendingSourceAnalysisBinding } from '../../../../shared/pendingSourceReview'
import { SOURCE_CHECK_CLIENT_TIMEOUT_MS } from '../../../../shared/sourceCheckTiming'
import { MAX_DRAFT_SOURCES, createDraftSource, enteredDraftSources, invalidatePendingReviews, sourceReportHeading, updatePendingSource, applyCurrentSourceResults, visibleSourceReport } from '../../utils/draftSourceCheckForm'
import { FieldError, RequiredMark, PublicationRequiredMark } from '../FormValidation'
import { scrollToFirstInvalidField } from '../../utils/formValidation'

const sourceGuidance = {
  url: { help: 'Paste the full webpage or PDF link you used as a reference.', example: 'Ex. https://example.edu/program' },
  title: { help: 'Name the reference so another reviewer can identify it.', example: 'Ex. University program curriculum' },
  notes: { help: 'Optionally note a section, page or limitation to help the reviewer.', example: 'Ex. See curriculum pages 4-6.' },
}
const inputClass = 'mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm'
export default function SourceFirstDraftSources({ sources, setSources, form, adminToken, onUnauthorized, saveError, saving, onWorkingChange, sourceUrlPolicy, checkingOnly = false, courseId, hasUnsavedChanges = false }) {
  const [working, setWorking] = useState(false)
  const [checking, setChecking] = useState(false)
  const busy = working || saving
  const enteredSources = enteredDraftSources(sources)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [confirmation, setConfirmation] = useState({})
  const active = useRef(true)
  const abort = useRef(null)
  const inFlight = useRef(false)
  const formEpoch = useRef(0)
  const latestForm = useRef(form)
  useEffect(() => { latestForm.current = form; formEpoch.current++ }, [form])
  const validateCourseSource = source => validateApprovedCourseSource(source, sourceUrlPolicy)
  const invalidUrls = hasInvalidSourceUrls(sources, sourceUrlPolicy)
  useEffect(() => {
    active.current = true
    abort.current = new AbortController()
    return () => { active.current = false; abort.current.abort(); onWorkingChange(false) }
  }, [onWorkingChange])
  const request = async (action, body) => {
    const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/admin/course-sources/${action}`, { method: 'POST', headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.any([AbortSignal.timeout(SOURCE_CHECK_CLIENT_TIMEOUT_MS), abort.current.signal]) })
    if (!active.current) throw new Error('Source editor was closed.')
    if (response.status === 401 || response.status === 403) onUnauthorized(response)
    if (!response.headers.get('content-type')?.includes('application/json')) throw new Error(`Source API returned an unexpected response (HTTP ${response.status}). Try again or review the source manually.`)
    const data = await response.json()
    abort.current.signal.throwIfAborted()
    if (!active.current) throw new Error('Source editor was closed.')
    if (!response.ok) {
      if (data.fieldErrors?.url) {
        const source = action === 'confirm' ? enteredSources.find(source => source.url.trim() === body.source.url) : enteredSources[data.source_index ?? 0]
        if (source) setFieldErrors(current => ({ ...current, [source.client_id]: { ...current[source.client_id], url: data.fieldErrors.url } }))
      }
      throw new Error(data.message || 'Could not process sources.')
    }
    return data
  }
  const act = async (operation, isCheck = false) => { if (inFlight.current) return; inFlight.current = true; setWorking(true); setChecking(isCheck); onWorkingChange(true); setError(''); try { await operation() } catch (failure) { if (active.current) setError(failure.message) } finally { inFlight.current = false; if (active.current) { if (abort.current.signal.aborted) abort.current = new AbortController(); setWorking(false); setChecking(false); onWorkingChange(false) } } }
  const update = (id, patch) => setSources((current) => invalidatePendingReviews(current.map((source) => source.client_id === id ? updatePendingSource(source, patch) : source), form))
  const edit = (source, key, value) => {
    if (value === source[key]) {
      if (key === 'url') setFieldErrors(current => ({ ...current, [source.client_id]: { ...current[source.client_id], url: sourceUrlError(value, sourceUrlPolicy) } }))
      return
    }
    const patch = { [key]: value }
    update(source.client_id, patch); setConfirmation({})
    setFieldErrors(current => ({ ...current, [source.client_id]: { ...current[source.client_id], [key]: key === 'url' ? sourceUrlError(value, sourceUrlPolicy) : undefined } }))
  }
  const check = () => {
    const errors = {}
    for (const source of enteredSources) {
      const validation = validateCourseSource({ ...source, title: 'Source', supported_fields: ['course_name'] })
      if (validation.errors.url) errors[source.client_id] = { url: validation.errors.url }
    }
    setFieldErrors(errors)
    if (!form.course_name.trim()) { setError('Enter the course name before checking sources.'); return }
    if (!enteredSources.length || sources.length > MAX_DRAFT_SOURCES || Object.keys(errors).length) return
    setConfirmation({})
    const snapshots = enteredSources.map(source => ({ id: source.client_id, binding: pendingSourceAnalysisBinding(source, form) }))
    const epoch = formEpoch.current
    act(async () => {
      const data = await request('check', { ...(courseId ? { course_id: courseId } : {}), course_name: form.course_name.trim(), course: form, urls: enteredSources.map((source) => source.url.trim()), sources: enteredSources.map(({ title, url, notes, supported_fields }) => ({ title, url: url.trim(), notes, supported_fields })) })
      if (epoch !== formEpoch.current) throw new Error('Draft details changed while checking. Check sources again for the current details.')
      setSources((current) => applyCurrentSourceResults(current, latestForm.current, snapshots, data.results))
    }, true)
  }
  const errorsFor = (source) => ({ ...(saveError && enteredDraftSources([source]).length ? validateCourseSource(source).errors : fieldErrors[source.client_id]), ...(source.url.trim() ? { url: sourceUrlError(source.url, sourceUrlPolicy) || fieldErrors[source.client_id]?.url || undefined } : {}) })
  if (checkingOnly) return <div className="mt-4 rounded-xl border border-orange-100 p-4">
    <h3 className="font-medium">Check current draft sources</h3>
    <p className="mt-2 text-sm"><strong>{hasUnsavedChanges ? 'Unsaved changes included.' : 'Current form content.'}</strong> Analysis uses the course details and references currently shown. Results stay in this editor only; checking does not save, confirm or publish anything.</p>
    <p className="mt-2 text-xs text-gray-600">Up to three sources. Text budget: 12,000 tokens; scanned-PDF budget: 65,000 tokens. Each source may incur a separate model request; cache savings are not guaranteed.</p>
    {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
    <button type="button" disabled={busy || invalidUrls || !enteredSources.length || sources.length > MAX_DRAFT_SOURCES || !form.course_name.trim()} onClick={check} className="mt-3 rounded-lg bg-orange-500 px-3 py-2 text-sm text-white disabled:opacity-50">{working ? 'Checking sources...' : 'Check Sources with AI'}</button>
    {checking && <><SourceCheckProgress sourceCount={enteredSources.length} /><button type="button" onClick={() => abort.current.abort()} className="mt-2 text-sm underline">Cancel source check</button></>}
    {!form.course_name.trim() && <p className="mt-2 text-sm text-amber-800">Enter the course name before checking sources.</p>}
    {sources.map(source => <article key={source.client_id} className="mt-3 rounded-lg border border-gray-200 p-3 text-sm">
      <p className="font-medium">{source.title || 'Untitled reference'}</p><p className="break-all">{source.url || 'No URL entered'}</p>
      {source.url.trim() && !sourceUrlError(source.url, sourceUrlPolicy) && <a href={source.url.trim()} target="_blank" rel="noopener noreferrer" className="text-orange-700 underline">Open Source</a>}
      <FieldError>{sourceUrlError(source.url, sourceUrlPolicy) || fieldErrors[source.client_id]?.url}</FieldError>
      {source.report && <SourceCheckResults><p className="mt-2 font-semibold">{sourceReportHeading(source.report)}</p><SourceAnalysisDetails report={source.report} /><ul className="mt-2 list-disc pl-5">{source.report.reasons.map((reason, i) => <li key={i}>{reason}</li>)}</ul><SourceEvidenceExcerpts report={source.report} sourceUrlPolicy={sourceUrlPolicy} /></SourceCheckResults>}
    </article>)}
  </div>
  return <div data-validation-field="source_details"><DraftDisclosure title="Sources" defaultOpen hasError={Boolean(error || saveError || sourceUrlPolicy?.error || invalidUrls)} actions={<DraftCourseExample kind="sources" />} summary={({ open }) => <>
      {sourceUrlPolicy?.error && <p role="alert" className="text-sm text-red-600">{sourceUrlPolicy.error}</p>}
      {(error || saveError) && <p className="text-sm text-red-600" role="alert">{error || saveError}</p>}
      {!open && <div className="space-y-3">{sources.map((source, index) => <div key={source.client_id} className="min-w-0 space-y-2 border-t border-gray-100 pt-3">
        <p className="break-words font-medium">Source {index + 1}{source.title ? `: ${source.title}` : ''}</p>
        <p className="text-xs text-gray-600">{source.confirmation_receipt && source.confirmation_binding === pendingSourceBinding(source, form) ? 'Confirmed for draft save' : source.confirmation_invalidated ? 'Review required' : 'Not confirmed'}</p>
        {Object.entries(errorsFor(source)).filter(([, message]) => message).map(([key, message]) => <FieldError key={key}>{message}</FieldError>)}
        {visibleSourceReport(source) && <SourceCheckReport report={visibleSourceReport(source)} previous={!source.report} summaryOnly />}
      </div>)}</div>}
    </>}>
    <div className="space-y-3">
    <p className="mt-2 text-sm text-gray-600">At least one manually confirmed reference is required to publish; use up to three. Complete the URL, title and supported information for each reference you enter. Unused inputs, notes and Check Sources are optional.</p>
    {!!sourceUrlPolicy?.hosts?.length && <p className="mt-2 break-words text-xs text-gray-600">Approved publisher hosts: {sourceUrlPolicy.hosts.join(', ')}</p>}
    <div className="mt-4 flex flex-wrap gap-3">
      <button type="button" aria-describedby="source-check-help" disabled={busy || invalidUrls || !enteredSources.length || !form.course_name.trim()} onClick={check} className="rounded-lg bg-orange-500 px-3 py-2 text-sm text-white disabled:opacity-50">{working ? 'Checking sources...' : saving ? 'Saving draft...' : 'Check Sources with AI'}</button>
      <p className="self-center text-xs text-gray-500">Scanned PDFs may not be readable by the automated checker. Open the source and review it manually if needed.</p>
    </div>
    <DraftGuidance><p>Use the full webpage or PDF URL, a descriptive reference title and optional notes for supporting pages, sections or limitations.</p><p>Open each reference, check its publisher origin and relevant content, then record supporting pages or sections in Notes. Use a reference title another reviewer can identify. Select only information the source supports.</p><p>Confirm support explicitly after reviewing the source. Confirmation is separate from automated results; it does not approve matching weights or publish the course. Relevant edits require another review.</p><p>Check explanations are unverified analysis. Compare them with the source; complete coverage and conflict detection are not guaranteed.</p><p id="source-check-help" className="text-xs text-gray-500">Optional. Reads webpage/PDF text; scanned PDFs may use AI page reading within configured limits. Results identify AI or Basic checking; Basic is used when AI is disabled or unavailable and readable text exists. Potential Match indicates supporting information from an approved origin, not verification or current applicability.</p></DraftGuidance>
    {checking && <SourceCheckProgress sourceCount={enteredSources.length} />}
    {!!sources.length && !form.course_name.trim() && <p className="mt-3 text-sm text-amber-800">Enter the course name in Course Details before checking sources.</p>}
    {checking && <button type="button" onClick={() => abort.current.abort()} className="mt-3 text-sm underline">Cancel source check</button>}
    {!sources.length && <p className="mt-3 text-sm text-gray-500">Add up to three source links. Enter the course name in Course Details before checking sources.</p>}
    {sources.map((source, index) => <DraftDisclosure key={source.client_id} level="h3" defaultOpen title={`Source ${index + 1}${source.title ? `: ${source.title}` : ''}`} hasError={Object.values(errorsFor(source)).some(Boolean)}
      actions={!validateCourseSource({ ...source, title: 'Source', supported_fields: ['course_name'] }).errors.url && <a className="text-sm text-orange-700 underline" href={source.url} target="_blank" rel="noopener noreferrer">Open Source</a>}
      summary={({ open }) => <div className="space-y-2">
        <p className="text-xs text-gray-600">{source.confirmation_receipt && source.confirmation_binding === pendingSourceBinding(source, form) ? 'Confirmed for draft save' : source.confirmation_invalidated ? 'Review required' : 'Not confirmed'}</p>
        {!open && Object.entries(errorsFor(source)).filter(([, message]) => message).map(([key, message]) => <FieldError key={key}>{message}</FieldError>)}
        {visibleSourceReport(source) && <SourceCheckReport report={visibleSourceReport(source)} previous={!source.report} summaryOnly />}
      </div>}>
      <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {['url', 'title', 'notes'].map((key) => <label key={key} className="block text-sm">{key === 'url' ? 'Source URL' : key === 'title' ? 'Reference title' : 'Notes (optional)'}{key !== 'notes' && <RequiredMark />}
        <input disabled={busy} required={key !== 'notes' && enteredDraftSources([source]).length > 0} aria-required={key !== 'notes' && enteredDraftSources([source]).length > 0 || undefined} type={key === 'url' ? 'url' : 'text'} maxLength={key === 'url' ? 2048 : key === 'title' ? 255 : 5000} className={inputClass} placeholder={sourceGuidance[key].example} aria-describedby={`source-${source.client_id}-${key}-help source-${source.client_id}-${key}-error`} value={source[key]} aria-invalid={Boolean(errorsFor(source)[key])} onChange={event => edit(source, key, event.target.value)} onBlur={event => { if (key === 'url') edit(source, key, event.target.value.trim()) }} onPaste={event => {
          if (key !== 'url') return
          setFieldErrors(current => ({ ...current, [source.client_id]: { ...current[source.client_id], url: sourceUrlError(event.clipboardData.getData('text'), sourceUrlPolicy) } }))
        }} /><FieldError id={`source-${source.client_id}-${key}-error`}>{errorsFor(source)[key]}</FieldError><span id={`source-${source.client_id}-${key}-help`} className="sr-only">{sourceGuidance[key].help}</span>
      </label>)}
      </div>
      {index > 0 && <button type="button" disabled={busy} className="text-sm text-red-600 underline" onClick={() => { setSources((current) => current.filter((item) => item.client_id !== source.client_id)) }}>Remove Source</button>}
      {visibleSourceReport(source) && <SourceCheckReport report={visibleSourceReport(source)} sourceUrlPolicy={sourceUrlPolicy} detailsOnly />}
      <div className="grid grid-cols-1 gap-5 border-t border-gray-100 pt-4 md:grid-cols-2">
      <fieldset disabled={busy} aria-describedby={`source-${source.client_id}-supported-help`}><legend className="text-sm font-medium">Information supported (select at least one) <RequiredMark /></legend><p id={`source-${source.client_id}-supported-help`} className="mt-1 text-xs text-gray-500">Select only information this reference supports. Matching-profile evidence provides a basis for weights; it does not approve them.</p>{Object.entries(COURSE_SOURCE_FIELDS).map(([key, label]) => <label key={key} className="mt-2 flex items-center gap-2 text-sm"><input type="checkbox" aria-invalid={Boolean(errorsFor(source).supported_fields)} checked={source.supported_fields.includes(key)} onChange={(event) => { update(source.client_id, { supported_fields: event.target.checked ? [...source.supported_fields, key] : source.supported_fields.filter((field) => field !== key) }); setConfirmation({}) }} />{label}</label>)}<FieldError>{errorsFor(source).supported_fields}</FieldError></fieldset>
      <div className="space-y-3">
      {source.confirmation_invalidated && !source.confirmation_receipt && <p className="text-sm text-amber-800">Relevant unsaved information changed. Confirm source support again.</p>}
      {source.confirmation_receipt && source.confirmation_binding === pendingSourceBinding(source, form) && <p className="text-sm text-emerald-700">Your confirmation will be recorded with your admin identity and date when the draft is saved.</p>}
      <p id={`source-${source.client_id}-confirmation-help`} className="text-xs text-gray-500">Open the source and compare it with the selected information before confirming. Relevant edits require another review; confirmation never publishes a course.</p>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" aria-describedby={`source-${source.client_id}-confirmation-help`} disabled={busy} checked={confirmation[source.client_id] === pendingSourceBinding(source, form)} onChange={(event) => setConfirmation((current) => ({ ...current, [source.client_id]: event.target.checked ? pendingSourceBinding(source, form) : null }))} /><span>I opened this source and confirm it supports the selected information in the current draft. <PublicationRequiredMark /></span></label>
      <button type="button" disabled={busy || Boolean(sourceUrlError(source.url, sourceUrlPolicy)) || confirmation[source.client_id] !== pendingSourceBinding(source, form)} onClick={() => {
        const validation = validateCourseSource(source); setFieldErrors((current) => ({ ...current, [source.client_id]: validation.errors }))
        if (Object.keys(validation.errors).length) scrollToFirstInvalidField(['source_details'])
        if (!Object.keys(validation.errors).length) act(async () => { const result = await request('confirm', { source: validation.value, course: form, confirmed: true, check_receipt: source.check_receipt }); update(source.client_id, { ...result, confirmation_invalidated: false }) })
      }} className="rounded-lg border border-orange-200 px-3 py-2 text-sm disabled:opacity-50">Confirm Source for Draft Save</button>
      </div></div></div>
    </DraftDisclosure>)}
    <div className="mt-4">
      {sources.length < MAX_DRAFT_SOURCES && <button type="button" disabled={busy} onClick={() => setSources((current) => current.length >= MAX_DRAFT_SOURCES ? current : [...current, createDraftSource()])} className="rounded-lg border border-orange-200 px-3 py-2 text-sm disabled:opacity-50">Add Another Source</button>}
    </div>
    </div>
  </DraftDisclosure></div>
}
