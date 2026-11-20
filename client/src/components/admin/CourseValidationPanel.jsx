import { useState } from 'react'
import { IconClipboardCheck, IconRefresh } from '@tabler/icons-react'
import CourseValidationSnapshot from '../CourseValidationSnapshot'
import { WorkflowCheck, WorkflowFeedback, WorkflowField, WorkflowStatus, workflowCard, workflowInput } from '../CourseValidationForms'
import { useWorkflowAction, useWorkflowData } from '../../hooks/useCourseValidation'
import { downloadReviewImage, reviewDate, validationLabels, workflowApi } from '../../utils/courseValidationApi'

export default function CourseValidationPanel({ token, courseId, clusters = [], onOpenCourse }) {
  const [cluster, setCluster] = useState('')
  const [batchId, setBatchId] = useState(null)
  const accounts = useWorkflowData('admin/validators', token)
  const queue = useWorkflowData(courseId ? `admin/validation?courseId=${courseId}` : cluster ? `admin/validation?cluster=${encodeURIComponent(cluster)}` : null, token, { interval: courseId ? 5000 : 10000 })
  const batch = useWorkflowData(batchId ? `admin/validation/assignment/${batchId}` : null, token)
  const action = useWorkflowAction()
  const image = useWorkflowAction()
  const current = queue.data
  const eligible = accounts.data?.accounts.filter(account => account.status === 'approved' && account.approved_clusters.includes(current?.cluster)) || []
  const blocked = current?.fieldErrors && Object.keys(current.fieldErrors).length > 0
  const assignmentVersion = current?.expectedVersion || current?.courses?.map(course => `${course.course_id}:${course.version}`).join(',')

  const send = event => {
    event.preventDefault()
    const fields = new FormData(event.currentTarget)
    action.run(async () => {
      const selection = courseId ? { courseId, expectedVersion: current.expectedVersion } : { courses: current.courses }
      const result = await workflowApi('admin/validation/assign', { token, body: {
        ...selection, cluster: current.cluster, validatorId: fields.get('validatorId'), confirmed: fields.has('confirmed'),
      } })
      queue.refresh()
      return { message: `Sent ${result.count} ${result.count === 1 ? 'course' : 'courses'} for validation.` }
    })
  }
  const replace = () => action.run(async () => {
    const result = await workflowApi(`admin/validation/replacement/${courseId}`, { token, body: { expectedVersion: current.expectedVersion } })
    onOpenCourse(result.draftId)
  })
  const signature = id => image.run(() => downloadReviewImage(`admin/validation/signatures/${id}`, token, 'validation-signature'))

  return <section className={workflowCard} aria-label={courseId ? 'Course validation' : 'Cluster validation'}>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-orange-50 text-orange-900"><IconClipboardCheck size={21} aria-hidden="true" /></span>
        <div><h2 className="text-lg font-semibold text-slate-950">{courseId ? 'Course validation' : 'Cluster validation'}</h2>
          {courseId && current && <WorkflowStatus status={current.status.status}>{validationLabels[current.status.status]}</WorkflowStatus>}
        </div>
      </div>
      <button type="button" className="lm-action" onClick={() => { queue.refresh(); accounts.refresh(); batch.refresh() }}><IconRefresh size={16} aria-hidden="true" />Refresh validation</button>
    </div>
    {!courseId && <WorkflowField label="Cluster" required className="max-w-xl"><select className={workflowInput} required value={cluster} onChange={event => { setCluster(event.target.value); setBatchId(null) }}>
      <option value="">Select a cluster</option>{clusters.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    </select></WorkflowField>}
    <WorkflowFeedback loading={accounts.loading || queue.loading} busy={action.busy} error={queue.error || accounts.error || action.error || image.error} message={action.message} />
    {current && <>
      {current.replacementFor && <button type="button" className="lm-action" onClick={() => onOpenCourse(current.replacementFor)}>View published course</button>}
      {current.canReplace && <button type="button" className="lm-action" disabled={action.busy} onClick={current.replacementId ? () => onOpenCourse(current.replacementId) : replace}>{current.replacementId ? 'Open replacement draft' : 'Create replacement draft'}</button>}
      {blocked && <details className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><summary className="cursor-pointer font-semibold">Complete the saved course and sources before sending</summary>
        <ul className="list-disc space-y-1 pl-5 pt-2">{Object.entries(current.fieldErrors).map(([field, message]) => <li key={field}>{message}</li>)}</ul></details>}
      {courseId && current.status.status === 'needs_changes' && <p className="text-sm text-gray-700">Correct the draft and resubmit the saved revision. For a published course, use a replacement draft.</p>}
      {!courseId && <>
        <div className="space-y-2 rounded-xl border border-stone-200 bg-stone-50 p-4">
          <p className="text-sm font-semibold">{current.validated}/{current.total} active courses validated in this cluster</p>
          {current.total > 0 && <progress className="block h-2 w-full accent-orange-700" aria-label="Cluster validation progress" value={current.validated} max={current.total} />}
        </div>
        <details open className="rounded-xl border border-stone-200 p-4 text-sm"><summary className="cursor-pointer font-semibold">{current.courses.length} course versions eligible to send</summary>
          <ul className="mt-2 max-h-60 divide-y divide-stone-100 overflow-auto">{current.courses.map(course => <li key={course.course_id} className="flex flex-wrap justify-between gap-2 py-2"><span>{course.course_name}</span><span className="text-xs text-slate-600">{course.course_code}</span></li>)}</ul>
        </details>
        {!!current.batches.length && <div className="space-y-2 text-sm"><h3 className="font-semibold">Batch progress</h3>
          {current.batches.map(row => <div className="flex flex-wrap items-center gap-2 rounded-xl border border-stone-200 p-3" key={row.assignment_id}>
            <button type="button" className="lm-action" aria-pressed={batchId === row.assignment_id} onClick={() => setBatchId(row.assignment_id)}>{row.approved}/{row.total} courses validated</button>
            <span className="text-sm text-slate-600">{row.needs_changes} need changes · {row.full_name} · {reviewDate(row.created_at)}</span>
          </div>)}
          <WorkflowFeedback {...batch} />
          {batch.data && <ReviewHistory rows={batch.data.items} token={token} onSignature={signature} />}
        </div>}
      </>}
      {!blocked && (courseId ? !['validated','under_review'].includes(current.status.status) : current.courses.length > 0) && <form key={assignmentVersion} className="space-y-4 rounded-xl border border-stone-200 p-4 sm:p-5" onSubmit={send}>
        <WorkflowField label="Assigned validator"><select name="validatorId" className={workflowInput} defaultValue="" required>
          <option value="">Choose a validator</option>{eligible.map(account => <option key={account.validator_id} value={account.validator_id}>{account.full_name} · {account.email}</option>)}
        </select></WorkflowField>
        {!accounts.loading && !eligible.length && <p className="text-sm text-amber-900">Approve a Validator with expertise in this cluster before assigning the review.</p>}
        <WorkflowCheck name="confirmed">I confirm the selected validator and saved course {courseId ? 'version' : 'list'}.</WorkflowCheck>
        <button className="lm-action lm-action-selected" disabled={action.busy || !eligible.length}>{courseId && current.status.status === 'needs_changes' ? 'Resubmit for Validation' : 'Send for Validation'}</button>
      </form>}
      {!!current.history?.length && <ReviewHistory rows={current.history} token={token} onSignature={signature} />}
    </>}
  </section>
}

function ReviewedVersion({ row, token }) {
  const [open, setOpen] = useState(false)
  const version = useWorkflowData(open ? `admin/validation/records/${row.item_id}` : null, token, { interval: 0 })
  return <details className="mt-1" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary className="cursor-pointer">Reviewed version</summary>
    <p className="mt-2 break-all text-xs">Version {row.version_token}</p>
    <WorkflowFeedback {...version} />
    {version.data && <CourseValidationSnapshot snapshot={version.data.snapshot} />}
  </details>
}

function ReviewHistory({ rows, token, onSignature }) {
  return <section className="space-y-2" aria-label="Review records">
    <h3 className="font-semibold">Review records</h3>
    {rows.map(row => <article className="space-y-1.5 rounded-xl border border-stone-200 bg-stone-50 p-4 text-sm" key={row.item_id}>
      <div className="flex flex-wrap items-center gap-2">
        {row.course_name && <p className="font-semibold">{row.course_name}</p>}
        <WorkflowStatus status={row.decision === 'pending' ? (row.validator_status === 'deactivated' ? 'needs_changes' : 'under_review') : row.decision}>
          {row.decision === 'pending' ? (row.validator_status === 'deactivated' ? 'Reassignment needed' : 'Under Review') : validationLabels[row.decision]}
        </WorkflowStatus>
        <span className="text-xs text-slate-600">{reviewDate(row.decided_at || row.created_at)}</span>
      </div>
      <p>{row.reviewer_snapshot?.full_name || row.validator_name}{row.reviewer_snapshot ? ` · ${row.reviewer_snapshot.profession} · ${row.reviewer_snapshot.affiliation}` : ''}</p>
      {row.remarks && <p className="mt-1 whitespace-pre-wrap">{row.remarks}</p>}
      {row.signature_method && <p className="mt-1">Signed {reviewDate(row.confirmed_at)} · {row.signature_method === 'typed' ? row.typed_name : row.signature_method}</p>}
      {row.signature_id && row.signature_method !== 'typed' && <button type="button" className="mt-1 underline" onClick={() => onSignature(row.signature_id)}>Download private signature</button>}
      <ReviewedVersion row={row} token={token} />
    </article>)}
  </section>
}
