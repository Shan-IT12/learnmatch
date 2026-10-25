import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { IconArrowLeft, IconArrowRight, IconEye, IconEyeOff, IconKey, IconShieldCheck, IconTrash, IconUser } from '@tabler/icons-react'
import HeaderBrand from '../components/HeaderBrand'
import PrivacyNoticeLink from '../components/PrivacyNoticeLink'
import ActionConfirmationModal from '../components/ActionConfirmationModal'
import { clearUserAuth } from '../utils/userAuth'
import SuccessConfirmation from '../components/SuccessConfirmation'
import SettingsPasswordForm from '../components/SettingsPasswordForm'
import { waitForSuccessConfirmation } from '../utils/successConfirmation'

export default function StudentSettings() {
  const location = useLocation()
  const navigate = useNavigate()
  const token = localStorage.getItem('token')
  const [session, setSession] = useState('checking')
  const [account, setAccount] = useState(null)
  const [changingPassword, setChangingPassword] = useState(false)
  const [lastCodeRequestedAt, setLastCodeRequestedAt] = useState(0)
  const [attempt, setAttempt] = useState(0)
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deletionError, setDeletionError] = useState('')
  const [outcomeUnknown, setOutcomeUnknown] = useState(false)
  const [deletionSucceeded, setDeletionSucceeded] = useState(false)
  const pendingRef = useRef(false)
  const closeDeletion = () => {
    if (pendingRef.current) return
    setShowDeleteConfirmation(false)
    setCurrentPassword('')
    setShowCurrentPassword(false)
    setConfirmed(false)
    setDeletionError('')
  }
  const deleteAccount = async () => {
    if (pendingRef.current || outcomeUnknown || !confirmed || !currentPassword) return
    pendingRef.current = true
    setDeleting(true)
    setDeletionError('')
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/account`, {
        method: 'DELETE',
        signal: AbortSignal.timeout(20000),
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ currentPassword, confirmation: 'DELETE' }),
      })
      const data = await response.json()
      if (response.ok && data.deleted === true) {
        setCurrentPassword('')
        setDeletionSucceeded(true)
        await waitForSuccessConfirmation()
        clearUserAuth(localStorage)
        navigate('/login', { replace: true })
        return
      }
      if (response.ok || data.code === 'DELETION_OUTCOME_UNKNOWN') {
        setOutcomeUnknown(true)
        setDeletionError('We could not confirm the deletion result. Do not submit again yet. Contact the LearnMatch Research Team to verify your account status.')
      } else setDeletionError(data.message || 'Account deletion was not completed. Please try again later.')
    } catch {
      // A lost response does not prove rollback, deletion, or session expiry.
      setOutcomeUnknown(true)
      setDeletionError('We could not confirm the deletion result. Do not submit again yet. Contact the LearnMatch Research Team to verify your account status.')
    } finally {
      setCurrentPassword('')
      setShowCurrentPassword(false)
      setConfirmed(false)
      pendingRef.current = false
      setDeleting(false)
    }
  }
  const returnTo = new URLSearchParams(location.search).get('returnTo')
  const dashboardPath = returnTo === 'college' ? '/college' : returnTo === 'summary' ? '/dashboard/summary' : '/dashboard'

  useEffect(() => {
    if (!token) return undefined
    const controller = new AbortController()
    // Read identity from the authenticated account, never from cached display values.
    fetch(`${import.meta.env.VITE_API_URL || ''}/api/account`, {
      headers: { Authorization: `Bearer ${token}` }, signal: controller.signal,
    }).then(async response => {
      if (controller.signal.aborted) return
      if (response.status === 401 || response.status === 403) setSession('unauthorized')
      else {
        if (!response.ok) throw new Error('Account unavailable')
        const data = await response.json()
        if (controller.signal.aborted) return
        if (typeof data.username !== 'string' || !data.username.trim() || typeof data.email !== 'string' || !data.email.trim()) throw new Error('Account unavailable')
        setAccount({ username: data.username, email: data.email })
        setSession('authenticated')
      }
    }).catch(() => {
      if (!controller.signal.aborted) setSession('error')
    })
    return () => controller.abort()
  }, [token, attempt])

  if (!token || session === 'unauthorized') return <Navigate to="/login" replace />

  return <div className="min-h-screen bg-[#fcfbf9] text-gray-900">
    <nav className="lm-site-header flex items-center justify-between border-b border-gray-200/80 bg-white/90 px-4 py-4 backdrop-blur sm:px-8 lg:px-14">
      <Link to={dashboardPath} className="text-lg font-bold tracking-tight"><HeaderBrand /></Link>
      <Link to={dashboardPath} className="lm-action"><IconArrowLeft size={16} aria-hidden="true" /> Back to Dashboard</Link>
    </nav>
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-8 sm:py-10">
      {session === 'checking' && <p role="status" className="text-sm text-gray-500">Loading Settings...</p>}
      {session === 'error' && <div role="alert" className="rounded-xl border border-red-100 bg-red-50 p-5 text-sm text-red-700">
        <p>We couldn't load your account information. Please try again.</p>
        <button type="button" className="lm-action mt-4" onClick={() => { setSession('checking'); setAttempt(value => value + 1) }}>Try again</button>
      </div>}
      {deletionSucceeded && <SuccessConfirmation message="Your account and its student records have been deleted from the active LearnMatch database." />}
      {session === 'authenticated' && !deletionSucceeded && <>
        <header className="mb-6"><p className="text-xs font-bold uppercase tracking-[0.16em] text-orange-500">Your account</p><h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Settings</h1><p className="mt-2 text-sm text-gray-500">Manage your account, security, and privacy.</p></header>
        <div className="space-y-4">
          <section aria-labelledby="settings-account" className="rounded-2xl border border-gray-200/80 bg-white p-5 shadow-sm sm:p-6">
            <h2 id="settings-account" className="flex items-center gap-2.5 text-lg font-bold"><IconUser size={21} className="text-orange-500" aria-hidden="true" /> Account Information</h2>
            <p className="mt-1.5 text-sm text-gray-500">Your registered account details are read-only.</p>
            <dl className="mt-4 grid gap-4 rounded-xl border border-orange-100 bg-orange-50/40 p-4 sm:grid-cols-2">
              <div className="min-w-0"><dt className="text-xs font-semibold text-gray-500">Username</dt><dd className="mt-1 break-words text-sm font-semibold text-gray-900">{account.username}</dd></div>
              <div className="min-w-0"><dt className="text-xs font-semibold text-gray-500">Registered email</dt><dd className="mt-1 break-all text-sm font-semibold text-gray-900">{account.email}</dd></div>
            </dl>
          </section>
          <section aria-labelledby="settings-password" className="rounded-2xl border border-gray-200/80 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0"><h2 id="settings-password" className="flex items-center gap-2.5 text-lg font-bold"><IconKey size={21} className="shrink-0 text-orange-500" aria-hidden="true" /> Change Password</h2><p className="mt-1 max-w-md text-sm leading-5 text-gray-500">Verify your registered email to set a new password.</p></div>
            {!changingPassword && <button type="button" onClick={() => setChangingPassword(true)} aria-expanded={false} aria-controls="settings-password-form" className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 self-start rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500 sm:self-auto">Change Password <IconArrowRight size={16} aria-hidden="true" /></button>}
            </div>
            {changingPassword && <SettingsPasswordForm email={account.email} lastCodeRequestedAt={lastCodeRequestedAt} onCodeRequested={setLastCodeRequestedAt} onClose={() => setChangingPassword(false)} />}
          </section>
          <section aria-labelledby="settings-privacy" className="rounded-2xl border border-gray-200/80 bg-white p-5 shadow-sm sm:p-6">
            <h2 id="settings-privacy" className="flex items-center gap-2.5 text-lg font-bold"><IconShieldCheck size={21} className="text-orange-500" aria-hidden="true" /> Privacy &amp; Terms</h2>
            <p className="mt-1.5 text-sm leading-6 text-gray-500">Read how we handle your information and the terms for using LearnMatch.</p>
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-3 text-sm"><PrivacyNoticeLink /><PrivacyNoticeLink to="/terms">Terms &amp; Conditions</PrivacyNoticeLink></div>
          </section>
          <section aria-labelledby="settings-danger" className="rounded-2xl border border-rose-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 id="settings-danger" className="text-lg font-bold text-rose-700">Danger Zone</h2>
            <h3 className="mt-3 text-sm font-semibold">Delete Account</h3>
            <p className="mt-2 text-sm leading-6 text-gray-600">Account deletion is permanent and cannot be undone. You would lose access to your account, saved assessments, recommendations, and college tracking history.</p>
            <p className="mt-3 text-sm font-medium text-gray-600">You must enter your current password and confirm deletion. This removes your records from the active database; backups and external provider copies are not immediately erased.</p>
            <button type="button" aria-haspopup="dialog" onClick={() => setShowDeleteConfirmation(true)} className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-5 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500"><IconTrash size={17} aria-hidden="true" /> Delete Account</button>
          </section>
        </div>
        <ActionConfirmationModal action={showDeleteConfirmation ? 'deleteAccount' : null} onCancel={closeDeletion} onConfirm={deleteAccount} processing={deleting} error={deletionError} confirmDisabled={!currentPassword || !confirmed || outcomeUnknown}>
          <div className="mt-4 space-y-4">
            <div>
              <label htmlFor="delete-account-password" className="block text-sm font-semibold text-gray-700">Current password</label>
              <div className="relative mt-2">
                <input id="delete-account-password" type={showCurrentPassword ? 'text' : 'password'} autoComplete="current-password" maxLength={1024} value={currentPassword} disabled={deleting || outcomeUnknown} onChange={event => setCurrentPassword(event.target.value)} className="block w-full rounded-xl border border-gray-300 py-3 pl-3 pr-12 focus:outline-orange-500 disabled:opacity-60" />
                <button type="button" aria-label={showCurrentPassword ? 'Hide password' : 'Show password'} aria-pressed={showCurrentPassword} aria-controls="delete-account-password" disabled={deleting || outcomeUnknown} onClick={() => setShowCurrentPassword(value => !value)} className="absolute right-1 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-lg text-gray-500 hover:bg-orange-50 hover:text-orange-700 focus-visible:outline-2 focus-visible:outline-orange-500 disabled:opacity-50">
                  {showCurrentPassword ? <IconEyeOff size={19} aria-hidden="true" /> : <IconEye size={19} aria-hidden="true" />}
                </button>
              </div>
            </div>
            <label className="flex items-start gap-3 text-sm leading-6 text-gray-600"><input type="checkbox" checked={confirmed} disabled={deleting || outcomeUnknown} onChange={event => setConfirmed(event.target.checked)} className="mt-1 size-4 shrink-0 accent-rose-600" />I understand this is permanent and want to delete my account.</label>
            {outcomeUnknown && <p className="text-sm text-gray-600">Contact <a className="break-all underline" href="mailto:learnmatch1@gmail.com">learnmatch1@gmail.com</a>. Do not send your password.</p>}
          </div>
        </ActionConfirmationModal>
      </>}
    </main>
  </div>
}
