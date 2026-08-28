import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

function CollegeDashboard() {
  const navigate = useNavigate()
  const token = localStorage.getItem('token')
  const username = localStorage.getItem('username')

  const [loading, setLoading] = useState(true)
  const [collegeInfo, setCollegeInfo] = useState(null)

  useEffect(() => {
    if (!token) {
      navigate('/login')
      return
    }

    const fetchCollegeStatus = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/college/status`, {
          headers: { Authorization: `Bearer ${token}` },
        })

        if (!res.ok) {
          // No enrollment found — send them back to set up college phase
          navigate('/college/setup')
          return
        }

        const data = await res.json()
        setCollegeInfo(data)
        setLoading(false)
      } catch (error) {
        console.error('College status fetch error:', error)
        setLoading(false)
      }
    }

    fetchCollegeStatus()
  }, [navigate, token])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-400">Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-100 px-8 py-5 flex justify-between items-center">
        <button
          onClick={() => navigate('/dashboard')}
          className="text-lg font-bold text-gray-900 hover:opacity-80 transition"
        >
          Learn<span className="text-orange-500">Match</span>
        </button>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">Welcome, <strong>{username}</strong></span>
          <button
            onClick={() => navigate('/dashboard')}
            className="text-sm text-gray-500 hover:text-gray-900 transition"
          >
            Dashboard
          </button>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">College Phase</h1>
        <p className="text-gray-500 text-sm mb-8">
          Track your academic alignment and career roadmap.
        </p>

        {/* Enrollment info card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
          <p className="text-xs font-semibold text-orange-500 uppercase tracking-widest mb-3">
            Currently Enrolled
          </p>
          <h2 className="text-lg font-bold text-gray-900 mb-1">{collegeInfo?.courseName}</h2>
          <p className="text-sm text-gray-500">{collegeInfo?.yearLevel} · {collegeInfo?.semester}</p>
        </div>

        {/* Feature cards */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { title: 'Semester Check-in', desc: 'Rate your alignment this semester' },
            { title: 'Career Roadmap', desc: 'See your year-by-year academic path' },
            { title: 'Mismatch Detection', desc: 'AI analysis of your alignment score' },
          ].map((card) => (
            <div key={card.title} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-1">{card.title}</h3>
              <p className="text-xs text-gray-400">{card.desc}</p>
              <p className="text-xs text-orange-400 mt-3">Coming soon</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default CollegeDashboard