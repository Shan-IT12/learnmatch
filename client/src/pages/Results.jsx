import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import FeedbackPopup from '../components/FeedbackPopup'

const personalFactorLabels = {
  factor_physical: 'Physical / Mobility',
  factor_health: 'Health',
  factor_financial: 'Financial',
  factor_family: 'Family Obligations',
  factor_distance: 'Distance / Commute',
  factor_working_student: 'Working Student',
}

function Results() {
  const navigate = useNavigate()
  const [recommendations, setRecommendations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retryCount, setRetryCount] = useState(0)
  const [assessment, setAssessment] = useState({ interests: [], domainScores: {}, mbti: null, profile: null })

  useEffect(() => {
    const token = localStorage.getItem('token')

    if (!token) {
      navigate('/login', { replace: true })
      return
    }

    const controller = new AbortController()

    const loadRecommendations = async () => {
      setLoading(true)
      setError('')

      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/results`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal: controller.signal,
        })
        const data = await response.json().catch(() => ({}))

        if (response.status === 401 || response.status === 403) {
          navigate('/login', { replace: true })
          return
        }

        if (response.status === 400) {
          setError(
            data.message || 'Please complete all required assessments before viewing recommendations.'
          )
          setRecommendations([])
          return
        }

        if (!response.ok) {
          setError('Could not load your recommendations. Please try again.')
          setRecommendations([])
          return
        }

        setRecommendations(Array.isArray(data.recommendations) ? data.recommendations : [])

        const headers = { Authorization: `Bearer ${token}` }
        const userId = localStorage.getItem('userId')
        const assessmentResponses = await Promise.allSettled([
          fetch(`${import.meta.env.VITE_API_URL}/api/interests`, { headers }).then((res) => res.json()),
          fetch(`${import.meta.env.VITE_API_URL}/api/quiz/results`, { headers }).then((res) => res.json()),
          fetch(`${import.meta.env.VITE_API_URL}/api/mbti`, { headers }).then((res) => res.json()),
          fetch(`${import.meta.env.VITE_API_URL}/api/profile?userId=${userId}`, { headers }).then((res) => res.json()),
        ])

        const valueAt = (index) => assessmentResponses[index].status === 'fulfilled'
          ? assessmentResponses[index].value
          : {}
        setAssessment({
          interests: valueAt(0).interests || [],
          domainScores: valueAt(1).domainScores || {},
          mbti: valueAt(2).mbtiType || null,
          profile: valueAt(3).profile || null,
        })
      } catch (requestError) {
        if (requestError.name !== 'AbortError') {
          setError('Could not connect to the server. Please try again.')
          setRecommendations([])
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    loadRecommendations()

    return () => controller.abort()
  }, [navigate, retryCount])

  const rankLabel = ['Top Match', '2nd Match', '3rd Match']
  const breakdownLabels = {
    skill_match: 'Skills',
    interest_match: 'Interests',
    personality_match: 'Personality',
    personal_factor_match: 'Personal Factors',
  }

  const skillTotals = Object.values(assessment.domainScores).reduce(
    (totals, score) => ({ correct: totals.correct + score.correct, total: totals.total + score.total }),
    { correct: 0, total: 0 }
  )
  const skillPercent = skillTotals.total ? Math.round((skillTotals.correct / skillTotals.total) * 100) : null
  const selectedFactors = assessment.profile
    ? Object.entries(personalFactorLabels)
        .filter(([key]) => assessment.profile[key])
        .map(([, label]) => label)
    : []
  if (assessment.profile?.factor_others) selectedFactors.push('Other stated factor')
  const personalFactorsConsidered = selectedFactors.length > 0

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav */}
      <nav className="bg-white border-b border-gray-100 px-5 sm:px-8 py-4 sm:py-5 flex justify-between items-center gap-3">
        <button
          onClick={() => navigate('/dashboard')}
          className="text-lg font-bold text-gray-900 hover:opacity-80 transition"
        >
          Learn<span className="text-orange-500">Match</span>
        </button>
        <button
          onClick={() => navigate('/dashboard')}
          className="text-sm text-gray-500 hover:text-gray-900 transition"
        >
          ← Back to Dashboard
        </button>
      </nav>

      <div className="max-w-5xl mx-auto px-5 sm:px-8 py-8 sm:py-12">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 mb-2">Your Recommended Courses</h1>
        <p className="text-gray-500 text-sm mb-6">
          Based on your skills, interests, and profile, here are your top matches.
        </p>

        {loading ? (
          <div className="text-center text-gray-500 text-sm py-12">
            Generating your course recommendations...
          </div>
        ) : error ? (
          <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm mb-6">
            <p>{error}</p>
            <button
              type="button"
              onClick={() => setRetryCount((count) => count + 1)}
              className="mt-2 font-medium underline hover:text-red-700 transition"
            >
              Try again
            </button>
          </div>
        ) : recommendations.length === 0 ? (
          <div className="text-center text-gray-500 text-sm py-12">
            No recommendations are available yet.
          </div>
        ) : (
          <>
          <section className="mb-6 overflow-hidden rounded-3xl border border-orange-100 bg-white shadow-sm" aria-labelledby="assessment-snapshot-title">
            <div className="flex flex-col gap-2 border-b border-orange-100 bg-gradient-to-r from-orange-50 to-amber-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-orange-600">Assessment snapshot</p>
                <h2 id="assessment-snapshot-title" className="mt-0.5 font-bold text-gray-900">The inputs considered in your matches</h2>
              </div>
              <button type="button" onClick={() => navigate('/dashboard/summary')} className="text-left text-xs font-semibold text-orange-600 hover:text-orange-700 sm:text-right">
                Open Full Summary →
              </button>
            </div>
            <div className="grid sm:grid-cols-3">
              <div className="border-b border-gray-100 p-5 sm:border-b-0 sm:border-r">
                <p className="text-xs font-semibold text-gray-400">Personality type</p>
                <p className="mt-2 text-3xl font-black tracking-[0.16em] text-orange-500">{assessment.mbti || '—'}</p>
                <p className="mt-1 text-xs text-gray-500">Your four-letter MBTI result</p>
              </div>
              <div className="border-b border-gray-100 p-5 sm:border-b-0 sm:border-r">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-gray-400">Academic skills</p>
                    <p className="mt-2 text-2xl font-bold text-gray-900">{skillTotals.total ? `${skillTotals.correct}/${skillTotals.total}` : '—'}</p>
                  </div>
                  {skillPercent !== null && <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">{skillPercent}%</span>}
                </div>
                <p className="mt-1 text-xs text-gray-500">Correct answers in your latest quiz</p>
              </div>
              <div className="p-5">
                <p className="text-xs font-semibold text-gray-400">Personal factors</p>
                <div className="mt-2 flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${personalFactorsConsidered ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                  <p className="font-bold text-gray-900">{personalFactorsConsidered ? 'Considered' : 'None selected'}</p>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-gray-500">
                  {personalFactorsConsidered ? selectedFactors.join(' · ') : 'No personal constraints were included.'}
                </p>
              </div>
            </div>
            <div className="border-t border-gray-100 px-5 py-4 sm:px-6">
              <p className="mb-2 text-xs font-semibold text-gray-400">Selected interests & hobbies</p>
              <div className="flex flex-wrap gap-2">
                {assessment.interests.length > 0 ? assessment.interests.map((interest) => (
                  <span key={interest} className="rounded-full bg-orange-50 px-3 py-1.5 text-xs font-medium text-orange-800">{interest}</span>
                )) : <span className="text-xs text-gray-400">No interests available.</span>}
              </div>
            </div>
          </section>

          <div className="space-y-5">
            {recommendations.map((rec) => (
              <div
                key={rec.course_id}
                className="overflow-hidden bg-white border border-gray-200 rounded-3xl shadow-sm"
              >
                <div className="p-5 sm:p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-start mb-4">
                  <div className="min-w-0">
                    <span className="text-xs font-semibold text-orange-500 uppercase tracking-wide">
                      {rankLabel[rec.rank_position - 1] || `#${rec.rank_position}`}
                    </span>
                    <h2 className="text-lg sm:text-xl font-bold text-gray-900 mt-1 leading-snug">
                      {rec.course_name}
                      {rec.course_abbreviation && ` (${rec.course_abbreviation})`}
                    </h2>
                    <p className="text-xs text-gray-400 mt-0.5">{rec.cluster_category}</p>
                  </div>
                  <div className="flex items-baseline gap-1 sm:block sm:text-right shrink-0">
                    <span className="text-2xl font-bold text-orange-500">{rec.match_score}%</span>
                    <span className="text-xs text-gray-400">match</span>
                  </div>
                </div>

                {/* Match score bar */}
                <div className="w-full bg-gray-100 rounded-full h-2 mb-4">
                  <div
                    className="bg-orange-500 h-2 rounded-full transition-all"
                    style={{ width: `${rec.match_score}%` }}
                  />
                </div>

                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_17rem]">
                  {rec.ai_narrative && (
                    <div className="rounded-2xl border border-orange-100 bg-orange-50/70 px-4 py-4 sm:px-5">
                      <p className="text-xs font-bold uppercase tracking-wide text-orange-700 mb-2">Why this course fits you</p>
                      <p className="text-sm text-gray-700 leading-6">{rec.ai_narrative}</p>
                    </div>
                  )}
                  {rec.score_breakdown && (
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(breakdownLabels).map(([key, label]) => (
                        <div key={key} className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5">
                          <p className="text-[11px] text-gray-400">{label}</p>
                          <p className="text-sm font-bold text-gray-800">{rec.score_breakdown[key]}%</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                </div>
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-gray-100 bg-gray-50/60 px-5 py-3.5 sm:px-6">
                <button
                onClick={() => navigate(`/results/career-path/${encodeURIComponent(rec.course_code)}`, { state: { recommendations } })}
                className="text-sm font-medium text-orange-500 hover:text-orange-600 transition inline-flex items-center gap-1"
              >
                View Career Path →
              </button>
                  <button
                    onClick={() => navigate(`/schools/${encodeURIComponent(rec.course_code)}`)}
                    className="text-sm font-medium text-gray-600 hover:text-orange-600 transition"
                  >
                    Find Schools in SJDM
                  </button>
                </div>
              </div>
            ))}
          </div>
          </>
        )}
      </div>
      <FeedbackPopup />
    </div>
  )
}

export default Results
