import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import FeedbackPopup from '../components/FeedbackPopup'

function Results() {
  const navigate = useNavigate()
  const [recommendations, setRecommendations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/api/results`)
      .then((res) => res.json())
      .then((data) => {
        setRecommendations(data.recommendations || [])
        setLoading(false)
      })
      .catch(() => {
        setError('Could not load your results. Please try again.')
        setLoading(false)
      })
  }, [])

  const rankLabel = ['Top Match', '2nd Match', '3rd Match']

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
        <p className="text-gray-500 text-sm mb-2">
          Based on your skills, interests, and profile, here are your top matches.
        </p>
        <p className="text-xs text-orange-500 mb-8">
          Placeholder results — real scoring engine coming soon.
        </p>

        {error && (
          <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm mb-6">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center text-gray-500 text-sm py-12">Loading your results...</div>
        ) : (
          <div className="space-y-5">
            {recommendations.map((rec, index) => (
              <div
                key={rec.course_id}
                className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm"
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <span className="text-xs font-semibold text-orange-500 uppercase tracking-wide">
                      {rankLabel[index]}
                    </span>
                    <h2 className="text-lg font-bold text-gray-900 mt-1">{rec.course_name}</h2>
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

                <p className="text-sm text-gray-600 leading-relaxed">{rec.ai_narrative}</p>
                <button
                onClick={() => navigate(`/results/career-path/${rec.course_id}`)}
                className="mt-4 text-sm font-medium text-orange-500 hover:text-orange-600 transition inline-flex items-center gap-1"
              >
                View Career Path →
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