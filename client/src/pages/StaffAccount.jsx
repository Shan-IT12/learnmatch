import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { IconArrowRight } from '@tabler/icons-react'
import { PRIVACY_NOTICE_VERSION, TERMS_VERSION } from '../../../shared/legalDocuments.js'
import StaffAccessLayout from '../components/StaffAccessLayout'
import { ClusterChoices, CredentialInput, PasswordFields, RequiredFieldsNote, WorkflowCheck, WorkflowFeedback, WorkflowField, WorkflowStatus, workflowInput } from '../components/CourseValidationForms'
import { useWorkflowAction, useWorkflowData } from '../hooks/useCourseValidation'
import { accountLabels, reviewFile, workflowApi } from '../utils/courseValidationApi'

const approvalKey = 'learnmatch:validator-approval'
const approvalMessages = {
  pending: 'Your email is verified. This page will take you to sign-in once an Administrator approves your application.',
  correction: 'An Administrator requested corrections. Sign in to see what to update.',
  rejected: 'Your application was declined. Sign in to see the decision or contact an Administrator.',
  deactivated: 'Your account is inactive. Contact an Administrator for help.',
}

function readApprovalToken() {
  try { return sessionStorage.getItem(approvalKey) }
  catch { return null }
}

function saveApprovalToken(token) {
  try {
    if (token) sessionStorage.setItem(approvalKey, token)
    else sessionStorage.removeItem(approvalKey)
  } catch { /* The open page can still follow approval when storage is unavailable. */ }
}

const titles = {
  login: 'Validator sign-in', forgot: 'Forgot password', reset: 'Set a new password',
  setup: 'Set up Administrator access', invite: 'Accept Validator invitation', verify: 'Verify your email', resend: 'Resend verification email',
}
const descriptions = {
  login: 'Sign in to review assigned courses or check your application status.',
  forgot: 'Enter your account email to request a password reset link.',
  reset: 'Choose a new password for your LearnMatch account.',
  setup: 'Set a password to finish linking your Administrator email.',
  verify: 'Confirm your email so an Administrator can review your application.',
  resend: 'Enter the email you used to apply for Course Validator access.',
}

const PROFESSION_OPTIONS = [
  'Registered Guidance Counselor (RGC)',
  'College Professor / Instructor',
  'Program Chair / Department Head',
  'Dean / Academic Director',
  'Curriculum Specialist',
  'Licensed Professional Teacher (LPT)',
  'Industry Practitioner / Subject-Matter Expert',
  'Career Advisor / Academic Coach',
]

const EXPERTISE_OPTIONS = [
  'Engineering, Computing & Technology',
  'Healthcare & Allied Sciences',
  'Business, Accountancy & Management',
  'Education & Teacher Training',
  'Guidance & Career Counseling',
  'Humanities, Psychology & Social Sciences',
  'Arts, Design & Multimedia',
  'Hospitality & Tourism Management',
  'Criminology & Law Enforcement',
  'Legal & Public Service',
  'Science & Mathematics',
  'Agriculture & Environmental Science',
  'Aviation & Maritime',
  'Sports & Physical Education',
]

export default function StaffAccount({ role, initialAction }) {
  const { action: pathAction } = useParams()
  const action = initialAction || pathAction
  return <StaffAccountForm key={`${role}:${action}`} role={role} action={action} />
}

function StaffAccountForm({ role, action }) {
  const isVerification = role === 'validator' && action === 'verify'
  const [raw] = useState(() => {
    const fromHash = window.location.hash.slice(1)
    if (fromHash) return fromHash
    return new URLSearchParams(window.location.search).get('token') || ''
  })
  const [approvalToken, setApprovalToken] = useState(() => isVerification && !raw ? readApprovalToken() : null)
  const [invitation, setInvitation] = useState(null)
  const [inviteError, setInviteError] = useState('')
  const [loadingInvite, setLoadingInvite] = useState(() => role === 'validator' && action === 'invite' && Boolean(raw))
  const [completed, setCompleted] = useState(false)
  const [clusterError, setClusterError] = useState('')
  const [professionChoice, setProfessionChoice] = useState('')
  const [expertiseChoice, setExpertiseChoice] = useState('')
  const form = useWorkflowAction()
  const navigate = useNavigate()
  const { state } = useLocation()
  const login = `/${role}/login`
  const account = `/${role}/account`
  const path = role === 'admin' ? 'admin/account' : 'validator'
  useEffect(() => {
    if (raw && !isVerification) window.history.replaceState(window.history.state, '', window.location.pathname)
  }, [raw, isVerification])
  useEffect(() => {
    if (role !== 'validator' || action !== 'invite' || !raw) return
    let cancelled = false
    workflowApi('validator/invite', { body: { token: raw } })
      .then((result) => { if (!cancelled) setInvitation(result) })
      .catch((error) => { if (!cancelled) setInviteError(error?.message || 'This invitation link is invalid or expired.') })
      .finally(() => { if (!cancelled) setLoadingInvite(false) })
    return () => { cancelled = true }
  }, [role, action, raw])

  const submit = (event) => {
    event.preventDefault()
    const applicationForm = event.currentTarget
    const fields = new FormData(applicationForm)
    if (action === 'invite' && invitation && !fields.getAll('clusters').length) {
      setClusterError('Select at least one expertise cluster.')
      applicationForm.querySelector('[name="clusters"]')?.focus()
      return
    }
    form.run(async () => {
      const data = Object.fromEntries(fields)
      if (action === 'login') {
        const result = await workflowApi('validator/login', { body: data })
        localStorage.setItem('validatorToken', result.token)
        navigate('/validator')
        return
      }
      if (action === 'invite' && !invitation) {
        setInvitation(await workflowApi('validator/invite', { body: { token: raw } }))
        return
      }
      const formatMiddleInitial = (value) => {
        const clean = String(value || '').trim().replace(/\.+$/u, '')
        return clean ? `${clean.toUpperCase()}.` : ''
      }
      const composedFullName = action === 'invite'
        ? [String(data.firstName || '').trim(), formatMiddleInitial(data.middleInitial), String(data.lastName || '').trim()].filter(Boolean).join(' ')
        : data.fullName
      const resolvedProfession = professionChoice === '__other__' ? String(data.professionOther || '').trim() : professionChoice
      const resolvedExpertise = expertiseChoice === '__other__' ? String(data.expertiseOther || '').trim() : expertiseChoice
      const body = action === 'invite' ? {
        ...data,
        fullName: composedFullName,
        profession: resolvedProfession || data.profession,
        expertise: resolvedExpertise || data.expertise,
        email: invitation.email,
        clusters: fields.getAll('clusters'),
        credential: await reviewFile(fields.get('credential')),
        accepted: fields.has('accepted'),
        termsVersion: TERMS_VERSION,
        privacyVersion: PRIVACY_NOTICE_VERSION,
        token: raw,
      } : { ...data, token: raw }
      const result = await workflowApi(`${path}/${action === 'invite' ? 'register' : action}`, { body })
      if (isVerification && result.approvalToken) {
        saveApprovalToken(result.approvalToken)
        setApprovalToken(result.approvalToken)
        if (window.location.hash.slice(1) === raw) {
          window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search)
        }
      }
      setCompleted(true)
      return result
    })
  }

  const allowed = role === 'admin' ? ['setup','forgot','reset'] : ['login','forgot','reset','invite','verify','resend']
  const usesLink = ['setup','reset','invite','verify'].includes(action)
  if (isVerification && !raw && !approvalToken) return <Navigate to={login} replace />
  const missing = !allowed.includes(action) || (usesLink && !raw)
  const waitingForApproval = isVerification && Boolean(approvalToken)
  const registering = action === 'invite' && invitation && !completed
  const description = action === 'invite'
    ? registering ? 'Tell us about your expertise and provide one supporting credential.' : 'Open your application to confirm the invited email and apply to review LearnMatch courses.'
    : descriptions[action]
  const submitLabel = {
    login: 'Sign in', invite: registering ? 'Submit application' : 'Open application',
    verify: 'Verify email', forgot: 'Send reset link', resend: 'Resend verification email',
    reset: 'Save password', setup: 'Finish setup',
  }[action]
  const footer = <>
    {action === 'login' ? <Link to={`${account}/forgot`}>Forgot password?</Link> : <Link to={login}>Back to sign-in</Link>}
    {role === 'validator' && !waitingForApproval && (['login','verify'].includes(action) || (action === 'invite' && completed)) && <Link to={`${account}/resend`}>Resend verification email</Link>}
    <Link to="/help#contact-support">Contact Admin</Link>
  </>
  return <StaffAccessLayout role={role} wide={Boolean(registering)} title={waitingForApproval ? 'Application status' : registering ? 'Validator application' : titles[action] || 'Account access'}
    description={!waitingForApproval && !missing && !completed ? description : undefined} footer={footer}>
        {waitingForApproval ? <ApprovalStatus token={approvalToken} /> : <WorkflowFeedback loading={loadingInvite} busy={form.busy} error={missing ? 'Open the invitation link shared by your LearnMatch Administrator to continue.' : (inviteError || form.error)} message={form.message || (action === 'login' ? state?.approvalMessage : undefined)} />}
        {!waitingForApproval && !completed && !missing && !loadingInvite && !inviteError && <form className="space-y-5" onSubmit={submit}>
          {(!usesLink || registering || ['reset','setup'].includes(action)) && <RequiredFieldsNote />}
          {['login','forgot','resend'].includes(action) && <WorkflowField label="Email"><input type="email" name="email" required autoComplete="email" maxLength={254} className={workflowInput} /></WorkflowField>}
          {action === 'login' && <WorkflowField label="Password"><input type="password" name="password" required autoComplete="current-password" className={workflowInput} /></WorkflowField>}
          {['reset','setup'].includes(action) && <PasswordFields />}
          {registering && <>
            <div className="rounded-xl border border-orange-100 bg-orange-50/60 p-3.5">
              <p className="text-xs font-semibold text-orange-900">Invited email</p>
              <p className="mt-1 break-all text-sm font-medium text-slate-900">{invitation.email}</p>
            </div>
            <section aria-labelledby="application-details" className="space-y-3">
              <h2 id="application-details" className="font-semibold text-slate-950">Professional details</h2>
              <div className="grid gap-4 sm:grid-cols-[1fr_1fr_7rem]">
                <WorkflowField label="Last name"><input name="lastName" autoComplete="family-name" maxLength={60} required className={workflowInput} /></WorkflowField>
                <WorkflowField label="First name"><input name="firstName" autoComplete="given-name" maxLength={60} required className={workflowInput} /></WorkflowField>
                <WorkflowField label="M.I." required={false}><input name="middleInitial" autoComplete="additional-name" maxLength={5} placeholder="Optional" className={workflowInput} /></WorkflowField>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <WorkflowField label="Profession">
                  <select
                    name="profession"
                    value={professionChoice}
                    onChange={(event) => setProfessionChoice(event.target.value)}
                    required
                    className={workflowInput}
                  >
                    <option value="">Select profession…</option>
                    {PROFESSION_OPTIONS.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                    <option value="__other__">Other (specify)</option>
                  </select>
                  {professionChoice === '__other__' && (
                    <input
                      name="professionOther"
                      maxLength={150}
                      required
                      placeholder="Enter your profession or title"
                      className={`mt-2 ${workflowInput}`}
                    />
                  )}
                </WorkflowField>
                <WorkflowField label="Affiliation">
                  <input
                    name="affiliation"
                    autoComplete="organization"
                    maxLength={255}
                    required
                    placeholder="e.g. Bulacan State University or Organization"
                    className={workflowInput}
                  />
                  <span>Institution, company, or independent affiliation.</span>
                </WorkflowField>
                <div className="sm:col-span-2">
                  <WorkflowField label="Field of expertise">
                    <select
                      name="expertise"
                      value={expertiseChoice}
                      onChange={(event) => setExpertiseChoice(event.target.value)}
                      required
                      className={workflowInput}
                    >
                      <option value="">Select field of expertise…</option>
                      {EXPERTISE_OPTIONS.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                      <option value="__other__">Other (specify)</option>
                    </select>
                    {expertiseChoice === '__other__' && (
                      <input
                        name="expertiseOther"
                        maxLength={500}
                        required
                        placeholder="Specify your field of expertise"
                        className={`mt-2 ${workflowInput}`}
                      />
                    )}
                  </WorkflowField>
                </div>
              </div>
            </section>
            <ClusterChoices clusters={invitation.clusters} error={clusterError} onChange={() => setClusterError('')} />
            <div className="space-y-4 border-t border-stone-200 pt-5">
              <CredentialInput />
              <PasswordFields />
              <WorkflowCheck name="accepted">I accept the <Link className="font-semibold text-orange-900 underline" to="/terms" target="_blank" rel="noopener">Terms &amp; Conditions</Link> and acknowledge the <Link className="font-semibold text-orange-900 underline" to="/privacy" target="_blank" rel="noopener">Privacy Notice</Link>. LearnMatch stores my credential privately for Administrator review and retains signed validation records with my name and qualifications.</WorkflowCheck>
            </div>
          </>}
          <button className="lm-action lm-action-selected min-h-11 w-full sm:w-auto" disabled={form.busy}>{submitLabel}<IconArrowRight size={17} aria-hidden="true" /></button>
        </form>}
  </StaffAccessLayout>
}

function ApprovalStatus({ token }) {
  const navigate = useNavigate()
  const approval = useWorkflowData('validator/approval-status', token)
  const status = approval.data?.status
  const expired = approval.error?.status === 401
  useEffect(() => {
    if (status !== 'approved' && !expired) return
    saveApprovalToken(null)
    const approvalMessage = expired ? 'Sign in to check the status of your application.' : 'Your Validator account is approved. You can sign in now.'
    navigate('/validator/login', { replace: true, state: { approvalMessage } })
  }, [expired, navigate, status])

  return <div className="space-y-3" role="status">
    {status ? <>
      <WorkflowStatus status={status}>{accountLabels[status]}</WorkflowStatus>
      <p className="text-sm leading-6 text-slate-700">{approvalMessages[status]}</p>
    </> : <p className="text-sm text-slate-700">Email verified. Checking your application status…</p>}
    {approval.error && !expired && <p className="text-sm text-amber-900">Couldn’t check the latest status. We’ll try again shortly.</p>}
  </div>
}
