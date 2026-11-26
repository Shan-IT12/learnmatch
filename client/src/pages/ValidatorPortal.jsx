import { useRef, useState } from 'react'
import { Link, NavLink, Navigate, useNavigate, useParams } from 'react-router-dom'
import { IconArrowLeft, IconChevronDown, IconChevronRight, IconClipboardCheck, IconPencil } from '@tabler/icons-react'
import CourseValidationSnapshot from '../components/CourseValidationSnapshot'
import HeaderBrand from '../components/HeaderBrand'
import { CredentialInput, WorkflowCheck, WorkflowFeedback, WorkflowField, WorkflowStatus, workflowCard, workflowFile, workflowInput } from '../components/CourseValidationForms'
import { RequiredMark } from '../components/FormValidation'
import { useWorkflowAction, useWorkflowData } from '../hooks/useCourseValidation'
import { accountLabels, downloadReviewImage, reviewDate, reviewFile, validationLabels, workflowApi } from '../utils/courseValidationApi'

export default function ValidatorPortal() {
  const token = localStorage.getItem('validatorToken')
  const { assignmentId, section } = useParams()
  const navigate = useNavigate()
  const profile = useWorkflowData(token ? 'validator/profile' : null, token)
  const logout = () => {
    localStorage.removeItem('validatorToken')
    navigate('/validator/login', { replace: true })
  }

  if (!token || profile.error?.status === 401) return <Navigate to="/validator/login" replace />
  const account = profile.data
  const navAction = (active) => `lm-action ${active ? 'lm-action-selected' : ''}`
  return <div className="min-h-screen bg-stone-50">
    <header className="lm-site-header border-b border-orange-100 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-4">
        <Link className="flex flex-wrap items-center gap-2" to="/validator" aria-label="LearnMatch Validator portal"><HeaderBrand /><span className="rounded-md bg-orange-50 px-2 py-1 text-xs font-semibold text-orange-900">Course Validator</span></Link>
        <nav className="flex flex-wrap gap-2" aria-label="Validator navigation">
          {account?.status === 'approved' && <NavLink end className={({ isActive }) => navAction(isActive || Boolean(assignmentId))} to="/validator">My Reviews</NavLink>}
          <NavLink className={({ isActive }) => navAction(isActive)} to="/validator/profile">Profile</NavLink>
          <NavLink className={({ isActive }) => navAction(isActive)} to="/validator/help">Help / Contact Admin</NavLink>
          <button className="lm-action lm-action-danger" type="button" onClick={logout}>Logout</button>
        </nav>
      </div>
    </header>
    <main className="mx-auto max-w-6xl space-y-6 px-5 py-10 sm:px-8">
      <WorkflowFeedback {...profile} />
      {section === 'help' ? <section className={`${workflowCard} mx-auto w-full max-w-3xl text-sm leading-6 text-slate-700`}>
        <h1 className="text-2xl font-bold">Help / Contact Admin</h1>
        <p>Open an assignment in My Reviews, check the saved course content and references, and enter remarks for each decision. Review your selected approvals before signing.</p>
        <p>For questions about an assignment or your application, <Link className="underline" to="/help#contact-support">contact the LearnMatch team</Link>.</p>
      </section> : account && (section === 'profile' || account.status !== 'approved' ?
        <ValidatorProfile account={account} token={token} refresh={profile.refresh} /> :
        assignmentId ? <Assignment key={assignmentId} token={token} id={assignmentId} /> : <AssignmentList token={token} />)}
    </main>
  </div>
}

function ValidatorProfile({ account, token, refresh }) {
  const action = useWorkflowAction()
  const publicAction = useWorkflowAction()
  const [publicProfession, setPublicProfession] = useState(account.profession || '')
  const [publicSignature, setPublicSignature] = useState('')
  const [signatureFileName, setSignatureFileName] = useState('')
  const submit = event => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    action.run(async () => {
      await workflowApi('validator/profile/credential', { token, body: { credential: await reviewFile(form.get('credential')) } })
      refresh()
      return { message: 'Corrected credential submitted.' }
    })
  }
  const handleSignatureFile = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!['image/png', 'image/svg+xml'].includes(file.type)) return
    if (file.size > 500 * 1024) return
    const reader = new FileReader()
    reader.onload = () => {
      setPublicSignature(String(reader.result || ''))
      setSignatureFileName(file.name)
    }
    reader.readAsDataURL(file)
  }
  const savePublicProfile = (event) => {
    event.preventDefault()
    publicAction.run(async () => {
      const body = { profession: publicProfession }
      if (publicSignature) body.signature = publicSignature
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/validator/profile/public`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.message || 'Could not update public display profile.')
      refresh()
      setSignatureFileName('')
      return { message: 'Public Landing Page profile updated.' }
    })
  }
  return <section className={workflowCard}>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Profile and application</h1>
      <WorkflowStatus status={account.status}>{accountLabels[account.status]}</WorkflowStatus>
    </div>
    <dl className="grid gap-4 rounded-xl border border-stone-200 bg-stone-50 p-4 text-sm sm:grid-cols-2">
      {[['Full name', account.full_name], ['Email', account.email], ['Profession', account.profession], ['Affiliation', account.affiliation],
        ['Field of expertise', account.expertise], ['Requested clusters', account.requested_clusters.join(' · ')],
        ['Approved clusters', account.approved_clusters.join(' · ') || 'None']].map(([label, value]) =>
        <div key={label} className="min-w-0"><dt className="font-semibold text-slate-900">{label}</dt><dd className="mt-1 break-words text-slate-700">{value}</dd></div>)}
    </dl>
    <button className="lm-action" type="button" onClick={() => action.run(() => downloadReviewImage(`validator/profile/credentials/${account.credential_id}`, token, 'my-credential'))}>Download my credential</button>
    {account.status === 'approved' && (
      <form onSubmit={savePublicProfile} className="space-y-3 rounded-xl border border-orange-100 bg-orange-50/40 p-4">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Public Validator Attribution (Landing Page)</h2>
          <p className="mt-0.5 text-xs text-slate-600">Only your name, profession/title, and optional signature appear in the Landing Page “Validated by:” marquee. Your email and credentials remain private.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <WorkflowField label="Display Profession / Title">
            <input value={publicProfession} onChange={(e) => setPublicProfession(e.target.value)} maxLength={150} className={workflowInput} required />
          </WorkflowField>
          <WorkflowField label="Public Signature (PNG or SVG, max 500 KB)">
            <input type="file" accept="image/png,image/svg+xml" onChange={handleSignatureFile} className={workflowFile} />
            {signatureFileName && <p className="mt-1 text-xs text-emerald-700">Selected: {signatureFileName}</p>}
          </WorkflowField>
        </div>
        <WorkflowFeedback {...publicAction} />
        <button type="submit" disabled={publicAction.busy} className="lm-action lm-action-selected">
          {publicAction.busy ? 'Saving…' : 'Save Public Attribution'}
        </button>
      </form>
    )}
    {!!account.decisions.length && <section className="space-y-2">
      <h2 className="font-semibold">Application decisions</h2>
      {account.decisions.map(row => <article key={row.decision_id} className="rounded-xl bg-orange-50 p-3 text-sm">
        <div className="flex flex-wrap items-center gap-2"><WorkflowStatus status={row.status}>{accountLabels[row.status]}</WorkflowStatus><span className="text-xs text-slate-600">{reviewDate(row.decided_at)}</span></div>
        {row.remarks && <p className="mt-2 whitespace-pre-wrap">{row.remarks}</p>}
      </article>)}
    </section>}
    <WorkflowFeedback {...action} />
    {account.status === 'correction' && <form className="space-y-3" onSubmit={submit}>
      <CredentialInput />
      <button className="lm-action lm-action-selected" disabled={action.busy}>Submit corrected evidence</button>
    </form>}
  </section>
}

function AssignmentList({ token }) {
  const reviews = useWorkflowData('validator/reviews', token)
  return <section className={workflowCard}>
    <div className="flex items-center gap-3">
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-orange-50 text-orange-900"><IconClipboardCheck size={23} aria-hidden="true" /></span>
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">My Reviews</h1>
    </div>
    <WorkflowFeedback {...reviews} />
    {reviews.data?.assignments.length === 0 && <p className="rounded-xl border border-dashed border-stone-300 bg-stone-50 p-5 text-sm text-slate-600">No reviews have been assigned yet.</p>}
    <ul className="grid gap-3 sm:grid-cols-2">
      {reviews.data?.assignments.map(row => <li key={row.assignment_id} className="min-w-0">
        <Link className="flex h-full items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white p-4 transition hover:border-orange-300 hover:bg-orange-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600" to={`/validator/reviews/${row.assignment_id}`}>
          <div className="min-w-0 space-y-1">
            <p className="break-words font-semibold text-slate-950">{row.assignment_type === 'cluster' ? row.cluster_category : row.items[0]?.course_name}</p>
            <p className="text-sm text-slate-700">{row.items.filter(item => item.decision === 'approved').length}/{row.items.length} validated · {row.items.filter(item => item.decision === 'pending').length} awaiting review</p>
            <p className="text-xs text-slate-600">{reviewDate(row.created_at)}</p>
          </div>
          <IconChevronRight size={20} className="shrink-0 text-orange-800" aria-hidden="true" />
        </Link>
      </li>)}
    </ul>
  </section>
}

function Assignment({ token, id }) {
  const data = useWorkflowData(`validator/reviews/${id}`, token)
  return <div className="space-y-4">
    <Link className="lm-action" to="/validator"><IconArrowLeft size={16} aria-hidden="true" />Back to My Reviews</Link>
    <WorkflowFeedback {...data} />
    {data.data && <ReviewForm assignment={data.data} id={id} token={token} refresh={data.refresh} />}
  </div>
}

function ReviewForm({ assignment, id, token, refresh }) {
  const [draft, setDraft] = useState({})
  const [confirmation, setConfirmation] = useState(null)
  const [method, setMethod] = useState('typed')
  const [drawn, setDrawn] = useState('')
  const action = useWorkflowAction()
  const decisions = assignment.items.filter(item => item.decision === 'pending' && draft[item.item_id]?.decision)
  const approved = confirmation?.filter(item => draft[item.item_id].decision === 'approved') || []
  const confirmationIsStale = confirmation?.some(item => !decisions.some(current =>
    current.item_id === item.item_id && current.version_token === item.version_token))
  const change = (itemId, patch) => setDraft(values => ({ ...values, [itemId]: { ...values[itemId], ...patch } }))
  const submit = event => {
    event.preventDefault()
    if (!confirmation || confirmationIsStale) return
    const fields = new FormData(event.currentTarget)
    action.run(async () => {
      const body = { decisions: confirmation.map(item => ({
        itemId: item.item_id, version: item.version_token, ...draft[item.item_id],
      })) }
      if (approved.length) body.signature = {
        method, confirmed: fields.has('confirmed'), itemIds: approved.map(item => item.item_id),
        ...(method === 'typed' ? { name: fields.get('signatureName') } :
          { image: method === 'drawn' ? drawn : await reviewFile(fields.get('signatureImage')) }),
      }
      await workflowApi(`validator/reviews/${id}`, { token, body })
      const submittedIds = new Set(confirmation.map(item => String(item.item_id)))
      setDraft(previous => Object.fromEntries(Object.entries(previous).filter(([id]) => !submittedIds.has(id))))
      setConfirmation(null)
      setDrawn('')
      refresh()
      return { message: 'Decisions recorded.' }
    })
  }

  return <section className={workflowCard}>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="min-w-0 break-words text-2xl font-bold tracking-tight sm:text-3xl">{assignment.assignment_type === 'cluster' ? assignment.cluster_category : assignment.items[0]?.version_snapshot.course_name}</h1>
      <button type="button" className="lm-action" disabled={action.busy} onClick={refresh}>Reload saved review</button>
    </div>
    <WorkflowFeedback {...action} />
    <form className="space-y-4" onSubmit={confirmation ? submit : event => { event.preventDefault(); if (decisions.length) setConfirmation(decisions) }}>
      <div className="space-y-3">
        {assignment.items.map(item => <details key={item.item_id} open={assignment.items.length === 1 || undefined} className="group rounded-xl border border-stone-200 bg-stone-50/60 p-4 sm:p-5">
          <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 font-semibold text-slate-950 focus-visible:outline-2 focus-visible:outline-orange-600 [&::-webkit-details-marker]:hidden">
            <IconChevronDown size={17} className="shrink-0 -rotate-90 text-orange-900 transition-transform group-open:rotate-0" aria-hidden="true" />
            <span className="min-w-0 break-words">{item.version_snapshot.course_name}</span>
            <WorkflowStatus status={item.decision === 'pending' ? 'under_review' : item.decision}>{item.decision === 'pending' ? 'Under Review' : validationLabels[item.decision]}</WorkflowStatus>
          </summary>
          <CourseValidationSnapshot snapshot={item.version_snapshot} />
          {item.remarks && <p className="mt-3 whitespace-pre-wrap text-sm"><strong>Recorded remarks</strong> · {reviewDate(item.decided_at)}<br />{item.remarks}</p>}
          {item.signature_method && <p className="mt-1 text-sm">Signed {reviewDate(item.confirmed_at)} · {item.signature_method === 'typed' ? item.typed_name : item.signature_method}</p>}
          {item.signature_id && item.signature_method !== 'typed' && <button type="button" className="mt-1 underline" onClick={() => action.run(() => downloadReviewImage(`validator/signatures/${item.signature_id}`, token, 'validation-signature'))}>Download my signature</button>}
          {item.decision === 'pending' && <fieldset disabled={Boolean(confirmation)} className="mt-5 min-w-0 space-y-3 rounded-xl border border-stone-200 bg-white p-4">
            <legend className="px-1 text-sm font-semibold text-slate-900">Course decision</legend>
            <WorkflowField label="Decision"><select className={workflowInput} value={draft[item.item_id]?.decision || ''} onChange={event => change(item.item_id, { decision: event.target.value })}>
              <option value="">Decide later</option><option value="approved">Approve</option><option value="needs_changes">Request Changes</option>
            </select></WorkflowField>
            <WorkflowField label="Remarks"><textarea className={workflowInput} maxLength={5000} rows={3} required={Boolean(draft[item.item_id]?.decision)} value={draft[item.item_id]?.remarks || ''} onChange={event => change(item.item_id, { remarks: event.target.value })} /></WorkflowField>
          </fieldset>}
        </details>)}
      </div>
      {!!assignment.history?.length && <details className="space-y-2 text-sm">
        <summary className="cursor-pointer font-semibold">Previous review remarks</summary>
        {assignment.history.map((item, index) => <p key={`${item.item_id}-${index}`} className="whitespace-pre-wrap rounded-lg bg-orange-50 p-3">
          {item.course_name || `Course #${item.course_id}`} · {reviewDate(item.decided_at)} · {validationLabels[item.decision]}<br />{item.remarks}
        </p>)}
      </details>}
      {!confirmation && decisions.length > 0 && <button className="lm-action lm-action-selected">Review selected decisions</button>}
      {confirmation && <section className="space-y-4 rounded-xl border border-orange-200 bg-orange-50/45 p-4 sm:p-5">
        <h2 className="text-lg font-semibold text-slate-950">Confirm selected decisions</h2>
        <ul className="divide-y divide-stone-200 rounded-xl border border-stone-200 bg-white px-4 text-sm">
          {confirmation.map(item => <li className="flex flex-wrap items-center justify-between gap-2 py-3" key={item.item_id}><span className="min-w-0 break-words">{item.version_snapshot.course_name} ({item.version_snapshot.course_code})</span><WorkflowStatus status={draft[item.item_id].decision}>{draft[item.item_id].decision === 'approved' ? 'Approve and sign' : 'Request Changes'}</WorkflowStatus></li>)}
        </ul>
        {confirmationIsStale && <p role="alert" className="text-sm font-medium text-amber-950">A selected review changed. Edit your decisions and confirm the current selection.</p>}
        {approved.length > 0 && <>
          <WorkflowField label="Signature method"><select className={workflowInput} required value={method} onChange={event => { setMethod(event.target.value); setDrawn('') }}>
            <option value="typed">Type my full name</option><option value="drawn">Draw my signature</option><option value="uploaded">Upload my signature</option>
          </select></WorkflowField>
          {method === 'typed' && <WorkflowField label="Full name as shown in your profile"><input name="signatureName" className={workflowInput} maxLength={150} required /></WorkflowField>}
          {method === 'uploaded' && <WorkflowField label="Signature PNG or JPG (up to 10 MB)"><input name="signatureImage" type="file" accept="image/png,image/jpeg,.png,.jpg,.jpeg" className={workflowFile} required /></WorkflowField>}
          {method === 'drawn' && <SignatureCanvas onDraw={setDrawn} />}
          <WorkflowCheck name="confirmed">I personally reviewed and approve the exact saved course versions marked Approve and sign above. Apply this signature to those approvals.</WorkflowCheck>
        </>}
        <div className="flex flex-wrap gap-3">
          <button type="button" className="lm-action" disabled={action.busy} onClick={() => { setDrawn(''); setConfirmation(null) }}>Edit decisions</button>
          <button className="lm-action lm-action-selected" disabled={action.busy || confirmationIsStale || (approved.length > 0 && method === 'drawn' && !drawn)}>Submit decisions</button>
        </div>
      </section>}
    </form>
  </section>
}

function SignatureCanvas({ onDraw }) {
  const canvas = useRef(null)
  const previous = useRef(null)
  const point = event => {
    const bounds = event.currentTarget.getBoundingClientRect()
    return [(event.clientX - bounds.left) * canvas.current.width / bounds.width, (event.clientY - bounds.top) * canvas.current.height / bounds.height]
  }
  const draw = event => {
    if (!previous.current) return
    const next = point(event)
    const ctx = canvas.current.getContext('2d')
    ctx.beginPath()
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    ctx.moveTo(...previous.current)
    ctx.lineTo(...next)
    ctx.stroke()
    previous.current = next
  }
  const finish = () => {
    if (!previous.current) return
    previous.current = null
    onDraw(canvas.current.toDataURL('image/png').split(',')[1])
  }
  return <div className="space-y-2">
    <p className="flex items-center gap-1.5 text-sm font-semibold"><IconPencil size={16} aria-hidden="true" />Draw your signature <RequiredMark /></p>
    <p className="text-xs text-slate-600">Sign inside the box using your mouse, touchpad, or touchscreen.</p>
    <canvas ref={canvas} width={600} height={180} aria-label="Draw your signature" className="block w-full max-w-xl touch-none rounded-lg border border-gray-400 bg-white"
      onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); previous.current = point(event); draw(event) }}
      onPointerMove={draw} onPointerUp={finish} onPointerCancel={finish} />
    <button className="lm-action" type="button" onClick={() => { canvas.current.getContext('2d').clearRect(0, 0, 600, 180); onDraw('') }}>Clear drawing</button>
  </div>
}
