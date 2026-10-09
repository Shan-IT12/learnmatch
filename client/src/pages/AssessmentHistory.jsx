import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconArrowLeft, IconArrowRight, IconBrain, IconHistory, IconLoader2 } from '@tabler/icons-react'
import { getAssessmentHistoryResultPath } from '../utils/assessmentHistory'
import CourseName from '../components/CourseName'

function formatAssessmentDate(value) {
  if (!value) return 'Date unavailable'
  return new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(new Date(value))
}

export function HistoryListContent({ history, onView }) {
  if (history.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-gray-200 bg-white px-6 py-16 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 text-orange-500">
          <IconHistory size={24} stroke={1.8} />
        </span>
        <h2 className="mt-4 text-lg font-bold text-gray-900">No completed assessments yet</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-gray-500">
          Completed recommendation results will appear here after you finish an assessment.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {history.map((attempt, index) => (
        <article key={attempt.recommendation_id} className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-gray-100 bg-gradient-to-r from-orange-50/80 to-white px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-orange-600">
                  Assessment {attempt.attempt_number}
                </p>
                {index === 0 && (
                  <span className="rounded-full bg-orange-500 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
                    Latest Assessment
                  </span>
                )}
              </div>
              <p className="mt-2 text-sm text-gray-500">Completed {formatAssessmentDate(attempt.generated_at)}</p>
            </div>
            <div className="inline-flex w-fit items-center gap-2 rounded-xl border border-violet-100 bg-violet-50 px-3 py-2 text-violet-700">
              <IconBrain size={17} stroke={1.9} />
              <span className="text-xs font-semibold">MBTI</span>
              <span className="font-black tracking-[0.12em]">{attempt.mbti?.type || '—'}</span>
            </div>
          </div>

          <div className="p-5 sm:p-6">
            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-gray-400">Top 3 recommended courses</p>
            <ol className="divide-y divide-gray-100 rounded-2xl border border-gray-100">
              {attempt.recommendations.map((recommendation) => (
                <li key={recommendation.rank_position} className="flex items-start justify-between gap-4 px-4 py-3.5">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-orange-50 text-xs font-bold text-orange-600">
                      {recommendation.rank_position}
                    </span>
                    <CourseName name={recommendation.course_name} className="min-w-0 text-sm font-semibold leading-6 text-gray-800" secondaryClassName="mt-0.5 text-sm font-normal leading-5 text-gray-500" />
                  </div>
                  <span className="shrink-0 text-sm font-bold text-orange-600">{recommendation.match_score}%</span>
                </li>
              ))}
            </ol>
            <button
              type="button"
              onClick={() => onView(attempt.recommendation_id)}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-300 focus:ring-offset-2"
            >
              View Result <IconArrowRight size={16} stroke={2} />
            </button>
          </div>
        </article>
      ))}
    </div>
  )
}

export function AssessmentHistoryState({ loading, error, history, onRetry, onView }) {
  if (loading) {
    return (
      <div className="flex min-h-64 items-center justify-center rounded-3xl border border-orange-100 bg-white" role="status">
        <div className="text-center">
          <IconLoader2 className="mx-auto animate-spin text-orange-500" size={28} />
          <p className="mt-3 text-sm font-medium text-gray-600">Loading your assessment history...</p>
        </div>
      </div>
    )
  }
  if (error) {
    return (
      <div className="rounded-3xl border border-red-100 bg-red-50 px-6 py-10 text-center" role="alert">
        <p className="text-sm font-medium text-red-700">{error}</p>
        <button type="button" onClick={onRetry} className="mt-4 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-red-700 shadow-sm">
          Try again
        </button>
      </div>
    )
  }
  return <HistoryListContent history={history} onView={onView} />
}

function AssessmentHistory() {
  const navigate = useNavigate()
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      navigate('/login', { replace: true })
      return undefined
    }
    const controller = new AbortController()
    fetch(`${import.meta.env.VITE_API_URL}/api/assessment-history`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}))
        if (response.status === 401 || response.status === 403) {
          navigate('/login', { replace: true })
          return
        }
        if (!response.ok) throw new Error(data.message || 'Could not load assessment history.')
        setHistory(Array.isArray(data.history) ? data.history : [])
      })
      .catch((requestError) => {
        if (requestError.name !== 'AbortError') setError(requestError.message || 'Could not load assessment history.')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [navigate, retryCount])

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="flex items-center justify-between border-b border-gray-100 bg-white px-5 py-4 sm:px-8">
        <button onClick={() => navigate('/dashboard')} className="text-lg font-bold text-gray-900">Learn<span className="text-orange-500">Match</span></button>
        <button onClick={() => navigate('/dashboard/summary')} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900">
          <IconArrowLeft size={16} /> Back to Summary
        </button>
      </nav>
      <main className="mx-auto max-w-5xl px-5 py-8 sm:px-8 sm:py-12">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-orange-600">Your completed assessments</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-950 sm:text-4xl">Assessment History</h1>
        <p className="mb-8 mt-3 max-w-2xl text-sm leading-relaxed text-gray-500">
          Review the recommendation results saved when each assessment was completed. Historical results are read-only.
        </p>
        <AssessmentHistoryState
          loading={loading}
          error={error}
          history={history}
          onRetry={() => {
            setLoading(true)
            setError('')
            setRetryCount((count) => count + 1)
          }}
          onView={(recommendationId) => navigate(getAssessmentHistoryResultPath(recommendationId))}
        />
      </main>
    </div>
  )
}

export default AssessmentHistory
