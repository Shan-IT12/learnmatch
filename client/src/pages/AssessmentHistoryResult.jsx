import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { IconArrowLeft, IconBrain, IconLoader2, IconLock } from '@tabler/icons-react'

const breakdownLabels = {
  skill_match: 'Skills',
  interest_match: 'Interests',
  personality_match: 'Personality',
  personal_factor_match: 'Personal Factors',
}

function formatAssessmentDate(value) {
  if (!value) return 'Date unavailable'
  return new Intl.DateTimeFormat('en-PH', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(value))
}

export function HistoricalResultContent({ result }) {
  return (
    <>
      <section className="mb-7 overflow-hidden rounded-3xl border border-orange-100 bg-white shadow-sm">
        <div className="bg-gradient-to-r from-orange-50 to-amber-50 px-5 py-5 sm:px-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-orange-600">
                <IconLock size={15} /> Read-only historical result
              </div>
              <h1 className="mt-2 text-2xl font-bold text-gray-950 sm:text-3xl">Assessment {result.attempt_number}</h1>
              <p className="mt-1 text-sm text-gray-500">Completed {formatAssessmentDate(result.generated_at)}</p>
            </div>
            <div className="inline-flex w-fit items-center gap-2 rounded-2xl border border-violet-100 bg-white px-4 py-3 text-violet-700 shadow-sm">
              <IconBrain size={19} />
              <div><p className="text-[10px] font-bold uppercase tracking-wide text-violet-400">MBTI</p><p className="font-black tracking-[0.14em]">{result.mbti?.type || '—'}</p></div>
            </div>
          </div>
        </div>
      </section>

      <div className="space-y-5">
        {result.recommendations.map((recommendation) => (
          <article key={recommendation.rank_position} className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-orange-500">
                  {recommendation.rank_position === 1 ? 'Top Match' : `Rank ${recommendation.rank_position}`}
                </p>
                <h2 className="mt-1 text-xl font-bold leading-snug text-gray-900">
                  {recommendation.course_name}{recommendation.course_abbreviation ? ` (${recommendation.course_abbreviation})` : ''}
                </h2>
              </div>
              <div className="shrink-0 sm:text-right"><span className="text-3xl font-black text-orange-500">{recommendation.match_score}%</span><p className="text-xs text-gray-400">compatibility</p></div>
            </div>
            <div className="grid gap-4 border-t border-gray-100 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
              <div className="rounded-2xl border border-orange-100 bg-orange-50/50 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-orange-700">Saved explanation</p>
                <p className="mt-2 text-sm leading-6 text-gray-700">{recommendation.ai_narrative || 'No explanation was stored for this assessment.'}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(recommendation.score_breakdown).map(([key, score]) => (
                  <div key={key} className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                    <p className="text-[11px] font-semibold text-gray-500">{breakdownLabels[key]}</p>
                    <p className="mt-1 text-lg font-bold text-gray-900">{score}%</p>
                  </div>
                ))}
              </div>
            </div>
          </article>
        ))}
      </div>
    </>
  )
}

function AssessmentHistoryResult() {
  const navigate = useNavigate()
  const { recommendationId } = useParams()
  const [result, setResult] = useState(null)
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
    fetch(`${import.meta.env.VITE_API_URL}/api/assessment-history/${encodeURIComponent(recommendationId)}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}))
        if (response.status === 401 || response.status === 403) {
          navigate('/login', { replace: true })
          return
        }
        if (!response.ok) throw new Error(data.message || 'Could not load this assessment result.')
        setResult(data.result)
      })
      .catch((requestError) => {
        if (requestError.name !== 'AbortError') setError(requestError.message || 'Could not load this assessment result.')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [navigate, recommendationId, retryCount])

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="flex items-center justify-between border-b border-gray-100 bg-white px-5 py-4 sm:px-8">
        <button onClick={() => navigate('/dashboard')} className="text-lg font-bold text-gray-900">Learn<span className="text-orange-500">Match</span></button>
        <button onClick={() => navigate('/assessment-history')} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900"><IconArrowLeft size={16} /> Back to Assessment History</button>
      </nav>
      <main className="mx-auto max-w-5xl px-5 py-8 sm:px-8 sm:py-12">
        {loading ? (
          <div className="flex min-h-64 items-center justify-center" role="status"><div className="text-center"><IconLoader2 className="mx-auto animate-spin text-orange-500" size={28} /><p className="mt-3 text-sm text-gray-500">Loading saved result...</p></div></div>
        ) : error ? (
          <div className="rounded-3xl border border-red-100 bg-red-50 px-6 py-10 text-center" role="alert"><p className="text-sm font-medium text-red-700">{error}</p><button type="button" onClick={() => { setLoading(true); setError(''); setRetryCount((count) => count + 1) }} className="mt-4 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-red-700 shadow-sm">Try again</button></div>
        ) : result ? <HistoricalResultContent result={result} /> : null}
      </main>
    </div>
  )
}

export default AssessmentHistoryResult
