import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconArrowRight, IconClipboardCheck, IconRoute, IconBulb, IconAlertTriangle, IconCircleCheck } from '@tabler/icons-react'

const PHASE_ORDER = ['Early', 'Mid', 'End']
const PHASE_FRACTION = { Early: 0, Mid: 0.5, End: 1 }

const dailyTips = [
  "Break big deadlines into small weekly goals — it's less overwhelming and easier to track.",
  "Review your notes within 24 hours of class. It cuts down study time later by a lot.",
  "If a topic isn't clicking, try explaining it out loud to someone else — or even to yourself.",
  "Sleep matters more than one extra hour of cramming. Your brain needs it to actually retain things.",
  "Talk to your professors during consultation hours — most students never do, and it helps a lot.",
  "Group study works best when everyone preps beforehand — otherwise it's just chatting.",
  "Track your grades as they come in, not just before finals. Fewer surprises that way.",
  "It's okay to ask for an extension. Professors respect students who communicate early.",
  "Pick one hard task to do first thing in the day — it makes everything after feel easier.",
  "Take actual breaks. Scrolling your phone for 10 minutes isn't the same as resting.",
]

function getDailyTip() {
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24)
  )
  return dailyTips[dayOfYear % dailyTips.length]
}

function parseYearNumber(yearLevel) {
  if (!yearLevel) return 1
  const match = yearLevel.match(/\d+/)
  return match ? Number(match[0]) : 1
}

function parseSemesterNumber(semester) {
  if (!semester) return 1
  if (semester.includes('1st')) return 1
  if (semester.includes('2nd')) return 2
  return 2
}

function computeRoadmapProgress(yearLevel, semester, currentPhase) {
  const yearNum = parseYearNumber(yearLevel)
  const semNum = parseSemesterNumber(semester)
  const completedFullSemesters = (yearNum - 1) * 2 + (semNum - 1)
  const phaseFraction = PHASE_FRACTION[currentPhase] ?? 0
  const progress = ((completedFullSemesters + phaseFraction) / 8) * 100
  return Math.min(Math.round(progress), 100)
}

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
      <div className="min-h-screen flex items-center justify-center bg-white">
        <p className="text-sm text-gray-400">Loading...</p>
      </div>
    )
  }

  const checkinCardIsActionable = checkinStatus?.state === 'pending' || checkinStatus?.state === 'due'
  const currentPhase = checkinStatus?.currentPhase || 'Early'
  const roadmapProgress = computeRoadmapProgress(
    collegeInfo?.yearLevel,
    collegeInfo?.semester,
    currentPhase
  )
  const isMismatch = checkinStatus?.latestResult && checkinStatus.latestResult.status !== 'Good Alignment'

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
            onClick={() => navigate('/feedback')}
            className="text-sm text-gray-500 hover:text-gray-900 transition"
          >
            Feedback
          </button>
          <button
            onClick={() => navigate('/dashboard')}
            className="text-sm text-gray-500 hover:text-gray-900 transition"
          >
            Dashboard
          </button>
        </div>
      </nav>

      <div className="max-w-[1320px] mx-auto px-14 py-11">

        {checkinStatus?.latestResult && (
          <div
            className={`rounded-2xl px-6 py-4 mb-5 flex items-start gap-3 ${
              isMismatch ? 'bg-orange-50 border border-orange-100' : 'bg-green-50 border border-green-100'
            }`}
          >
            {isMismatch ? (
              <IconAlertTriangle size={20} stroke={1.75} className="text-orange-500 shrink-0 mt-0.5" />
            ) : (
              <IconCircleCheck size={20} stroke={1.75} className="text-green-600 shrink-0 mt-0.5" />
            )}
            <div>
              <p className="text-sm font-semibold text-gray-900">
                {isMismatch
                  ? `We noticed a possible mismatch — ${checkinStatus.latestResult.status}`
                  : "You're a good match with this course"}
              </p>
              <p className="text-xs text-gray-600 mt-1 leading-relaxed max-w-2xl">
                {checkinStatus.latestResult.recommendation}
              </p>
            </div>
          </div>
        )}

        <div
          className="rounded-[20px] p-10 relative overflow-hidden mb-5 shadow-[0_8px_30px_-8px_rgba(249,115,22,0.35)]"
          style={{ background: 'linear-gradient(135deg, #ffe4c4 0%, #ffd0a8 40%, #ffb8a8 100%)' }}
        >
          <svg width="320" height="320" viewBox="0 0 320 320" className="absolute -top-20 -right-16 opacity-40">
            <circle cx="160" cy="160" r="140" fill="none" stroke="#fff" strokeWidth="1.5" />
            <circle cx="160" cy="160" r="95" fill="none" stroke="#fff" strokeWidth="1.5" />
            <circle cx="160" cy="160" r="50" fill="none" stroke="#fff" strokeWidth="1.5" />
          </svg>
          <p className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: '#b45309' }}>
            Currently Enrolled
          </p>
          <p className="text-2xl font-bold mb-1.5 relative" style={{ color: '#2b1002' }}>
            {collegeInfo?.courseName}
          </p>
          <p className="text-sm relative" style={{ color: '#7c3f0e' }}>
            {collegeInfo?.yearLevel} · {collegeInfo?.semester}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-5 mb-5">

          <div className="rounded-[20px] px-7 py-6 border border-gray-100 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide mb-5 text-gray-400">
              Semester Progress
            </p>
            <div className="flex items-center justify-between relative">
              <div className="absolute top-3 left-0 right-0 h-px bg-gray-200 z-0" />
              <div
                className="absolute top-3 left-0 h-px bg-orange-500 z-0 transition-all duration-500"
                style={{ width: `${(PHASE_ORDER.indexOf(currentPhase) / (PHASE_ORDER.length - 1)) * 100}%` }}
              />
              {PHASE_ORDER.map((phase, index) => {
                const isPast = index < PHASE_ORDER.indexOf(currentPhase)
                const isCurrent = phase === currentPhase
                return (
                  <div key={phase} className="flex flex-col items-center z-10">
                    <div
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                        isPast || isCurrent ? 'bg-orange-500 border-orange-500' : 'bg-white border-gray-300'
                      }`}
                    >
                      {(isPast || (isCurrent && checkinStatus?.state !== 'pending')) && (
                        <span className="text-white text-xs">✓</span>
                      )}
                    </div>
                    <span className={`text-xs mt-2 font-medium ${isCurrent ? 'text-orange-500' : 'text-gray-400'}`}>
                      {phase}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="rounded-[20px] px-7 py-6 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <IconRoute size={16} stroke={1.75} className="text-gray-400" />
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                Career Roadmap Progress
              </p>
            </div>
            <p className="text-2xl font-bold text-gray-900 mb-3">{roadmapProgress}%</p>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-orange-500 rounded-full transition-all"
                style={{ width: `${roadmapProgress}%` }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-2">Estimated based on a standard 4-year program.</p>
          </div>
        </div>

        <div
          className="rounded-[20px] px-7 py-6 mb-5 shadow-[0_8px_30px_-10px_rgba(180,83,9,0.2)]"
          style={{ background: 'linear-gradient(160deg, #fff6ee 0%, #ffe9d6 100%)' }}
        >
          <div className="flex items-center gap-2 mb-3">
            <IconBulb size={16} stroke={1.75} style={{ color: '#b45309' }} />
            <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#b45309' }}>
              Tip of the Day
            </p>
          </div>
          <p className="text-sm text-gray-700 leading-relaxed max-w-2xl">{getDailyTip()}</p>
        </div>

        <div
          onClick={checkinCardIsActionable ? handleStartCheckin : undefined}
          className={`rounded-[20px] px-9 py-[30px] shadow-[0_8px_30px_-12px_rgba(0,0,0,0.12)] transition ${
            checkinCardIsActionable ? 'cursor-pointer hover:-translate-y-0.5' : ''
          }`}
          style={{ background: 'linear-gradient(135deg, #f4f4f5 0%, #e8e9eb 100%)' }}
        >
          <div className="flex justify-between items-center">
            <div>
              <IconClipboardCheck size={22} stroke={1.75} className="text-gray-500" />
              <p className="font-semibold text-base mt-3 mb-1 text-gray-900">
                {checkinStatus?.state === 'pending' && 'Your check-in is ready'}
                {checkinStatus?.state === 'due' && `Your ${checkinStatus.nextPhase} check-in is ready`}
                {checkinStatus?.state === 'not_due' && `Next up: ${checkinStatus.nextPhase} check-in`}
                {checkinStatus?.state === 'complete' && 'All check-ins done this semester'}
              </p>
              <p className="text-xs text-gray-500 max-w-[420px] leading-relaxed">
                {checkinCardIsActionable
                  ? "Takes about a minute — let's see how things are going."
                  : "Come back when it's time and we'll let you know."}
              </p>
            </div>
            {checkinCardIsActionable && (
              <button
                disabled={startingCheckin}
                className="inline-flex items-center gap-1.5 bg-gray-900 text-white px-5 py-3 rounded-xl text-sm font-medium hover:bg-gray-800 hover:-translate-y-0.5 hover:shadow-lg transition-all duration-200 shrink-0 disabled:opacity-50"
              >
                {startingCheckin ? 'Starting...' : 'Start Check-in'} <IconArrowRight size={16} stroke={2} />
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}

export default CollegeDashboard