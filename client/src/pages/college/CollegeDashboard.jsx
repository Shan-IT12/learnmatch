import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

function CollegeDashboard() {
  const navigate = useNavigate()
  const token = localStorage.getItem('token')
  const username = localStorage.getItem('username')

  const [loading, setLoading] = useState(true)
  const [collegeInfo, setCollegeInfo] = useState(null)
  const [checkinStatus, setCheckinStatus] = useState(null)
  const [startingCheckin, setStartingCheckin] = useState(false)

  useEffect(() => {
    if (!token) {
      navigate('/login')
      return
    }

    const fetchData = async () => {
      try {
        const [collegeRes, statusRes] = await Promise.all([
          fetch(`${import.meta.env.VITE_API_URL}/api/college/status`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${import.meta.env.VITE_API_URL}/api/college/checkin/status`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ])

        if (!collegeRes.ok) {
          navigate('/college/setup')
          return
        }

        const collegeData = await collegeRes.json()
        const statusData = await statusRes.json()

        setCollegeInfo(collegeData)
        setCheckinStatus(statusData)
        setLoading(false)
      } catch (error) {
        console.error('College dashboard fetch error:', error)
        setLoading(false)
      }
    }

    fetchData()
  }, [navigate, token])

  const handleStartCheckin = async () => {
    if (checkinStatus?.state === 'pending') {
      navigate('/college/checkin')
      return
    }

    setStartingCheckin(true)
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/college/checkin/start`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        navigate('/college/checkin')
      }
    } catch (error) {
      console.error('Start check-in error:', error)
      setStartingCheckin(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-400">Loading...</p>
      </div>
    )
  }

  const checkinCardIsActionable =
    checkinStatus?.state === 'pending' || checkinStatus?.state === 'due'

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

        {checkinStatus?.state === 'due' && (
          <div className="rounded-2xl bg-orange-50 border border-orange-100 px-6 py-4 mb-6 flex justify-between items-center">
            <div>
              <p className="text-sm font-semibold text-gray-900">
                Your {checkinStatus.nextPhase} check-in is ready
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                It's been a while — let's see how things are going this semester.
              </p>
            </div>
            <button
              onClick={handleStartCheckin}
              disabled={startingCheckin}
              className="bg-gray-900 text-white px-4 py-2.5 rounded-xl text-xs font-medium hover:bg-gray-800 transition shrink-0 ml-4 disabled:opacity-50"
            >
              {startingCheckin ? 'Starting...' : `Start ${checkinStatus.nextPhase} Check-in`}
            </button>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
          <p className="text-xs font-semibold text-orange-500 uppercase tracking-widest mb-3">
            Currently Enrolled
          </p>
          <h2 className="text-lg font-bold text-gray-900 mb-1">{collegeInfo?.courseName}</h2>
          <p className="text-sm text-gray-500">{collegeInfo?.yearLevel} · {collegeInfo?.semester}</p>
        </div>

        <div className="grid grid-cols-3 gap-4">

          <div
            onClick={checkinCardIsActionable ? handleStartCheckin : undefined}
            className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-6 transition ${
              checkinCardIsActionable ? 'cursor-pointer hover:border-orange-300' : ''
            }`}
          >
            <h3 className="text-sm font-semibold text-gray-900 mb-1">Semester Check-in</h3>
            <p className="text-xs text-gray-400">Rate your alignment this semester</p>
            {checkinStatus?.state === 'pending' && (
              <p className="text-xs text-orange-500 mt-3 font-medium">Start check-in →</p>
            )}
            {checkinStatus?.state === 'due' && (
              <p className="text-xs text-orange-500 mt-3 font-medium">
                {checkinStatus.nextPhase} check-in ready →
              </p>
            )}
            {checkinStatus?.state === 'not_due' && (
              <p className="text-xs text-gray-400 mt-3">
                Next up: {checkinStatus.nextPhase} check-in
              </p>
            )}
            {checkinStatus?.state === 'complete' && (
              <p className="text-xs text-gray-400 mt-3">All check-ins done this semester</p>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-1">Career Roadmap</h3>
            <p className="text-xs text-gray-400">See your year-by-year academic path</p>
            <p className="text-xs text-orange-400 mt-3">Coming soon</p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-1">Mismatch Detection</h3>
            <p className="text-xs text-gray-400">AI analysis of your alignment score</p>
            <p className="text-xs text-orange-400 mt-3">Coming soon</p>
          </div>

        </div>
      </div>
    </div>
  )
}

export default CollegeDashboard