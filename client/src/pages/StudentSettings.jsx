import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { IconArrowLeft, IconShieldCheck, IconTrash } from '@tabler/icons-react'
import HeaderBrand from '../components/HeaderBrand'
import PrivacyNoticeLink from '../components/PrivacyNoticeLink'
import ActionConfirmationModal from '../components/ActionConfirmationModal'
import { clearUserAuth } from '../utils/userAuth'
import SuccessConfirmation from '../components/SuccessConfirmation'
import { waitForSuccessConfirmation } from '../utils/successConfirmation'

export default function StudentSettings() {
  const location = useLocation()
  const navigate = useNavigate()
  const token = localStorage.getItem('token')
  const [session, setSession] = useState('checking')
  const [attempt, setAttempt] = useState(0)
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
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
    // Validate the student session with an existing read-only endpoint.
    fetch(`${import.meta.env.VITE_API_URL || ''}/api/dashboard/status`, {
      headers: { Authorization: `Bearer ${token}` }, signal: controller.signal,
    }).then(response => {
      if (controller.signal.aborted) return
      if (response.status === 401 || response.status === 403) setSession('unauthorized')
      else setSession(response.ok ? 'authenticated' : 'error')
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
        <p>We couldn't verify your session. Please try again.</p>
        <button type="button" className="lm-action mt-4" onClick={() => { setSession('checking'); setAttempt(value => value + 1) }}>Try again</button>
      </div>}
      {deletionSucceeded && <SuccessConfirmation message="Your account and its student records have been deleted from the active LearnMatch database." />}
      {session === 'authenticated' && !deletionSucceeded && <>
        <header className="mb-8"><p className="text-xs font-bold uppercase tracking-[0.16em] text-orange-500">Your account</p><h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Settings</h1></header>
        <div className="space-y-6">
          <section aria-labelledby="settings-privacy" className="rounded-3xl border border-gray-200/80 bg-white p-5 shadow-sm sm:p-7">
            <h2 id="settings-privacy" className="flex items-center gap-3 text-xl font-bold"><IconShieldCheck size={22} className="text-orange-500" aria-hidden="true" /> Privacy Notice</h2>
            <p className="mt-3 text-sm leading-6 text-gray-500">Learn how LearnMatch collects, uses, and stores your information.</p>
            <div className="mt-4 text-sm"><PrivacyNoticeLink /></div>
          </section>
          <section aria-labelledby="settings-danger" className="rounded-3xl border border-rose-200 bg-white p-5 shadow-sm sm:p-7">
            <h2 id="settings-danger" className="text-xl font-bold text-rose-700">Danger Zone</h2>
            <h3 className="mt-5 font-semibold">Delete Account</h3>
            <p className="mt-2 text-sm leading-6 text-gray-600">Account deletion is permanent and cannot be undone. You would lose access to your account, saved assessments, recommendations, and college tracking history.</p>
            <p className="mt-3 text-sm font-medium text-gray-600">You must enter your current password and confirm deletion. This removes your records from the active database; backups and external provider copies are not immediately erased.</p>
            <button type="button" aria-haspopup="dialog" onClick={() => setShowDeleteConfirmation(true)} className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-5 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500"><IconTrash size={17} aria-hidden="true" /> Delete Account</button>
          </section>
        </div>
        <ActionConfirmationModal action={showDeleteConfirmation ? 'deleteAccount' : null} onCancel={closeDeletion} onConfirm={deleteAccount} processing={deleting} error={deletionError} confirmDisabled={!currentPassword || !confirmed || outcomeUnknown}>
          <div className="mt-4 space-y-4">
            <label className="block text-sm font-semibold text-gray-700">Current password
              <input type="password" autoComplete="current-password" maxLength={1024} value={currentPassword} disabled={deleting || outcomeUnknown} onChange={event => setCurrentPassword(event.target.value)} className="mt-2 block w-full rounded-xl border border-gray-300 px-3 py-3 focus:outline-orange-500 disabled:opacity-60" />
            </label>
            <label className="flex items-start gap-3 text-sm leading-6 text-gray-600"><input type="checkbox" checked={confirmed} disabled={deleting || outcomeUnknown} onChange={event => setConfirmed(event.target.checked)} className="mt-1 size-4 shrink-0 accent-rose-600" />I understand this is permanent and want to delete my account.</label>
            {outcomeUnknown && <p className="text-sm text-gray-600">Contact <a className="break-all underline" href="mailto:learnmatch1@gmail.com">learnmatch1@gmail.com</a>. Do not send your password.</p>}
          </div>
        </ActionConfirmationModal>
      </>}
    </main>
  </div>
}
