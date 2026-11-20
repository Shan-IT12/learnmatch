import { useEffect, useRef, useState } from 'react'
import { COURSE_SOURCE_FIELDS, validateCourseSource } from '../../../../shared/courseSourceFields'
import { publicationChecklist, publicationFieldLabel } from '../../utils/publicationReadiness'
import { readPublicationJson } from '../../utils/publicationApiResponse'
import { RequiredMark } from '../FormValidation'
import { useWorkflowData } from '../../hooks/useCourseValidation'

async function requestPublication(path, { token, signal, body }) {
  const url = `${import.meta.env.VITE_API_URL || ''}/api/${path}`
  const method = body ? 'POST' : 'GET'
  const response = await fetch(url, {
    method, signal, cache: 'no-store', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const data = await readPublicationJson(response, { url, method })
  if (!response.ok) {
    throw Object.assign(new Error(data.message || 'Could not complete publication review.'), { status: response.status, fieldErrors: data.fieldErrors })
  }
  return data
}

export default function CoursePublicationPanel({ courseId, adminToken, courseDirty, onUnauthorized, onPublished }) {
  const path = `admin/courses/${courseId}/publication`
  const { data: review, error: checkError, loading, refresh } = useWorkflowData(path, adminToken, { read: requestPublication })
  const [busy, setBusy] = useState('')
  const working = useRef(false)
  const [failure, setFailure] = useState(null)
  const [matchingConfirmation, setMatchingConfirmation] = useState(null)
  const [publicationConfirmation, setPublicationConfirmation] = useState(null)
  const revision = review?.review_token ? `${review.review_token}:${review.validation_version || ''}` : null
  const matchingConfirmed = Boolean(revision && matchingConfirmation === revision)
  const publishConfirmed = Boolean(revision && publicationConfirmation === revision)
  const actionError = failure && failure.revision === revision ? failure.error : null
  const error = checkError || actionError
  const fieldErrors = actionError?.fieldErrors || review?.fieldErrors
  useEffect(() => {
    if ([401, 403].includes(checkError?.status)) onUnauthorized(checkError)
  }, [checkError, onUnauthorized])

  const act = async (action, stage) => {
    if (working.current || courseDirty) return
    working.current = true
    setBusy(stage)
    setFailure(null)
    setPublicationConfirmation(null)
    try {
      await action()
      refresh()
    } catch (error) {
      if ([401, 403].includes(error.status)) onUnauthorized(error)
      setFailure({ error, revision })
      refresh()
    } finally {
      working.current = false
      setBusy('')
    }
  }
  const current = Boolean(review) && !courseDirty && !busy && !error
  const checks = review && !review.published ? publicationChecklist({ ...review, fieldErrors }) : []
  const canPublish = current && review?.ready && checks.every(check => check.passed)
  const progressText = busy === 'publishing' ? 'Publishing the reviewed revision...' : busy === 'matching' ? 'Recording matching-profile review and checking requirements...' : 'Checking saved course details, profiles and source confirmations...'

  return <section className="mb-8 space-y-4 rounded-2xl border border-orange-200 bg-white p-5 sm:p-7" aria-labelledby="publication-title" aria-busy={Boolean(busy)}>
    <h2 id="publication-title" className="text-lg font-semibold">Review &amp; Publish</h2>
    <p className="text-sm text-gray-600">Save Draft stores your work without making it available to students. Review the saved course, sources and matching profile, then use Publish Course as the final step. Automated source checks never authorize publication.</p>
    {courseDirty && <p className="text-sm text-amber-800">Save course changes before reviewing or publishing. Relevant changes require another review.</p>}
    <button type="button" disabled={loading || Boolean(busy) || courseDirty} onClick={() => { setFailure(null); refresh() }} className="rounded-lg border border-orange-200 px-3 py-2 text-sm disabled:opacity-50">Check requirements again</button>
    {(loading || busy) && <p role="status" className="flex items-center gap-2 text-sm text-orange-800"><span aria-hidden="true" className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-orange-200 border-t-orange-600 motion-reduce:animate-none" />{progressText}</p>}
    {error && <p role="alert" className="text-sm text-red-700">{error.message}</p>}
    {review?.published && <p role="status" className="text-sm text-emerald-800">This course is already published and read-only.</p>}
    {review && !review.published && <>
      <p className="text-sm font-medium">{review.course.course_code}: {review.course.course_name}</p>
      <details className="text-sm"><summary className="cursor-pointer font-medium">Saved information being reviewed</summary>
        <p className="mt-2">Cluster: {review.fields.matching_profile_evidence.cluster}</p>
        <p className="mt-2 whitespace-pre-wrap">Description: {review.fields.description}</p>
        <p className="mt-2 whitespace-pre-wrap">Obtainable skills: {review.fields.obtainable_skills}</p>
        <p className="mt-2">Duration: {review.fields.duration.years} years</p>
        {review.fields.duration.year_levels?.map((year) => <p key={year.year} className="mt-2 whitespace-pre-wrap">{year.label}: {year.overview}</p>)}
        {!!review.careers?.length && <div className="mt-3"><p className="font-medium">Career opportunities</p>{review.careers.map(career => <p key={career.opportunity_id} className="mt-2 whitespace-pre-wrap">{career.job_title}{career.description ? `: ${career.description}` : ''}{career.salary_range ? ` — ${career.salary_range}` : ''}</p>)}</div>}
        <div className="mt-3 overflow-x-auto"><table className="w-full text-left"><caption className="text-left font-medium">Saved matching weights and evidence</caption><thead><tr><th scope="col">Dimension</th><th scope="col">Weight</th><th scope="col">Evidence</th></tr></thead><tbody>
          {[...review.fields.matching_profile_evidence.skills, ...review.fields.matching_profile_evidence.riasec].map((row) => <tr key={row.skill_domain || row.riasec_type}><td className="py-2 pr-3">{row.skill_domain || row.riasec_type}</td><td className="pr-3">{row.weight}</td><td className="whitespace-pre-wrap break-words">{row.evidence || 'No evidence supplied'}</td></tr>)}
        </tbody></table></div>
        {review.sources.map((source) => <p className="mt-2 break-words" key={source.source_id}><a className="text-orange-700 underline" href={validateCourseSource(source).errors.url ? undefined : source.url} target="_blank" rel="noopener noreferrer">{source.title}</a>: {source.current_review ? `Manually confirmed by ${source.current_review.reviewer_label} on ${new Date(source.current_review.reviewed_at).toLocaleString('en-US')}` : 'Current manual confirmation required'}. Selected support only: {source.supported_fields.map(key => COURSE_SOURCE_FIELDS[key]).join(', ')}.</p>)}
      </details>
      <div className={`rounded-xl border p-4 text-sm ${canPublish ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`} aria-live="polite">
        <p className="font-semibold">{busy === 'publishing' ? 'Publishing the reviewed revision' : busy ? 'Checking publication requirements' : !current ? 'Requirements need to be checked again' : canPublish ? 'All publication requirements passed' : 'Not ready to publish'}</p>
        <p className="mt-1 text-gray-700">{canPublish ? 'Select the publication checkbox below, then click Publish Course.' : current ? 'Resolve the items marked Needs attention and save any edits. Requirements update automatically.' : 'Publication is available once the saved revision has passed every requirement.'}</p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">{checks.map(check => <li key={check.id} className="flex items-start gap-2"><span aria-hidden="true" className={current && check.passed ? 'font-bold text-emerald-700' : 'font-bold text-amber-800'}>{current && check.passed ? '✓' : '•'}</span><span>{check.label}<span className={`block text-xs font-medium ${current && check.passed ? 'text-emerald-800' : 'text-amber-900'}`}>{current ? check.passed ? 'Passed' : 'Needs attention' : 'Not checked for the current state'}</span></span></li>)}</ul>
      </div>
      {!!Object.keys(fieldErrors || {}).length && <div className="rounded-lg border border-amber-100 p-3 text-sm"><p className="font-medium">What to fix before publication</p><ul className="mt-2 list-disc space-y-2 pl-5">{Object.entries(fieldErrors).map(([field, message]) => <li key={field}><strong>{publicationFieldLabel(field, review.sources)}:</strong> {message}</li>)}</ul><p className="mt-3 text-gray-700">Use Edit Draft to correct saved details or source references. To add source support, use Edit source, select the supported information, Save Source Selections, then Record Admin Confirmation. Saving the course does not confirm additional claims. Source URLs must use the configured approved publisher hosts. An automated result cannot override this requirement.</p></div>}
      {review.matching_review ? <p className="text-sm">Matching profile reviewed by {review.matching_review.reviewer_label} on {new Date(review.matching_review.reviewed_at).toLocaleString('en-US')}. This records an admin review, not expert validation.</p> : <>
        <label className="flex items-start gap-3 rounded-xl border border-stone-200 bg-stone-50 p-3.5 text-sm leading-5 text-slate-700"><input className="mt-0.5 size-4 shrink-0 accent-orange-700" type="checkbox" required disabled={busy || courseDirty || !current} checked={matchingConfirmed} onChange={(event) => setMatchingConfirmation(event.target.checked ? revision : null)} /><span>I reviewed the saved skill/RIASEC weights and their documented evidence for this course. <RequiredMark /></span></label>
        <button type="button" disabled={busy || courseDirty || !current || !matchingConfirmed} onClick={() => act(() => requestPublication(`${path}/matching-review`, { token: adminToken, body: { expected_token: review.review_token, confirmed: true } }), 'matching')} className="rounded-lg border border-orange-200 px-3 py-2 text-sm disabled:opacity-50">Record matching-profile review</button>
      </>}
      {!!review.matching_history.length && <details className="text-sm"><summary className="cursor-pointer">Matching-profile review history</summary>{review.matching_history.map((entry) => <p className="mt-2" key={entry.matching_review_id}>{entry.reviewer_label} — {new Date(entry.reviewed_at).toLocaleString('en-US')} ({entry.matching_review_id === review.matching_review?.matching_review_id ? 'Current revision' : 'Earlier revision'})</p>)}</details>}
      <label className="flex items-start gap-3 rounded-xl border border-stone-200 bg-stone-50 p-3.5 text-sm leading-5 text-slate-700"><input className="mt-0.5 size-4 shrink-0 accent-orange-700" type="checkbox" required disabled={busy || courseDirty || !review.ready || !canPublish} aria-describedby="publication-confirmation-help" checked={publishConfirmed && Boolean(canPublish)} onChange={(event) => setPublicationConfirmation(event.target.checked ? revision : null)} /><span>Publish this saved revision for Course Search, recommendations and College selection. <RequiredMark /> School offerings remain separately verified.</span></label>
      <p id="publication-confirmation-help" className={`text-sm ${canPublish ? 'text-emerald-800' : 'text-amber-900'}`}>{canPublish ? 'Requirements passed. Select the checkbox to enable Publish Course.' : 'Publication confirmation is locked: all saved-revision requirements must pass the check above.'}</p>
      <button type="button" disabled={busy || courseDirty || !review.ready || !publishConfirmed || !canPublish} onClick={() => act(async () => { const result = await requestPublication(`${path}/publish`, { token: adminToken, body: { expected_token: review.review_token, expected_validation_version: review.validation_version, publish_confirmed: true } }); await onPublished(result) }, 'publishing')} className="rounded-lg bg-orange-500 px-4 py-2 text-sm text-white disabled:opacity-50">Publish Course — Make available to students</button>
    </>}
  </section>
}
