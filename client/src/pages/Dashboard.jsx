import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconSchool, IconArrowRight } from '@tabler/icons-react'
import loadingGif from '../assets/loading2.gif'

const loadingMessages = [
  'Checking your progress...',
  'Almost there...',
  'Getting things ready...',
]

function Dashboard() {
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [loadingTextIndex, setLoadingTextIndex] = useState(0)

  const [hasProfile, setHasProfile] = useState(false)
  const [hasInterests, setHasInterests] = useState(false)
  const [hasSkills, setHasSkills] = useState(false)
  const [hasPersonality, setHasPersonality] = useState(false)

  const token = localStorage.getItem('token')
  const username = localStorage.getItem('username')

  // Cycle through loading messages every 1.4s while loading
  useEffect(() => {
    if (!loading) return
    const interval = setInterval(() => {
      setLoadingTextIndex((prev) => (prev + 1) % loadingMessages.length)
    }, 1400)
    return () => clearInterval(interval)
  }, [loading])

  useEffect(() => {
  if (!token) {
    navigate('/login')
    return
  }

  const checkStatus = async () => {
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/dashboard/status`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )

      const data = await res.json()

      if (data.isCollegePhase) {
        navigate('/college')
      } else if (
        data.hasInterests &&
        data.hasSkills &&
        data.hasPersonality
      ) {
        navigate('/dashboard/summary')
      } else {
        setHasProfile(data.hasProfile)
        setHasInterests(data.hasInterests)
        setHasSkills(data.hasSkills)
        setHasPersonality(data.hasPersonality)

        setLoading(false)
      }
    } catch (error) {
      console.error('Dashboard status fetch error:', error)
      setLoading(false)
    }
  }

  checkStatus()
}, [navigate, token])

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('userId')
    localStorage.removeItem('username')
    navigate('/login')
  }

  // ---------- Loading state ----------
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-white">
        <img
          src={loadingGif}
          alt="Loading"
          className="w-32 h-32 object-contain"
        />
        <p className="text-sm text-gray-400">{loadingMessages[loadingTextIndex]}</p>
      </div>
    )
  }
  
  // ---------- State 1: no assessment yet ----------
  const steps = [
  { label: 'Profile', done: hasProfile },
  { label: 'Interests', done: hasInterests },
  { label: 'Skills quiz', done: hasSkills },
  { label: 'Personality', done: hasPersonality },
]

  return (
    <div className="min-h-screen bg-white">
      <nav className="bg-white border-b border-gray-100 px-14 py-[18px] flex justify-between items-center">
        <button
          onClick={() => navigate('/dashboard')}
          className="text-lg font-bold text-gray-900 hover:opacity-80 transition"
        >
          Learn<span className="text-orange-500">Match</span>
        </button>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">
            Welcome, <strong className="text-gray-900">{username}</strong>
          </span>
          <button
            onClick={() => navigate('/profile')}
            className="bg-orange-500 text-white px-4 py-2.5 rounded-xl text-xs font-medium hover:bg-orange-600 transition"
          >
            View Profile
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

      {/* Profile setup banner */}
      {!hasProfile && (
        <div className="rounded-2xl bg-orange-50 border border-orange-100 px-6 py-4 mb-5 flex justify-between items-center">
          <div>
            <p className="text-sm font-semibold text-gray-900">
              Let's set up your profile first
            </p>

            <p className="text-xs text-gray-500 mt-0.5">
              Add your basic info so we can personalize your assessment.
            </p>
          </div>

          <button
            onClick={() =>
              navigate('/profile', {
                state: { fromOnboarding: true }
              })
            }
            className="bg-gray-900 text-white px-4 py-2.5 rounded-xl text-xs font-medium hover:bg-gray-800 transition shrink-0 ml-4"
          >
            Set Up Profile
          </button>
        </div>
      )}

          {/* Hero + Steps row */}
          <div className="grid grid-cols-[1.6fr_1fr] gap-5 mb-4 items-stretch">

            {/* Hero card */}
          <div
            className="rounded-[20px] p-10 relative overflow-hidden flex flex-col justify-between shadow-[0_8px_30px_-8px_rgba(249,115,22,0.35)]"
            style={{ background: 'linear-gradient(135deg, #ffe4c4 0%, #ffd0a8 40%, #ffb8a8 100%)' }}
          >
            <svg width="320" height="320" viewBox="0 0 320 320" className="absolute -top-20 -right-16 opacity-40">
              <circle cx="160" cy="160" r="140" fill="none" stroke="#fff" strokeWidth="1.5" />
              <circle cx="160" cy="160" r="95" fill="none" stroke="#fff" strokeWidth="1.5" />
              <circle cx="160" cy="160" r="50" fill="none" stroke="#fff" strokeWidth="1.5" />
            </svg>

            <div className="relative flex justify-between items-start">
              <div>
                <p className="text-2xl font-bold mb-1.5" style={{ color: '#2b1002' }}>
                  Mornin', {username}
                </p>
                <p className="text-sm max-w-[380px] leading-relaxed" style={{ color: '#7c3f0e' }}>
                  Let's find where you fit. Take the assessment to get personalized course recommendations.
                </p>
              </div>
              <div className="w-[42px] h-[42px] rounded-full bg-gray-900 flex items-center justify-center text-sm font-semibold text-white shrink-0">
                {username?.[0]?.toUpperCase()}
              </div>
            </div>

            <button
              onClick={() => navigate('/onboarding/profile')}
              className="relative inline-flex items-center gap-1.5 bg-gray-900 text-white px-5 py-3 rounded-xl text-sm font-medium hover:bg-gray-800 hover:-translate-y-0.5 hover:shadow-lg transition-all duration-200 w-fit"
            >
              Start assessment <IconArrowRight size={16} stroke={2} />
            </button>
          </div>

          {/* Assessment steps card */}
          <div
            className="rounded-[20px] px-6 py-[26px] flex flex-col justify-center shadow-[0_8px_30px_-10px_rgba(180,83,9,0.2)]"
            style={{ background: 'linear-gradient(160deg, #fff6ee 0%, #ffe9d6 100%)' }}
          >
            <p className="text-[11px] font-semibold uppercase tracking-wide mb-5" style={{ color: '#b45309' }}>
              Assessment steps
            </p>
            <div className="flex flex-col gap-[18px]">
              {steps.map((step) => (
                <div key={step.label} className="group flex items-center gap-2.5 cursor-default">
                  <div
                    className={`w-[22px] h-[22px] rounded-full shrink-0 flex items-center justify-center transition-all ${
                      step.done
                        ? 'bg-orange-500 border-2 border-orange-500'
                        : 'border-2 border-[#e0d4c8] bg-white'
                    }`}
                  >
                    {step.done && (
                      <span className="text-white text-xs font-bold">✓</span>
                    )}
                  </div>
                  <span className="text-sm text-[#8a6a4a] transition-colors group-hover:text-[#2b1002]">
                    {step.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* College card */}
        <div
          className="rounded-[20px] px-9 py-[30px] shadow-[0_8px_30px_-12px_rgba(0,0,0,0.12)]"
          style={{ background: 'linear-gradient(135deg, #f4f4f5 0%, #e8e9eb 100%)' }}
        >
          <div className="flex justify-between items-center">
            <div>
              <IconSchool size={22} stroke={1.75} className="text-gray-500" />
              <p className="font-semibold text-base mt-3 mb-1 text-gray-900">
                Already enrolled in college?
              </p>
              <p className="text-xs text-gray-500 max-w-[420px] leading-relaxed">
                Track your academic alignment, semester progress, and career roadmap.
              </p>
            </div>
            <button
              onClick={() => navigate('/college/setup')}
              className="inline-flex items-center gap-1.5 bg-gray-900 text-white px-5 py-3 rounded-xl text-sm font-medium hover:bg-gray-800 hover:-translate-y-0.5 hover:shadow-lg transition-all duration-200 shrink-0"
            >
              I'm in college <IconArrowRight size={16} stroke={2} />
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}

export default Dashboard