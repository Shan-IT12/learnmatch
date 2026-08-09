import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconSchool, IconArrowRight } from '@tabler/icons-react'

function Dashboard() {
  const navigate = useNavigate()
  const token = localStorage.getItem('token')
  const username = localStorage.getItem('username')

  useEffect(() => {
    if (!token) {
      navigate('/login')
    }
  }, [navigate, token])

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('userId')
    localStorage.removeItem('username')
    navigate('/login')
  }

  // Assessment steps — will become dynamic once we wire up real completion status
  const steps = [
    { label: 'Profile', done: false },
    { label: 'Interests', done: false },
    { label: 'Skills quiz', done: false },
    { label: 'Personality', done: false },
  ]

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
                  <div className="w-[22px] h-[22px] rounded-full border-2 border-[#e0d4c8] bg-white shrink-0 transition-all group-hover:bg-orange-500 group-hover:border-orange-500" />
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