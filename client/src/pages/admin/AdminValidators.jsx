import { useState } from 'react'
import { IconMailPlus } from '@tabler/icons-react'
import AdminHeader from '../../components/AdminHeader'
import { ClusterChoices, WorkflowFeedback, WorkflowField, WorkflowStatus, workflowCard, workflowInput } from '../../components/CourseValidationForms'
import { useWorkflowAction, useWorkflowData } from '../../hooks/useCourseValidation'
import { accountLabels, downloadReviewImage, reviewDate, workflowApi } from '../../utils/courseValidationApi'

export default function AdminValidators() {
  const token = localStorage.getItem('adminToken')
  const list = useWorkflowData('admin/validators', token)
  const [id, setId] = useState(null)
  const [removingId, setRemovingId] = useState(null)
  const application = useWorkflowData(id ? `admin/validators/${id}` : null, token)
  const action = useWorkflowAction()
  const invite = useWorkflowAction()
  const removal = useWorkflowAction()
  const account = application.data
  const accounts = list.data?.accounts || []
  const currentAccounts = accounts.filter(row => row.status !== 'deactivated')
  const removedAccounts = accounts.filter(row => row.status === 'deactivated')
  const send = event => {
    event.preventDefault()
    const form = event.currentTarget
    const email = new FormData(form).get('email')
    invite.run(async () => {
      const result = await workflowApi('admin/validators/invite', { token, body: { email } })
      form.reset()
      list.refresh()
      return result
    })
  }
  const decide = event => {
    event.preventDefault()
    const fields = new FormData(event.currentTarget)
    action.run(async () => {
      if (fields.get('decision') === 'approved' && !fields.getAll('clusters').length) throw new Error('Select at least one approved expertise cluster.')
      await workflowApi(`admin/validators/${id}/decision`, { token, body: {
        decision: fields.get('decision'), remarks: fields.get('remarks'), clusters: fields.getAll('clusters'), credentialId: account.credential_id,
      } })
      application.refresh()
      list.refresh()
      return { message: 'Decision recorded.' }
    })
  }
  const credential = credentialId => action.run(() => downloadReviewImage(`admin/validators/${id}/credentials/${credentialId}`, token, 'validator-credential'))
  const toggleDetails = validatorId => setId(current => current === validatorId ? null : validatorId)
  const remove = (event, row) => {
    event.preventDefault()
    const remarks = new FormData(event.currentTarget).get('remarks')
    removal.run(async () => {
      await workflowApi(`admin/validators/${row.validator_id}/decision`, { token, body: {
        decision: 'deactivated', remarks, credentialId: row.credential_id,
      } })
      setRemovingId(null)
      list.refresh()
      if (id === row.validator_id) application.refresh()
      return { message: `${row.full_name} was removed from course validation.` }
    })
  }

  return <div className="min-h-screen bg-stone-50">
    <AdminHeader currentPage="validators" />
    <main className="mx-auto max-w-6xl space-y-6 px-5 py-10 sm:px-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Validators</h1>
        <p className="text-sm text-slate-600">Invite experts, review applications, and manage access to course assignments.</p>
      </header>
      <section className={`${workflowCard} border-l-4 border-l-orange-500`}>
        <div className="flex items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-orange-50 text-orange-800"><IconMailPlus size={21} aria-hidden="true" /></span>
          <h2 className="text-lg font-semibold text-slate-950">Invite Validator</h2>
        </div>
        <form className="grid max-w-xl gap-3 sm:grid-cols-[1fr_auto] sm:items-end" onSubmit={send}>
          <WorkflowField label="Expert email"><input type="email" name="email" maxLength={254} className={workflowInput} required /></WorkflowField>
          <button className="lm-action lm-action-selected min-h-11" disabled={invite.busy}>Send invitation</button>
        </form>
        <WorkflowFeedback {...invite} />
      </section>
      <WorkflowFeedback {...list} />
      {list.data && <section className={workflowCard}>
        <h2 className="text-lg font-semibold">Applications and accounts</h2>
        <WorkflowFeedback {...removal} />
        {!currentAccounts.length && <p className="text-sm text-gray-600">No current Validator accounts or applications.</p>}
        <ul className="divide-y divide-orange-100">
          {currentAccounts.map(row => <ValidatorRow key={row.validator_id} row={row} selected={id === row.validator_id} onView={() => toggleDetails(row.validator_id)}
            removeAction={removingId !== row.validator_id && <button type="button" className="lm-action lm-action-danger" disabled={removal.busy}
              onClick={() => setRemovingId(row.validator_id)} aria-label={`Remove validator ${row.full_name}`}>Remove validator</button>}>
            {removingId === row.validator_id && <form aria-label={`Remove ${row.full_name}`} className="w-full space-y-3 rounded-xl border border-rose-200 bg-rose-50 p-4" onSubmit={event => remove(event, row)}>
              <h3 className="font-semibold text-rose-950">Remove {row.full_name}?</h3>
              <p className="text-sm text-slate-700">This ends their access and removes them from the assignment list. Past reviews stay in the record. Any open reviews can be reassigned.</p>
              <WorkflowField label="Reason for removal"><textarea name="remarks" className={workflowInput} rows={2} maxLength={2500} required autoFocus /></WorkflowField>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="lm-action" disabled={removal.busy} onClick={() => setRemovingId(null)}>Cancel</button>
                <button className="lm-action lm-action-danger" disabled={removal.busy}>Confirm removal</button>
              </div>
            </form>}
          </ValidatorRow>)}
        </ul>
        {!!removedAccounts.length && <details className="rounded-xl border border-stone-200 bg-stone-50 p-4">
          <summary className="cursor-pointer font-semibold">Removed validators ({removedAccounts.length})</summary>
          <ul className="mt-2 divide-y divide-stone-200">
            {removedAccounts.map(row => <ValidatorRow key={row.validator_id} row={row} selected={id === row.validator_id} onView={() => toggleDetails(row.validator_id)} />)}
          </ul>
        </details>}
      </section>}
      {id && <section className={workflowCard} aria-label="Selected application">
        <h2 className="text-lg font-semibold">{account?.full_name || 'Application'}</h2>
        <WorkflowFeedback loading={application.loading} busy={action.busy} error={application.error || action.error} message={action.message} />
        {account && <>
          <div className="flex flex-wrap items-center gap-2"><WorkflowStatus status={account.status}>{accountLabels[account.status]}</WorkflowStatus><p className="break-all text-sm text-slate-600">{account.email}</p></div>
          <dl className="grid gap-4 rounded-xl border border-stone-200 bg-stone-50 p-4 text-sm sm:grid-cols-2">
            {[['Profession', account.profession], ['Affiliation', account.affiliation], ['Field of expertise', account.expertise],
              ['Requested clusters', account.requested_clusters.join(' · ')], ['Approved clusters', account.approved_clusters.join(' · ') || 'None'],
              ['Email verified', reviewDate(account.verified_at) || 'Awaiting verification']].map(([label, value]) => <div key={label}><dt className="font-semibold">{label}</dt><dd className="whitespace-pre-wrap">{value}</dd></div>)}
          </dl>
          <button className="lm-action" type="button" disabled={action.busy} onClick={() => credential(account.credential_id)}>Download private credential</button>
          {account.status === 'pending' && <ApplicationDecision key={`${account.validator_id}:${account.credential_id}`} account={account} busy={action.busy} onSubmit={decide} />}
          {!!account.assignments?.length && <details className="text-sm">
            <summary className="cursor-pointer font-semibold">Assignments</summary>
            <ul className="mt-2 divide-y divide-orange-100">
              {account.assignments.map(row => <li key={row.assignment_id} className="py-2">
                {row.cluster_category} · {row.approved}/{row.total} validated · {row.pending} awaiting review · {reviewDate(row.created_at)}
              </li>)}
            </ul>
          </details>}
          {!!account.decisions.length && <section className="space-y-2">
            <h3 className="font-semibold">Decision history</h3>
            {account.decisions.map(row => <article key={row.decision_id} className="rounded-xl bg-orange-50 p-3 text-sm">
              <p className="font-semibold">{accountLabels[row.status]} · {reviewDate(row.decided_at)}</p>
              <p className="whitespace-pre-wrap">{row.remarks}</p>
              {!!row.approved_clusters?.length && <p>{row.approved_clusters.join(' · ')}</p>}
              {row.credential_id !== account.credential_id && <button className="underline" onClick={() => credential(row.credential_id)}>Download credential reviewed</button>}
            </article>)}
          </section>}
        </>}
      </section>}
      {list.data && <section className={workflowCard}>
        <h2 className="text-lg font-semibold">Invitations</h2>
        {!list.data.invitations.length && <p className="text-sm text-gray-600">No invitations yet.</p>}
        <ul className="divide-y divide-orange-100 text-sm">
          {list.data.invitations.map(row => <li key={row.email} className="space-y-1.5 py-3">
            <div className="flex flex-wrap items-center gap-2"><strong className="min-w-0 break-all">{row.email}</strong><WorkflowStatus status={row.status}><span className="capitalize">{row.status}</span></WorkflowStatus></div>
            <p className="text-xs text-slate-600">Issued {reviewDate(row.created_at)} · Expires {reviewDate(row.expires_at)}</p>
          </li>)}
        </ul>
      </section>}
    </main>
  </div>
}

function ValidatorRow({ row, selected, onView, removeAction, children }) {
  return <li className="flex flex-wrap items-center justify-between gap-3 py-4">
    <div className="min-w-0 space-y-1.5">
      <p className="break-words font-semibold text-slate-950">{row.full_name}</p>
      <p className="break-all text-sm text-slate-600">{row.email}</p>
      <div className="flex flex-wrap items-center gap-2"><WorkflowStatus status={row.status}>{accountLabels[row.status]}</WorkflowStatus><span className="text-xs text-slate-600">{row.assignments} assignments</span></div>
      {!!row.approved_clusters.length && <p className="text-xs text-slate-600">{row.approved_clusters.join(' · ')}</p>}
    </div>
    <div className="flex flex-wrap gap-2">
      <button type="button" className="lm-action" aria-expanded={selected} onClick={onView}>View {row.full_name}</button>
      {removeAction}
    </div>
    {children}
  </li>
}

function ApplicationDecision({ account, busy, onSubmit }) {
  const [decision, setDecision] = useState('')
  const requiresFeedback = ['correction', 'rejected'].includes(decision)
  return <form className="space-y-4 rounded-xl border border-stone-200 p-4 sm:p-5" onSubmit={onSubmit}>
    <WorkflowField label="Application decision"><select className={workflowInput} name="decision" required value={decision} onChange={event => setDecision(event.target.value)}>
      <option value="" disabled>Choose a decision</option>
      <option value="approved">Approve</option><option value="correction">Request corrected evidence</option><option value="rejected">Reject</option>
    </select></WorkflowField>
    {decision === 'approved' && <ClusterChoices clusters={account.requested_clusters} defaults={account.requested_clusters} />}
    <WorkflowField label="Feedback"><textarea name="remarks" className={workflowInput} maxLength={2500} rows={3} required={requiresFeedback} /><span>Required when requesting corrections or rejecting an application.</span></WorkflowField>
    <button className="lm-action lm-action-selected" disabled={busy}>Record decision</button>
  </form>
}
