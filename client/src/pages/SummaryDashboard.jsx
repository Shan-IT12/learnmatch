import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconArrowRight, IconRefresh, IconSchool, IconHistory } from '@tabler/icons-react'

function SummaryDashboard() {
  const navigate = useNavigate()
  const token = localStorage.getItem('token')
  const username = localStorage.getItem('username')

  const [loading, setLoading] = useState(true)
  const [topRecommendation, setTopRecommendation] = useState(null)
  const [interests, setInterests] = useState([])
  const [domainScores, setDomainScores] = useState({})

  useEffect(() => {
    if (!token) {
      navigate('/login')
      return
    }

    const fetchSummary = async () => {
      try {
        const headers = { Authorization: `Bearer ${token}` }
        const [resultsRes, interestsRes, quizRes] = await Promise.all([
          fetch(`${import.meta.env.VITE_API_URL}/api/results`, { headers }),
          fetch(`${import.meta.env.VITE_API_URL}/api/interests`, { headers }),
          fetch(`${import.meta.env.VITE_API_URL}/api/quiz/results`, { headers }),
        ])

        const resultsData = await resultsRes.json()
        const interestsData = await interestsRes.json()
        const quizData = await quizRes.json()

        if (resultsData.recommendations?.length > 0) {
          setTopRecommendation(resultsData.recommendations[0])
        }
        setInterests(interestsData.interests || [])
        setDomainScores(quizData.domainScores || {})
      } catch (error) {
        console.error('Summary fetch error:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchSummary()
  }, [navigate, token])

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('userId')
    localStorage.removeItem('username')
    navigate('/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-white">
        <span className="text-2xl font-bold animate-pulse">
          Learn<span className="text-orange-500">Match</span>
        </span>
        <p className="text-sm text-gray-400">Loading your summary...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <nav className="bg-white border-b border-gray-100 px-14 py-[18px] flex justify-between items-center">
        <span className="text-lg font-bold text-gray-900">
          Learn<span className="text-orange-500">Match</span>
        </span>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">
            Welcome, <strong className="text-gray-900">{username}</strong>
          </span>
          <button
            onClick={() => navigate('/profile')}
            className="bg-orange-500 text-white px-4 py-2.5 rounded-xl text-xs font-medium hover:bg-orange-600 transition"
          >
            Edit Profile
          </button>
          <button
            onClick={handleLogout}
            className="bg-red-50 text-red-600 px-4 py-2.5 rounded-xl text-xs font-medium hover:bg-red-100 transition"
          >
            Logout
          </button>
        </div>
      </nav>

      <div className="max-w-[1320px] mx-auto px-14 py-11">

        {/* Top recommendation preview */}
        {topRecommendation && (
          <div
            className="rounded-[20px] p-8 mb-5 flex justify-between items-center shadow-[0_8px_30px_-8px_rgba(249,115,22,0.35)]"
            style={{ background: 'linear-gradient(135deg, #ffe4c4 0%, #ffd0a8 40%, #ffb8a8 100%)' }}
          >
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: '#b45309' }}>
                Top Recommendation
              </p>
              <p className="text-xl font-bold mb-1" style={{ color: '#2b1002' }}>
                {topRecommendation.course_name}
              </p>
              <p className="text-sm" style={{ color: '#7c3f0e' }}>
                {topRecommendation.match_score}% match
              </p>
            </div>
            <button
              onClick={() => navigate('/results')}
              className="inline-flex items-center gap-1.5 bg-gray-900 text-white px-5 py-3 rounded-xl text-sm font-medium hover:bg-gray-800 hover:-translate-y-0.5 hover:shadow-lg transition-all duration-200 shrink-0"
            >
              View Full Results <IconArrowRight size={16} stroke={2} />
            </button>
          </div>
        )}

        {/* Assessment summary: Interests + Skills */}
        <div className="grid grid-cols-2 gap-5 mb-5">

          {/* Interests card */}
          <div className="rounded-[20px] px-7 py-6 border border-gray-100 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide mb-4 text-gray-400">
              Your Interests
            </p>
            <div className="flex flex-wrap gap-2">
              {interests.length > 0 ? (
                interests.map((interest) => (
                  <span
                    key={interest}
                    className="text-xs px-3 py-1.5 rounded-full bg-orange-50 text-orange-700 font-medium"
                  >
                    {interest}
                  </span>
                ))
              ) : (
                <p className="text-sm text-gray-400">No interests recorded yet.</p>
              )}
            </div>
          </div>

          {/* Skills card */}
          <div className="rounded-[20px] px-7 py-6 border border-gray-100 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide mb-4 text-gray-400">
              Skills Quiz Results
            </p>
            <div className="flex flex-col gap-3">
              {Object.keys(domainScores).length > 0 ? (
                Object.entries(domainScores).map(([domain, score]) => (
                  <div key={domain}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-600">{domain}</span>
                      <span className="text-gray-900 font-medium">
                        {score.correct}/{score.total}
                      </span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-orange-500 rounded-full"
                        style={{ width: `${(score.correct / score.total) * 100}%` }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-400">No quiz results yet.</p>
              )}
            </div>
          </div>
        </div>

        {/* MBTI placeholder */}
        <div className="rounded-[20px] px-7 py-6 border border-gray-100 shadow-sm mb-5">
          <p className="text-[11px] font-semibold uppercase tracking-wide mb-2 text-gray-400">
            Personality Type
          </p>
          <p className="text-sm text-gray-400">Coming soon — take the Personality assessment to see your MBTI type here.</p>
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-3 gap-4">
          <button
            onClick={() => navigate('/onboarding/profile')}
            className="flex items-center justify-center gap-2 bg-gray-900 text-white px-5 py-4 rounded-xl text-sm font-medium hover:bg-gray-800 transition"
          >
            <IconRefresh size={16} stroke={2} /> Retake Assessment
          </button>
          <button
            onClick={() => navigate('/college/setup')}
            className="flex items-center justify-center gap-2 bg-orange-500 text-white px-5 py-4 rounded-xl text-sm font-medium hover:bg-orange-600 transition"
          >
            <IconSchool size={16} stroke={2} /> Go to College Phase
          </button>
          <button
            disabled
            className="flex items-center justify-center gap-2 bg-gray-100 text-gray-400 px-5 py-4 rounded-xl text-sm font-medium cursor-not-allowed"
          >
            <IconHistory size={16} stroke={2} /> Assessment History
          </button>
        </div>

      </div>
    </div>
  )
}

export default SummaryDashboard