import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  IconAlertTriangle,
  IconArrowLeft,
  IconCalendar,
  IconMessageReport,
  IconRefresh,
  IconStarFilled,
  IconUser,
} from '@tabler/icons-react'
import AdminHeader from '../../components/AdminHeader'

function formatDate(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

function DetailField({ label, children }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-1.5 text-sm text-slate-700">{children}</dd>
    </div>
  )
}

function AdminFeedbackDetail() {
  const { feedbackId } = useParams()
  const navigate = useNavigate()
  const [feedback, setFeedback] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notFound, setNotFound] = useState(false)
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    document.title = 'Feedback Detail | LearnMatch Admin'
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    const loadFeedback = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/feedback/${feedbackId}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` },
          signal: controller.signal,
        })
        if (response.status === 401 || response.status === 403) {
          localStorage.removeItem('adminToken')
          localStorage.removeItem('adminUsername')
          navigate('/admin/login', { replace: true })
          return
        }
        if (response.status === 404) {
          setNotFound(true)
          return
        }
        if (!response.ok) throw new Error('Could not load this feedback record.')
        const data = await response.json()
        setFeedback(data.feedback)
      } catch (requestError) {
        if (requestError.name !== 'AbortError') {
          setError(requestError.message || 'Could not load this feedback record.')
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    loadFeedback()
    return () => controller.abort()
  }, [feedbackId, navigate, retryKey])

  const retry = () => {
    setLoading(true)
    setError('')
    setNotFound(false)
    setRetryKey((current) => current + 1)
  }

  return (
    <div className="min-h-screen bg-[#fcfaf7]">
      <AdminHeader currentPage="feedback" />
      <main className="mx-auto max-w-5xl px-5 py-8 sm:px-8 sm:py-10">
        <Link to="/admin/feedback" className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-orange-700">
          <IconArrowLeft size={17} /> Back to Feedback
        </Link>

        {loading && <div aria-label="Loading feedback detail" className="h-96 animate-pulse rounded-xl border border-slate-200 bg-white" />}

        {!loading && (error || notFound) && (
          <div className="rounded-xl border border-red-200 bg-white p-8 text-center shadow-sm" role="alert">
            <IconAlertTriangle className="mx-auto text-red-600" size={28} stroke={1.8} />
            <h1 className="mt-3 text-lg font-semibold text-slate-900">{notFound ? 'Feedback not found' : 'Unable to load feedback'}</h1>
            <p className="mt-1 text-sm text-slate-600">{notFound ? 'This feedback record does not exist or is no longer available.' : error}</p>
            {!notFound && <button type="button" onClick={retry} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"><IconRefresh size={16} /> Retry</button>}
          </div>
        )}

        {!loading && feedback && (
          <article className="overflow-hidden rounded-xl border border-orange-100 bg-white shadow-sm">
            <header className="border-b border-slate-100 px-5 py-5 sm:px-7 sm:py-6">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-orange-600">Feedback record #{feedback.feedbackId}</p>
              <div className="mt-2 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <h1 className="text-2xl font-bold tracking-tight text-slate-950">{feedback.category}</h1>
                <span className="inline-flex w-fit items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-800" aria-label={`${feedback.rating} out of 5 stars`}>
                  <IconStarFilled size={17} /> {feedback.rating}/5
                </span>
              </div>
            </header>

            <div className="grid gap-5 border-b border-slate-100 bg-slate-50/50 px-5 py-5 sm:grid-cols-2 sm:px-7">
              <DetailField label="Submitted By">
                <span className="inline-flex items-center gap-2 font-medium text-slate-900"><IconUser size={16} className="text-slate-400" /> {feedback.user.displayName}</span>
                {feedback.user.email && <span className="mt-1 block text-xs text-slate-500">{feedback.user.email}</span>}
              </DetailField>
              <DetailField label="Submitted">
                <span className="inline-flex items-center gap-2"><IconCalendar size={16} className="text-slate-400" /> {formatDate(feedback.submittedAt)}</span>
              </DetailField>
            </div>

            <div className="px-5 py-6 sm:px-7 sm:py-7">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900"><IconMessageReport size={18} className="text-orange-600" /> Feedback message</div>
              <p className="mt-4 whitespace-pre-wrap break-words text-[15px] leading-7 text-slate-700">{feedback.comment || 'No additional comment was provided.'}</p>
            </div>

            <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-4 sm:px-7">
              <p className="text-xs text-slate-500">Feedback review is read-only.</p>
              <Link to={`/admin/users/${feedback.user.userId}`} className="inline-flex rounded-lg border border-orange-200 bg-white px-4 py-2 text-sm font-semibold text-orange-700 hover:bg-orange-50">
                View User
              </Link>
            </footer>
          </article>
        )}
      </main>
    </div>
  )
}

export default AdminFeedbackDetail
