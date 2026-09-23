import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  IconAlertTriangle,
  IconArrowRight,
  IconBook2,
  IconCalendar,
  IconChartLine,
  IconCircleCheck,
  IconClipboardCheck,
  IconRoute,
  IconSparkles,
  IconTrendingDown,
  IconTrendingUp,
} from '@tabler/icons-react'
import {
  CHECKIN_PHASES,
  getAlignmentTrend,
  getCurrentSemesterRecords,
  getNextAcademicStage,
  getNextCheckinPhase,
  getPreviousSemesterRecords,
  parseYearNumber,
  summarizeRoadmapOverview,
} from '../../utils/collegeTrackingView'

const STATUS_STYLES = {
  'On Track': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Monitor: 'bg-amber-50 text-amber-700 border-amber-200',
  'Needs Attention': 'bg-red-50 text-red-700 border-red-200',
}

function statusStyle(status) {
  return STATUS_STYLES[status] || 'bg-gray-50 text-gray-600 border-gray-200'
}

function formatCheckinDate(value) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

function AlignmentTrendChart({ records }) {
  const points = records.map((record) => {
    const phaseIndex = CHECKIN_PHASES.indexOf(record.phase)
    return {
      ...record,
      x: 72 + phaseIndex * 228,
      y: 138 - Number(record.alignmentPercent) * 0.92,
    }
  })

  return (
    <div className="overflow-x-auto" aria-label="Alignment percentage trend">
      <svg viewBox="0 0 600 180" className="min-w-[520px] w-full h-[180px]" role="img">
        {[25, 50, 75, 100].map((value) => {
          const y = 138 - value * 0.92
          return (
            <g key={value}>
              <line x1="54" x2="550" y1={y} y2={y} stroke="#f1f5f9" strokeWidth="1" />
              <text x="18" y={y + 4} fill="#94a3b8" fontSize="11">{value}%</text>
            </g>
          )
        })}
        {points.length > 1 && (
          <polyline
            points={points.map(({ x, y }) => `${x},${y}`).join(' ')}
            fill="none"
            stroke="#f97316"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        {points.map(({ phase, alignmentPercent, x, y }) => (
          <g key={phase}>
            <circle cx={x} cy={y} r="7" fill="#fff" stroke="#f97316" strokeWidth="4" />
            <text x={x} y={y - 14} textAnchor="middle" fill="#334155" fontSize="12" fontWeight="600">
              {alignmentPercent}%
            </text>
            <text x={x} y="164" textAnchor="middle" fill="#64748b" fontSize="12">{phase}</text>
          </g>
        ))}
      </svg>
    </div>
  )
}

function CollegeDashboard() {
  const navigate = useNavigate()
  const token = localStorage.getItem('token')
  const username = localStorage.getItem('username')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [collegeInfo, setCollegeInfo] = useState(null)
  const [checkinStatus, setCheckinStatus] = useState(null)
  const [history, setHistory] = useState([])
  const [courseRoadmap, setCourseRoadmap] = useState(null)
  const [startingCheckin, setStartingCheckin] = useState(false)
  const [advancingSemester, setAdvancingSemester] = useState(false)
  const [showNextSemesterForm, setShowNextSemesterForm] = useState(false)
  const [nextSemesterStartDate, setNextSemesterStartDate] = useState('')
  const [nextSemesterEndDate, setNextSemesterEndDate] = useState('')
  const [nextSemesterAcademicYear, setNextSemesterAcademicYear] = useState('')
  const [confirmedNextYearLevel, setConfirmedNextYearLevel] = useState('')
  const [confirmedNextSemester, setConfirmedNextSemester] = useState('')

  useEffect(() => {
    if (!token) {
      navigate('/login')
      return undefined
    }

    const controller = new AbortController()
    const fetchData = async () => {
      try {
        const headers = { Authorization: `Bearer ${token}` }
        const [collegeRes, statusRes, historyRes] = await Promise.all([
          fetch(`${import.meta.env.VITE_API_URL}/api/college/status`, { headers, signal: controller.signal }),
          fetch(`${import.meta.env.VITE_API_URL}/api/college/checkin/status`, { headers, signal: controller.signal }),
          fetch(`${import.meta.env.VITE_API_URL}/api/college/checkin/history?limit=50`, { headers, signal: controller.signal }),
        ])

        if (collegeRes.status === 401 || collegeRes.status === 403) {
          navigate('/login', { replace: true })
          return
        }
        if (collegeRes.status === 404) {
          navigate('/college/setup', { replace: true })
          return
        }
        if (!collegeRes.ok || !statusRes.ok) throw new Error('College tracking data is unavailable')

        const collegeData = await collegeRes.json()
        const statusData = await statusRes.json()
        const historyData = historyRes.ok ? await historyRes.json() : { history: [] }

        let roadmapData = null
        if (collegeData.courseCode) {
          const roadmapRes = await fetch(
            `${import.meta.env.VITE_API_URL}/api/public/courses/${encodeURIComponent(collegeData.courseCode)}`,
            { signal: controller.signal }
          )
          if (roadmapRes.ok) {
            const payload = await roadmapRes.json()
            roadmapData = payload.course || null
          }
        }

        setCollegeInfo(collegeData)
        setCheckinStatus(statusData)
        setHistory(Array.isArray(historyData.history) ? historyData.history : [])
        setCourseRoadmap(roadmapData)
      } catch (requestError) {
        if (requestError.name !== 'AbortError') {
          console.error('College dashboard fetch error:', requestError)
          setError('We could not load your tracking dashboard. Please try again.')
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    fetchData()
    return () => controller.abort()
  }, [navigate, token])

  const currentSemesterRecords = useMemo(
    () => getCurrentSemesterRecords(history, collegeInfo || {}),
    [history, collegeInfo]
  )
  const previousSemesterRecords = useMemo(
    () => getPreviousSemesterRecords(history, collegeInfo || {}),
    [history, collegeInfo]
  )
  const trend = getAlignmentTrend(currentSemesterRecords)
  const nextCheckinPhase = getNextCheckinPhase(checkinStatus)
  const latestResult = checkinStatus?.latestResult
  const latestAlignment = currentSemesterRecords.at(-1)?.alignmentPercent ?? latestResult?.alignmentPercent ?? null
  const currentYearNumber = parseYearNumber(collegeInfo?.yearLevel)
  const roadmapYears = courseRoadmap?.year_levels || []
  const currentRoadmapYear = roadmapYears.find(({ year }) => Number(year) === currentYearNumber)
  const checkinCardIsActionable = (checkinStatus?.availablePhases?.length || 0) > 0 || checkinStatus?.state === 'pending'
  const nextAcademicStage = getNextAcademicStage(
    collegeInfo?.yearLevel,
    collegeInfo?.semester,
    courseRoadmap?.program_duration_years,
    checkinStatus?.progressionEligible
  )
  const institutionDependentTerm = collegeInfo?.semester === '3rd Semester' || collegeInfo?.semester === 'Summer'
  const nextAcademicYear = useMemo(() => {
    const match = String(collegeInfo?.academicYear || '').match(/^(\d{4})-(\d{4})$/)
    if (!match) return ''
    if (collegeInfo?.semester === '1st Semester') return collegeInfo.academicYear
    return `${Number(match[1]) + 1}-${Number(match[2]) + 1}`
  }, [collegeInfo])
  const displayedTrackingPhase = collegeInfo?.expectedPhase || collegeInfo?.initialTrackingPhase
  const timingHeading = collegeInfo?.timingEstimated
    ? 'Estimated Semester Progress'
    : collegeInfo?.timingAvailable
      ? 'Semester Progress'
      : collegeInfo?.timingMode === 'phase_only'
        ? 'Current Tracking Phase'
        : 'Semester Timing'
  const timingValue = collegeInfo?.timingAvailable
    ? `${collegeInfo.semesterProgress}%`
    : displayedTrackingPhase || 'Not set'

  const handleStartCheckin = async (phase = null) => {
    if (checkinStatus?.state === 'pending' && (!phase || phase === checkinStatus.phase)) {
      navigate('/college/checkin')
      return
    }

    setStartingCheckin(true)
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/college/checkin/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ phase }),
      })
      if (response.ok) navigate('/college/checkin')
      else setError('We could not start the next check-in. Please try again.')
    } catch {
      setError('We could not start the next check-in. Please try again.')
    } finally {
      setStartingCheckin(false)
    }
  }

  const handleStartNextSemester = async () => {
    setAdvancingSemester(true)
    setError('')
    try {
      if (!nextSemesterStartDate || !nextSemesterEndDate || nextSemesterEndDate <= nextSemesterStartDate) {
        setError('Enter valid dates for the next semester.')
        setAdvancingSemester(false)
        return
      }
      if (institutionDependentTerm && (!confirmedNextYearLevel || !confirmedNextSemester)) {
        setError('Confirm the next year level and semester for this institution-dependent term.')
        setAdvancingSemester(false)
        return
      }
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/college/semester/advance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          academicYear: nextSemesterAcademicYear || nextAcademicYear,
          semesterStartDate: nextSemesterStartDate,
          semesterEndDate: nextSemesterEndDate,
          nextYearLevel: institutionDependentTerm ? confirmedNextYearLevel : undefined,
          nextSemester: institutionDependentTerm ? confirmedNextSemester : undefined,
        }),
      })
      const payload = await response.json()
      if (!response.ok) {
        setError(payload.message || 'We could not start the next semester.')
        return
      }
      navigate(0)
    } catch {
      setError('We could not start the next semester. Please try again.')
    } finally {
      setAdvancingSemester(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-sm text-gray-400">Loading your alignment journey...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b border-gray-100 px-4 sm:px-8 lg:px-14 py-[18px] flex justify-between items-center">
        <button onClick={() => navigate('/dashboard')} className="text-lg font-bold text-gray-900 hover:opacity-80 transition">
          Learn<span className="text-orange-500">Match</span>
        </button>
        <div className="flex items-center gap-3 sm:gap-4">
          <span className="hidden sm:inline text-sm text-gray-500">
            Welcome, <strong className="text-gray-900">{username}</strong>
          </span>
          <button onClick={() => navigate('/feedback')} className="text-sm text-gray-500 hover:text-gray-900 transition">
            Feedback
          </button>
          <button onClick={() => navigate('/dashboard')} className="text-sm text-gray-500 hover:text-gray-900 transition">
            Dashboard
          </button>
        </div>
      </nav>

      <main className="max-w-[1280px] mx-auto px-4 sm:px-8 lg:px-12 py-8 lg:py-11 space-y-6">
        {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">{error}</div>}

        <section className="rounded-[20px] p-6 sm:p-8 bg-orange-100 border border-orange-200">
          <div className="grid lg:grid-cols-[1.5fr_1fr] gap-8 items-end">
            <div>
              <p className="text-sm font-semibold text-orange-700 mb-2">Career Alignment Tracking</p>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-950">{collegeInfo?.courseName}</h1>
              <p className="text-sm text-orange-900/75 mt-2">
                {[collegeInfo?.yearLevel, collegeInfo?.semester].filter(Boolean).join(' • ')}
              </p>
              {collegeInfo?.academicYear && <p className="text-sm text-orange-900/75 mt-1">AY {collegeInfo.academicYear.replace('-', '–')}</p>}
              <p className="text-sm text-gray-700 mt-5 max-w-2xl leading-relaxed">
                See where you are in your course roadmap and how your alignment develops through each semester check-in.
              </p>
            </div>
            <div className="grid sm:grid-cols-2 gap-4 sm:gap-6 lg:border-l lg:border-orange-300 lg:pl-8">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Academic / Program</p>
                <p className="text-xs text-gray-500 mt-2">{timingHeading}</p>
                <p className="text-lg font-bold text-gray-900 mt-1">{timingValue}</p>
                {collegeInfo?.timingAvailable && (
                  <p className="text-sm text-gray-600 mt-1">
                    {collegeInfo.timingEstimated ? 'Estimated Current Phase' : 'Current Phase'}: {collegeInfo.expectedPhase}
                  </p>
                )}
                {!collegeInfo?.timingEstimated && collegeInfo?.semesterStartDate && collegeInfo?.semesterEndDate && (
                  <p className="text-xs text-gray-500 mt-1">
                    {formatCheckinDate(collegeInfo.semesterStartDate)} – {formatCheckinDate(collegeInfo.semesterEndDate)}
                  </p>
                )}
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Career Alignment</p>
                <p className="text-lg font-bold text-gray-900 mt-2">{latestResult?.status || 'Not checked yet'}</p>
                <p className="text-sm text-gray-600 mt-1">{latestAlignment === null ? 'Complete your first check-in' : `${latestAlignment}% aligned`}</p>
              </div>
            </div>
          </div>
          {collegeInfo?.timingMode === 'manual' && (
            <div className="mt-5 rounded-xl bg-white/70 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <p className="text-sm text-orange-900">Semester timing not set. You can still complete your check-ins in order.</p>
              <button type="button" onClick={() => navigate('/college/setup')} className="text-sm font-semibold text-orange-700 hover:text-orange-800">Add semester schedule</button>
            </div>
          )}
        </section>

        <section className="bg-white rounded-[20px] shadow-sm p-5 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
            <div>
              <div className="flex items-center gap-2 text-orange-600 mb-1">
                <IconRoute size={19} stroke={1.8} />
                <p className="text-base font-semibold">Course Roadmap</p>
              </div>
              <h2 className="text-2xl font-bold text-gray-900">You are here in your program</h2>
            </div>
            {courseRoadmap?.program_duration_years && (
              <span className="self-start rounded-full bg-orange-50 text-orange-700 border border-orange-100 px-3 py-1.5 text-xs font-semibold">
                {courseRoadmap.program_duration_years}-year program
              </span>
            )}
          </div>

          {roadmapYears.length > 0 ? (
            <div className="relative">
              <div className="hidden sm:block absolute left-8 right-8 top-7 h-0.5 bg-gray-200" />
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-5 relative">
                {roadmapYears.map((yearLevel) => {
                  const year = Number(yearLevel.year)
                  const isCompleted = currentYearNumber !== null && year < currentYearNumber
                  const isCurrent = year === currentYearNumber
                  return (
                    <article
                      key={year}
                      className={`rounded-xl p-4 relative ${
                        isCurrent
                          ? 'bg-orange-50 ring-2 ring-orange-400'
                          : isCompleted
                            ? 'bg-emerald-50'
                            : 'bg-gray-50'
                      }`}
                    >
                      <div className={`w-14 h-14 rounded-full flex items-center justify-center font-bold text-sm border-4 border-white shadow-sm ${
                        isCurrent ? 'bg-orange-500 text-white' : isCompleted ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {isCompleted ? '✓' : year}
                      </div>
                      <div className="mt-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-bold text-gray-900">{yearLevel.label || `Year ${year}`}</h3>
                        </div>
                        <p className={`text-sm font-medium mt-1 ${isCurrent ? 'text-orange-700' : isCompleted ? 'text-emerald-700' : 'text-gray-500'}`}>
                          {isCurrent ? `Current · ${collegeInfo?.semester}` : isCompleted ? '✓ Completed' : 'Upcoming'}
                        </p>
                        {isCurrent && (
                          <div className="mt-4 rounded-lg bg-white px-3 py-3">
                            <p className="text-sm font-semibold text-gray-800">{collegeInfo?.semester}</p>
                            {collegeInfo?.timingAvailable && (
                              <div className="mt-3">
                                <div className="flex justify-between text-xs text-gray-500"><span>{collegeInfo.timingEstimated ? 'Estimated semester progress' : 'Semester progress'}</span><span>{collegeInfo.semesterProgress}%</span></div>
                                <div className="h-2 rounded-full bg-gray-100 mt-1 overflow-hidden"><div className="h-full bg-orange-500" style={{ width: `${collegeInfo.semesterProgress}%` }} /></div>
                              </div>
                            )}
                            <div className="space-y-2 mt-3 text-xs">
                              {CHECKIN_PHASES.map((phase) => {
                                const state = checkinStatus?.phaseStates?.find((item) => item.phase === phase)?.state || 'upcoming'
                                const labels = { completed: '✓ Completed', available: '● Available now', missed_available: '● Missed / Still available', not_recorded: 'Not recorded', upcoming: '○ Upcoming' }
                                return (
                                  <div key={phase} className="flex justify-between gap-2">
                                    <span className="font-semibold text-gray-700">{phase}</span>
                                    <span className={state === 'completed' ? 'text-emerald-700' : state.includes('available') ? 'text-orange-700' : 'text-gray-400'}>{labels[state]}</span>
                                  </div>
                                )
                              })}
                            </div>
                            {checkinStatus?.progressionEligible && (
                              <div className="mt-3 pt-3 border-t border-gray-100">
                                <p className="text-sm font-semibold text-emerald-700">
                                  {checkinStatus.semesterTrackingCompleted ? 'Semester tracking completed' : 'All alignment check-ins completed'}
                                </p>
                                {collegeInfo?.semester === '2nd Semester' && (
                                  <p className="text-sm font-semibold text-gray-900 mt-1">{collegeInfo.yearLevel} completed</p>
                                )}
                                {nextAcademicStage?.programCompleted ? (
                                  <p className="text-sm text-gray-700 mt-1">Program roadmap completed</p>
                                ) : nextAcademicStage || institutionDependentTerm ? (
                                  <>
                                    <p className="text-sm text-gray-500 mt-2">Next:</p>
                                    <p className="text-sm font-semibold text-gray-900">
                                      {nextAcademicStage
                                        ? `${nextAcademicStage.yearLevel} · ${nextAcademicStage.semester}`
                                        : 'Confirmation required for this institution-dependent term'}
                                    </p>
                                    <button
                                      type="button"
                                      onClick={() => setShowNextSemesterForm((visible) => !visible)}
                                      className="mt-3 w-full bg-orange-500 text-white px-3 py-2 rounded-lg text-sm font-semibold hover:bg-orange-600 disabled:opacity-50"
                                    >
                                      Start Next Semester
                                    </button>
                                    {showNextSemesterForm && (
                                      <div className="mt-3 space-y-2">
                                        <p className="text-xs text-gray-500">Confirm the new semester and its student-provided dates.</p>
                                        {institutionDependentTerm && (
                                          <>
                                            <p className="text-xs text-orange-700">LearnMatch cannot assume what follows a Third Semester or Summer term. Select the next academic stage explicitly.</p>
                                            <select value={confirmedNextYearLevel} onChange={(event) => setConfirmedNextYearLevel(event.target.value)} className="w-full border border-gray-200 rounded-lg px-2 py-2 text-xs">
                                              <option value="">Next year level</option>
                                              {['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year'].map((year) => <option key={year} value={year}>{year}</option>)}
                                            </select>
                                            <select value={confirmedNextSemester} onChange={(event) => setConfirmedNextSemester(event.target.value)} className="w-full border border-gray-200 rounded-lg px-2 py-2 text-xs">
                                              <option value="">Next semester</option>
                                              {['1st Semester', '2nd Semester', '3rd Semester', 'Summer'].map((semester) => <option key={semester} value={semester}>{semester}</option>)}
                                            </select>
                                          </>
                                        )}
                                        <input
                                          type="text"
                                          aria-label="Next academic year"
                                          placeholder="2026-2027"
                                          value={nextSemesterAcademicYear || nextAcademicYear}
                                          readOnly={Boolean(nextAcademicYear)}
                                          onChange={(event) => setNextSemesterAcademicYear(event.target.value)}
                                          className="w-full border border-gray-200 rounded-lg px-2 py-2 text-xs read-only:bg-gray-50"
                                        />
                                        <input type="date" value={nextSemesterStartDate} onChange={(event) => setNextSemesterStartDate(event.target.value)} className="w-full border border-gray-200 rounded-lg px-2 py-2 text-xs" />
                                        <input type="date" min={nextSemesterStartDate || undefined} value={nextSemesterEndDate} onChange={(event) => setNextSemesterEndDate(event.target.value)} className="w-full border border-gray-200 rounded-lg px-2 py-2 text-xs" />
                                        <button type="button" onClick={handleStartNextSemester} disabled={advancingSemester} className="w-full bg-gray-950 text-white px-3 py-2 rounded-lg text-xs font-semibold disabled:opacity-50">{advancingSemester ? 'Starting...' : 'Confirm and start'}</button>
                                      </div>
                                    )}
                                  </>
                                ) : null}
                              </div>
                            )}
                          </div>
                        )}
                        <p className="text-sm leading-relaxed text-gray-600 mt-4">{summarizeRoadmapOverview(yearLevel.overview)}</p>
                      </div>
                    </article>
                  )
                })}
              </div>
              {currentRoadmapYear && (
                <div className="mt-6 rounded-xl bg-orange-50 p-5 sm:p-6 flex gap-4">
                  <IconBook2 size={22} className="text-orange-600 shrink-0" stroke={1.8} />
                  <div>
                    <p className="font-semibold text-gray-900">What to develop now</p>
                    <p className="text-sm leading-relaxed text-gray-600 mt-2">{currentRoadmapYear.overview}</p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-2xl bg-gray-50 px-5 py-8 text-center text-sm text-gray-500">
              The roadmap for this course is currently unavailable.
            </div>
          )}
        </section>

        <section className="bg-white rounded-[20px] shadow-sm p-5 sm:p-8">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2 text-orange-600 mb-1">
                <IconChartLine size={19} stroke={1.8} />
                <p className="text-base font-semibold">Alignment Journey</p>
              </div>
              <h2 className="text-2xl font-bold text-gray-900">{collegeInfo?.semester} check-ins</h2>
              <p className="text-sm text-gray-500 mt-1">Your stored Early, Mid, and End results show how alignment changes over time.</p>
            </div>
              <div className="rounded-xl bg-gray-50 px-4 py-3 min-w-0 sm:min-w-[220px]">
              <p className="text-sm text-gray-500">Current trend</p>
              {trend.direction === 'insufficient' ? (
                <p className="text-sm font-semibold text-gray-600 mt-1">More check-ins needed</p>
              ) : (
                <div className="flex items-center gap-2 mt-1">
                  {trend.direction === 'improving' && <IconTrendingUp size={20} className="text-emerald-600" />}
                  {trend.direction === 'declining' && <IconTrendingDown size={20} className="text-red-600" />}
                  {trend.direction === 'stable' && <IconChartLine size={20} className="text-blue-600" />}
                  <p className="text-sm font-semibold capitalize text-gray-800">
                    {trend.direction}{trend.delta !== 0 && ` · ${trend.delta > 0 ? '+' : ''}${trend.delta} points`}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {CHECKIN_PHASES.map((phase) => {
              const record = currentSemesterRecords.find((item) => item.phase === phase)
              const phaseState = checkinStatus?.phaseStates?.find((item) => item.phase === phase)?.state || 'upcoming'
              const isAvailable = phaseState === 'available' || phaseState === 'missed_available'
              const isInitialAvailable = currentSemesterRecords.length === 0 && phaseState === 'available' && phase === collegeInfo?.initialTrackingPhase
              const stateLabel = phaseState === 'not_recorded'
                ? 'Not recorded'
                : phaseState === 'missed_available'
                  ? 'Missed / Still available'
                  : phaseState === 'available'
                    ? isInitialAvailable ? 'Start here / Available now' : 'Available now'
                    : 'Upcoming'
              return (
                <article key={phase} className={`rounded-xl p-5 ${record ? 'bg-gray-50' : isAvailable ? 'bg-orange-50' : 'bg-gray-50/60'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm text-gray-500 font-medium">{phase} check-in</p>
                      {record ? (
                        <p className="text-3xl font-bold text-gray-950 mt-2">{record.alignmentPercent}%</p>
                      ) : (
                        <p className="text-lg font-semibold text-gray-500 mt-2">{stateLabel}</p>
                      )}
                    </div>
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center ${record ? 'bg-orange-100 text-orange-600' : 'bg-white text-gray-400 border border-gray-200'}`}>
                      {record ? <IconCircleCheck size={19} /> : <IconCalendar size={18} />}
                    </div>
                  </div>
                  {record ? (
                    <>
                      <span className={`inline-flex border rounded-full px-2.5 py-1 text-[10px] font-bold mt-4 ${statusStyle(record.status)}`}>{record.status}</span>
                      <p className="text-xs text-gray-400 mt-3">{formatCheckinDate(record.checkinDate) || 'Completion date unavailable'}</p>
                    </>
                  ) : (
                    <div className="mt-4">
                      <p className="text-xs text-gray-400">No stored result for this phase.</p>
                      {isAvailable && (
                        <button type="button" onClick={() => handleStartCheckin(phase)} disabled={startingCheckin} className="mt-3 text-xs font-semibold text-orange-700 hover:text-orange-800 disabled:opacity-50">
                          Start {phase} check-in →
                        </button>
                      )}
                    </div>
                  )}
                </article>
              )
            })}
          </div>

          {currentSemesterRecords.length > 0 ? (
            <div className="mt-6 rounded-xl bg-slate-50 p-3 sm:p-5">
              <AlignmentTrendChart records={currentSemesterRecords} />
              {currentSemesterRecords.length === 1 && (
                <p className="text-xs text-gray-500 text-center pb-2">One result is shown. Complete another phase to see a trend.</p>
              )}
            </div>
          ) : (
            <div className="mt-6 rounded-2xl bg-orange-50 border border-orange-100 p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <p className="font-semibold text-gray-900">Start your alignment journey</p>
                <p className="text-sm text-gray-600 mt-1">Your first completed check-in will establish the starting point for this semester.</p>
              </div>
              {checkinCardIsActionable && (
                <button onClick={() => handleStartCheckin(nextCheckinPhase)} disabled={startingCheckin} className="inline-flex items-center justify-center gap-2 bg-orange-500 text-white px-5 py-3 rounded-xl text-sm font-semibold hover:bg-orange-600 transition disabled:opacity-50">
                  {startingCheckin ? 'Starting...' : 'Start first check-in'} <IconArrowRight size={16} />
                </button>
              )}
            </div>
          )}
        </section>

        <div className="grid lg:grid-cols-[1.2fr_0.8fr] gap-6">
          <section className="bg-white rounded-[20px] shadow-sm p-5 sm:p-7">
            <div className="flex items-center gap-2 text-orange-600 mb-2">
              <IconSparkles size={18} stroke={1.8} />
              <h2 className="text-lg font-bold text-gray-900">Latest Alignment Insight</h2>
            </div>
            {latestResult ? (
              <div className="mt-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className={`inline-flex border rounded-full px-3 py-1.5 text-xs font-bold ${statusStyle(latestResult.status)}`}>{latestResult.status}</span>
                  <span className="text-sm font-semibold text-gray-700">{latestAlignment}% aligned</span>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed mt-4">{latestResult.feedback}</p>
                <p className="text-sm text-gray-700 leading-relaxed mt-3 font-medium">{latestResult.recommendation}</p>
                <p className="text-[11px] text-gray-400 mt-4">This insight explains your deterministic result; it does not determine your status.</p>
              </div>
            ) : (
              <p className="text-sm text-gray-500 mt-4">Complete your first check-in to receive an alignment status and supporting insight.</p>
            )}
          </section>

          <section className={`rounded-[24px] p-6 border transition ${checkinCardIsActionable ? 'border-orange-200 bg-orange-50' : 'border-gray-100 bg-white'}`}>
            <IconClipboardCheck size={24} stroke={1.7} className={checkinCardIsActionable ? 'text-orange-500' : 'text-gray-400'} />
            <p className="font-bold text-gray-900 mt-4">
              {checkinStatus?.state === 'pending' && `Your ${nextCheckinPhase} check-in is ready`}
              {checkinStatus?.state === 'due' && `Your ${nextCheckinPhase} check-in is ready`}
              {checkinStatus?.state === 'not_due' && `Next up: ${nextCheckinPhase} check-in`}
              {checkinStatus?.state === 'complete' && 'All check-ins completed this semester'}
            </p>
            <p className="text-sm text-gray-500 leading-relaxed mt-2">
              {checkinCardIsActionable ? 'Take about a minute to record how your course experience feels right now.' : 'Your completed results remain available in your alignment history.'}
            </p>
            {checkinCardIsActionable && (
              <button onClick={() => handleStartCheckin(nextCheckinPhase)} disabled={startingCheckin} className="mt-5 inline-flex items-center gap-2 bg-gray-950 text-white px-5 py-3 rounded-xl text-sm font-semibold disabled:opacity-50">
                {startingCheckin ? 'Starting...' : `Start ${nextCheckinPhase} check-in`} <IconArrowRight size={16} />
              </button>
            )}
          </section>
        </div>

        <section className="bg-white rounded-[20px] shadow-sm p-5 sm:p-7">
          <div className="flex items-center gap-2 text-gray-500 mb-2">
            <IconCalendar size={18} stroke={1.8} />
            <h2 className="text-lg font-bold text-gray-900">Previous Semester History</h2>
          </div>
          <p className="text-sm text-gray-500 mb-5">Earlier records are preserved so you can review your progress over time.</p>
          {previousSemesterRecords.length === 0 ? (
            <p className="text-sm text-gray-400 rounded-2xl bg-gray-50 px-5 py-6">No previous semester check-ins yet.</p>
          ) : (
            <div className="space-y-3">
              {previousSemesterRecords.map((record) => (
                <article key={record.checkinId} className="border border-gray-100 rounded-2xl px-4 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900">{record.yearLevel} · {record.semester} · {record.phase}</p>
                      <span className={`inline-flex border rounded-full px-2 py-0.5 text-[9px] font-bold ${statusStyle(record.status)}`}>{record.status}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">{formatCheckinDate(record.checkinDate) || 'Date unavailable'}</p>
                  </div>
                  <div className="sm:text-right">
                    <p className="text-lg font-bold text-orange-500">{record.alignmentPercent}%</p>
                    <p className="text-xs text-gray-400">GWA: {record.gwa ?? 'Not recorded'}</p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        {latestResult?.status === 'Needs Attention' && (
          <div className="rounded-2xl border border-red-100 bg-red-50 px-5 py-4 flex gap-3">
            <IconAlertTriangle size={20} className="text-red-500 shrink-0" />
            <p className="text-sm text-red-700">Your latest result suggests that additional support may help. Consider discussing the insight above with an adviser or someone you trust.</p>
          </div>
        )}
      </main>
    </div>
  )
}

export default CollegeDashboard
