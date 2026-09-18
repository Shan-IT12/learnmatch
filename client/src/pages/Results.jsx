import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import FeedbackPopup from '../components/FeedbackPopup'

function Results() {
  const navigate = useNavigate()
  const [recommendations, setRecommendations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retryCount, setRetryCount] = useState(0)

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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav */}
      <nav className="bg-white border-b border-gray-100 px-8 py-5 flex justify-between items-center">
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

      <div className="max-w-2xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Your Recommended Courses</h1>
        <p className="text-gray-500 text-sm mb-8">
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
          <div className="space-y-5">
            {recommendations.map((rec) => (
              <div
                key={rec.course_id}
                className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm"
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <span className="text-xs font-semibold text-orange-500 uppercase tracking-wide">
                      {rankLabel[rec.rank_position - 1] || `#${rec.rank_position}`}
                    </span>
                    <h2 className="text-lg font-bold text-gray-900 mt-1">
                      {rec.course_name}
                      {rec.course_abbreviation && ` (${rec.course_abbreviation})`}
                    </h2>
                    <p className="text-xs text-gray-400 mt-0.5">{rec.cluster_category}</p>
                  </div>
                  <div className="text-right shrink-0 ml-4">
                    <span className="text-2xl font-bold text-orange-500">{rec.match_score}%</span>
                    <p className="text-xs text-gray-400">match</p>
                  </div>
                </div>

                {/* Match score bar */}
                <div className="w-full bg-gray-100 rounded-full h-2 mb-4">
                  <div
                    className="bg-orange-500 h-2 rounded-full transition-all"
                    style={{ width: `${rec.match_score}%` }}
                  />
                </div>

                {rec.score_breakdown && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                    {Object.entries(breakdownLabels).map(([key, label]) => (
                      <div key={key} className="bg-gray-50 rounded-xl px-3 py-2">
                        <p className="text-xs text-gray-400">{label}</p>
                        <p className="text-sm font-semibold text-gray-700">
                          {rec.score_breakdown[key]}%
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {rec.ai_narrative && (
                  <p className="text-sm text-gray-600 leading-relaxed">{rec.ai_narrative}</p>
                )}
                <button
                onClick={() => navigate('/results/career-path', { state: { recommendations } })}
                className="mt-4 text-sm font-medium text-orange-500 hover:text-orange-600 transition inline-flex items-center gap-1"
              >
                View Full Career Path →
              </button>
              <FeedbackPopup />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default Results
