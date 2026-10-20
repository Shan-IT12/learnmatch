import { clearUserAuth } from '../../utils/userAuth'
import CollegeProgramRoadmap from '../../components/CollegeProgramRoadmap'
import './collegeDashboard.css'
import LogoutButton from '../../components/LogoutButton'
import { IconLogout, IconMessageCircle } from '@tabler/icons-react'
import HeaderBrand, { HeaderAccount } from '../../components/HeaderBrand'
import { collegePlaceholder, coursePlaceholder } from '../../data/loadingPlaceholders'
import SkeletonContent from '../../components/SkeletonContent'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import CourseName from '../../components/CourseName'
import SuccessConfirmation from '../../components/SuccessConfirmation'
import ActionConfirmationModal from '../../components/ActionConfirmationModal'
import { waitForSuccessConfirmation } from '../../utils/successConfirmation'
import {
  IconAlertTriangle,
  IconArrowRight,
  IconCalendar,
  IconChevronDown,
  IconHistory,
  IconLayoutDashboard,
  IconSettings,
  IconChartLine,
  IconCircleCheck,
  IconClipboardCheck,
  IconRoute,
  IconRefresh,
  IconSparkles,
  IconTrendingDown,
  IconTrendingUp,
} from '@tabler/icons-react'
import {
  CHECKIN_PHASES,
  getAlignmentTrend,
  getCheckinHistoryRecords,
  getCurrentSemesterRecords,
  getNextAcademicStage,
  getNextCheckinPhase,
  hasDisplayableGwa,
  parseYearNumber,
} from '../../utils/collegeTrackingView'
import { FieldError, RequiredMark } from '../../components/FormValidation'
import { scrollToFirstInvalidField } from '../../utils/formValidation'
import { getCalendarTerms, resolveCalendarTerm } from '../../constants/academicCalendars'
import { beginAssessmentAttempt } from '../../utils/assessmentSession'
import { ApproximateScheduleFields } from './CollegeSetup'
import { getAcademicYearOptions, isApproximateEndAfterStart } from '../../utils/collegeSchedule'

const STATUS_STYLES = {
  'On Track': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Monitor: 'bg-amber-50 text-amber-700 border-amber-200',
  'Needs Attention': 'bg-red-50 text-red-700 border-red-200',
}
const STATUS_LABELS = {
  'On Track': 'Going Well',
  Monitor: 'Keep an Eye On',
  'Needs Attention': 'Support Recommended',
}

function statusStyle(status) {
  return STATUS_STYLES[status] || 'bg-gray-50 text-gray-600 border-gray-200'
}

function statusLabel(status) {
  return STATUS_LABELS[status] || status
}

function formatCheckinDate(value) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat('en-PH', {
    month: 'long',
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
    <div aria-label="Alignment percentage trend">
      <div className="grid grid-cols-3 gap-2 sm:hidden">{CHECKIN_PHASES.map(phase => {
        const record = records.find(item => item.phase === phase)
        return <div key={phase} className="rounded-xl border border-gray-100 bg-gray-50 px-2 py-4 text-center"><p className="text-xs font-medium text-gray-500">{phase}</p><p className="mt-2 text-lg font-bold text-orange-600">{record ? `${record.alignmentPercent}%` : '-'}</p><p className="mt-1 text-[10px] text-gray-400">{record ? 'Alignment' : 'No result'}</p></div>
      })}</div>
      <svg viewBox="0 0 600 180" className="hidden h-auto max-h-56 w-full sm:block" role="img" aria-label="Alignment across Early, Mid and End check-ins">
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

export function CheckinProgress({ completedPhases = [], phaseStates = [], nextPhase = 'Early' }) {
  const completed = CHECKIN_PHASES.filter((phase) => completedPhases.includes(phase))
  const completedCount = completed.length
  const furthestCompletedIndex = Math.max(-1, ...completed.map((phase) => CHECKIN_PHASES.indexOf(phase)))
  const progressPercent = [0, 33, 66, 100][furthestCompletedIndex + 1]
  const currentPhase = completed.at(-1) || null
  const nextPhaseIndex = CHECKIN_PHASES.indexOf(nextPhase)

  return (
    <section aria-label="Term check-in progress" className="college-panel h-full">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-orange-600">Term Check-in Progress</p>
          <h3 className="mt-1 text-xl font-bold text-gray-950">{completedCount} of 3 check-ins completed</h3>
        </div>
        <p className="text-2xl font-bold text-orange-600">{progressPercent}%</p>
      </div>
      <div className="mt-5 h-3 overflow-hidden rounded-full bg-orange-100" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={progressPercent} aria-label={`${progressPercent}% through the Early to End check-in cycle`}>
        <div className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-400 transition-[width] duration-500" style={{ width: `${progressPercent}%` }} />
      </div>
      <div className="mt-5 grid grid-cols-3 gap-2">
        {CHECKIN_PHASES.map((phase, index) => {
          const isCompleted = completed.includes(phase)
          const isCurrent = !isCompleted && phase === nextPhase
          const storedState = phaseStates.find((item) => item.phase === phase)?.state
          const isNotRecorded = storedState === 'not_recorded' || (!isCompleted && nextPhaseIndex >= 0 && index < nextPhaseIndex)
          const stateText = isCompleted ? 'Completed' : isNotRecorded ? 'Not Recorded' : isCurrent ? 'Current / next' : 'Upcoming'
          return (
            <div key={phase} className="relative text-center">
              {index > 0 && <span aria-hidden="true" className="absolute right-[calc(50%+1.4rem)] top-1 text-lg font-bold text-gray-300">→</span>}
              <span className={`relative z-10 mx-auto flex h-8 w-8 items-center justify-center rounded-full border text-sm font-bold ${isCompleted ? 'border-emerald-500 bg-emerald-500 text-white' : isCurrent ? 'border-orange-500 bg-orange-500 text-white ring-4 ring-orange-100' : 'border-gray-200 bg-white text-gray-400'}`}>{isCompleted ? '✓' : index + 1}</span>
              <p className={`mt-2 text-sm font-semibold ${isCompleted ? 'text-emerald-700' : isCurrent ? 'text-orange-700' : 'text-gray-400'}`}>{phase}</p>
              <p className={`mt-0.5 text-[11px] ${isNotRecorded ? 'text-gray-500' : 'text-gray-400'}`}>{stateText}</p>
            </div>
          )
        })}
      </div>
      <div className="mt-5 flex flex-wrap gap-x-5 gap-y-1 border-t border-orange-100 pt-4 text-sm">
        <p className="font-medium text-gray-700">Last completed: <strong>{currentPhase || 'None yet'}</strong></p>
        <p className="font-medium text-gray-700">Next: <strong>{nextPhase ? `${nextPhase} Check-in` : 'Term complete'}</strong></p>
      </div>
    </section>
  )
}

function CollegeDashboard() {
  const navigate = useNavigate()
  const token = localStorage.getItem('token')
  const username = localStorage.getItem('username')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [savedCollegeInfo, setCollegeInfo] = useState(null)
  const collegeInfo = loading ? collegePlaceholder : savedCollegeInfo
  const [checkinStatus, setCheckinStatus] = useState(null)
  const [history, setHistory] = useState([])
  const [savedCourseRoadmap, setCourseRoadmap] = useState(null)
  const courseRoadmap = loading ? coursePlaceholder : savedCourseRoadmap
  const [startingCheckin, setStartingCheckin] = useState(false)
  const [advancingSemester, setAdvancingSemester] = useState(false)
  const [showNextSemesterForm, setShowNextSemesterForm] = useState(false)
  const [nextSemesterStartDate, setNextSemesterStartDate] = useState('')
  const [nextSemesterEndDate, setNextSemesterEndDate] = useState('')
  const [nextSemesterAcademicYear, setNextSemesterAcademicYear] = useState('')
  const [nextTermTiming, setNextTermTiming] = useState('exact')
  const [nextApproximateStart, setNextApproximateStart] = useState({ month: '', year: '', part: '' })
  const [nextApproximateEnd, setNextApproximateEnd] = useState({ month: '', year: '', part: '' })
  const [nextTermPhase, setNextTermPhase] = useState('Early')
  const [confirmedNextYearLevel, setConfirmedNextYearLevel] = useState('')
  const [confirmedNextSemester, setConfirmedNextSemester] = useState('')
  const [lifecyclePending, setLifecyclePending] = useState(false)
  const [nextTermErrors, setNextTermErrors] = useState({})
  const [startingAssessment, setStartingAssessment] = useState(false)
  const [activeView, setActiveView] = useState('overview')
  const viewButtonsRef = useRef([])
  const [showFullHistory, setShowFullHistory] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [pendingLifecycleAction, setPendingLifecycleAction] = useState(null)
  const [pendingEarlyPhase, setPendingEarlyPhase] = useState(null)
  const lifecycleRequestRef = useRef(false)

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
        const collegeData = await collegeRes.json()
        if (collegeData.active === false && collegeData.trackingCycle === null) {
          navigate('/college/setup', { replace: true })
          return
        }
        if (!collegeRes.ok || !statusRes.ok) throw new Error('College tracking data is unavailable')

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
  const displayedHistory = useMemo(() => getCheckinHistoryRecords(history), [history])
  const visibleHistory = showFullHistory ? displayedHistory : displayedHistory.slice(0, 3)
  const trend = getAlignmentTrend(currentSemesterRecords)
  const nextCheckinPhase = getNextCheckinPhase(checkinStatus)
  const latestResult = currentSemesterRecords.at(-1) || null
  const latestAlignment = latestResult?.alignmentPercent ?? null
  const currentYearNumber = parseYearNumber(collegeInfo?.yearLevel)
  const roadmapYears = courseRoadmap?.year_levels || []
  const checkinCardIsActionable = Boolean(nextCheckinPhase) && checkinStatus?.state !== 'complete'
  const currentCalendarTerm = resolveCalendarTerm(collegeInfo || {})
  const nextAcademicStage = getNextAcademicStage(
    collegeInfo?.yearLevel,
    collegeInfo?.semester,
    courseRoadmap?.program_duration_years,
    checkinStatus?.progressionEligible,
    currentCalendarTerm?.calendarType,
    currentCalendarTerm?.termCode
  )
  const institutionDependentTerm = !currentCalendarTerm
  const nextAcademicYear = useMemo(() => {
    const match = String(collegeInfo?.academicYear || '').match(/^(\d{4})-(\d{4})$/)
    if (!match) return ''
    if (nextAcademicStage?.yearLevel === collegeInfo?.yearLevel) return collegeInfo.academicYear
    return `${Number(match[1]) + 1}-${Number(match[2]) + 1}`
  }, [collegeInfo, nextAcademicStage])
  const lifecycleStatus = collegeInfo?.lifecycleStatus || 'active'
  const dashboardViews = [
    { id: 'overview', label: 'Overview', icon: IconLayoutDashboard },
    ...(lifecycleStatus === 'active' ? [{ id: 'roadmap', label: 'Course Roadmap', icon: IconRoute }] : []),
    { id: 'history', label: 'History', icon: IconHistory },
  ]
  const visibleView = dashboardViews.some(view => view.id === activeView) ? activeView : 'overview'
  const handleViewKey = (event, index) => {
    let next
    if (event.key === 'ArrowRight') next = (index + 1) % dashboardViews.length
    else if (event.key === 'ArrowLeft') next = (index - 1 + dashboardViews.length) % dashboardViews.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = dashboardViews.length - 1
    else return
    event.preventDefault()
    setActiveView(dashboardViews[next].id)
    viewButtonsRef.current[next]?.focus()
  }
  const nextTermAcademicYears = getAcademicYearOptions(nextSemesterAcademicYear || nextAcademicYear)
  const nextTermActionLabel = nextAcademicStage && nextAcademicStage.yearLevel === collegeInfo?.yearLevel
    ? `Start ${nextAcademicStage.semester}`
    : 'Start Next Term'
  const programTrackingComplete = Boolean(checkinStatus?.progressionEligible && nextAcademicStage?.programCompleted)

  const openNextTermForm = () => {
    setShowNextSemesterForm(true)
    window.setTimeout(() => document.getElementById('next-term-setup')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0)
  }

  const updateLifecycle = async (action) => {
    if (lifecycleRequestRef.current) return
    lifecycleRequestRef.current = true
    setLifecyclePending(true)
    setError('')
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/college/tracking/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: '{}',
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.message || 'Unable to update college tracking.')
      setSuccessMessage(action === 'pause' ? 'Tracking Paused' : action === 'resume' ? 'Tracking Resumed' : 'Tracking Ended')
      await waitForSuccessConfirmation()
      navigate(0)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      lifecycleRequestRef.current = false
      setLifecyclePending(false)
    }
  }

  const confirmLifecycleAction = () => {
    const action = pendingLifecycleAction
    if (!action || lifecyclePending) return

    setPendingLifecycleAction(null)
    if (action === 'change') {
      navigate('/college/setup?action=change')
      return
    }
    updateLifecycle(action)
  }

  const handleTakeAssessment = async () => {
    if (startingAssessment) return
    setStartingAssessment(true)
    setError('')
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/assessment-attempts`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok || !payload.attemptId) throw new Error(payload.message || 'Could not start the assessment.')
      beginAssessmentAttempt(sessionStorage, payload.attemptId)
      navigate('/onboarding/profile')
    } catch (requestError) {
      setError(requestError.message || 'Could not start the assessment.')
      setStartingAssessment(false)
    }
  }

  const handleStartCheckin = async (phase = null, confirmedEarly = false) => {
    const phases = ['Early', 'Mid', 'End']
    const scheduledPhase = checkinStatus?.expectedPhase || checkinStatus?.currentPhase
    const aheadOfSchedule = phases.indexOf(phase) > phases.indexOf(scheduledPhase) && phases.includes(scheduledPhase)
    if (!confirmedEarly && (checkinStatus?.earlyCheckin || aheadOfSchedule || checkinStatus?.state === 'not_due')) {
      setPendingEarlyPhase(phase)
      return
    }
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
      if (response.ok) {
        setPendingEarlyPhase(null)
        navigate('/college/checkin')
      }
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
      const fieldErrors = {}
      if (institutionDependentTerm && !confirmedNextYearLevel) fieldErrors.nextYearLevel = 'Please select the next year level.'
      if (institutionDependentTerm && !confirmedNextSemester) fieldErrors.nextSemester = 'Please select the next semester.'
      if (nextTermTiming === 'exact' && !nextSemesterStartDate) fieldErrors.nextStartDate = 'Please select the next term start date.'
      if (nextTermTiming === 'exact' && (!nextSemesterEndDate || nextSemesterEndDate <= nextSemesterStartDate)) fieldErrors.nextEndDate = 'Select an end date after the start date.'
      if (nextTermTiming === 'approximate' && !(nextApproximateStart.month && nextApproximateStart.year && nextApproximateStart.part)) fieldErrors.approximateStart = 'Enter an approximate start.'
      if (nextTermTiming === 'approximate' && !(nextApproximateEnd.month && nextApproximateEnd.year && nextApproximateEnd.part && isApproximateEndAfterStart(nextApproximateStart, nextApproximateEnd))) fieldErrors.approximateEnd = 'Enter an approximate end after the start.'
      if (Object.keys(fieldErrors).length) {
        setNextTermErrors(fieldErrors)
        setAdvancingSemester(false)
        scrollToFirstInvalidField(Object.keys(fieldErrors))
        return
      }
      setNextTermErrors({})
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/college/semester/advance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          academicYear: nextSemesterAcademicYear || nextAcademicYear,
          timingMode: nextTermTiming === 'unknown' ? 'phase_only' : nextTermTiming,
          semesterStartDate: nextTermTiming === 'exact' ? nextSemesterStartDate : undefined,
          semesterEndDate: nextTermTiming === 'exact' ? nextSemesterEndDate : undefined,
          approximateStart: nextTermTiming === 'approximate' ? nextApproximateStart : undefined,
          approximateEnd: nextTermTiming === 'approximate' ? nextApproximateEnd : undefined,
          initialTrackingPhase: nextTermTiming === 'exact' ? undefined : nextTermPhase,
          nextYearLevel: institutionDependentTerm ? confirmedNextYearLevel : undefined,
          nextSemester: institutionDependentTerm ? confirmedNextSemester : undefined,
          calendarType: institutionDependentTerm ? 'semester' : nextAcademicStage?.calendarType,
          termCode: institutionDependentTerm ? undefined : nextAcademicStage?.termCode,
        }),
      })
      const payload = await response.json()
      if (!response.ok) {
        setError(payload.message || 'We could not start the next semester.')
        return
      }
      setSuccessMessage('Next Term Started')
      await waitForSuccessConfirmation()
      navigate(0)
    } catch {
      setError('We could not start the next semester. Please try again.')
    } finally {
      setAdvancingSemester(false)
    }
  }

  const handleLogout = () => {
    clearUserAuth(localStorage)
    navigate('/login')
  }


  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="lm-site-header bg-white border-b border-gray-100 px-4 sm:px-8 lg:px-14 py-[18px] flex justify-between items-center">
        <button onClick={() => navigate('/college')} className="text-lg font-bold text-gray-900 hover:opacity-80 transition">
          <HeaderBrand />
        </button>
        <div className="lm-header-actions flex items-center gap-3 sm:gap-4">
          <HeaderAccount username={username} />
          <button onClick={() => navigate('/feedback', { state: { entryContext: 'college' } })} className="lm-action"><IconMessageCircle size={16} stroke={1.7} aria-hidden="true" /> Feedback
          </button>
          {lifecycleStatus !== 'active' && (
            <button onClick={() => navigate('/college')} className="lm-action">
              Dashboard
            </button>
          )}
          <LogoutButton onConfirm={handleLogout} className="lm-action lm-action-danger"><IconLogout size={16} stroke={1.7} aria-hidden="true" /> Logout
          </LogoutButton>
        </div>
      </nav>

      <SkeletonContent loading={loading} label="Loading CollegeDashboard..."><main className="max-w-[1280px] mx-auto px-4 sm:px-8 lg:px-12 py-8 lg:py-11 space-y-6">
        {error && <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">{error}</div>}
        {successMessage && <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 px-5 py-4"><SuccessConfirmation compact message={successMessage} /></div>}

        <header className="college-panel relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(251,146,60,.08),transparent_65%)]" aria-hidden="true" />
          <div className="relative flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
            <div className="min-w-0"><p className="college-eyebrow">College dashboard</p><CourseName as="h1" name={collegeInfo?.courseName} className="max-w-3xl text-2xl font-bold leading-tight tracking-tight text-gray-950 sm:text-3xl" secondaryClassName="mt-2 text-base font-medium text-gray-500" /><div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-gray-600">{[collegeInfo?.yearLevel, collegeInfo?.semester, collegeInfo?.academicYear ? `AY ${collegeInfo.academicYear}` : null].filter(Boolean).map(label => <span key={label} className="rounded-lg border border-gray-200/80 bg-white/80 px-3 py-1.5">{label}</span>)}</div></div>
            <span className={`inline-flex w-fit shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${lifecycleStatus === 'active' ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : 'border-gray-200 bg-gray-50 text-gray-600'}`}><span className={`h-1.5 w-1.5 rounded-full ${lifecycleStatus === 'active' ? 'bg-emerald-500' : 'bg-gray-400'}`} />Tracking status: {lifecycleStatus === 'active' ? 'Active' : lifecycleStatus === 'paused' ? 'Paused' : 'Ended / Archived'}</span>
          </div>
          <div className="relative mt-6 border-t border-gray-100 pt-4"><p className="text-sm leading-6 text-gray-500">Career Alignment Tracking</p><p className="text-sm leading-6 text-gray-600">Follow your course experience, complete your next check-in, and see your progress over time.</p></div>
        </header>

        <div className="inline-flex max-w-full flex-wrap gap-1 rounded-2xl border border-gray-200/70 bg-gray-100/80 p-1.5" role="tablist" aria-label="College dashboard sections">
          {dashboardViews.map((view, index) => { const ViewIcon = view.icon; return <button key={view.id} ref={element => { viewButtonsRef.current[index] = element }} id={`college-view-${view.id}`} type="button" role="tab" aria-selected={visibleView === view.id} aria-controls={`college-panel-${view.id}`} tabIndex={visibleView === view.id ? 0 : -1} onClick={() => setActiveView(view.id)} onKeyDown={event => handleViewKey(event, index)} className="college-view-button"><ViewIcon size={17} stroke={1.7} aria-hidden="true" />{view.label}</button> })}
        </div>

        <div id="college-panel-overview" role="tabpanel" tabIndex={0} aria-labelledby="college-view-overview" hidden={visibleView !== 'overview'} className="space-y-6">
          {lifecycleStatus !== 'active' ? (
<section className="rounded-[20px] border border-orange-200 bg-orange-50 p-6 sm:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-orange-700">{lifecycleStatus === 'paused' ? 'Paused Tracking' : 'Previous Tracking / History'}</p>
            <h2 className="mt-1 text-xl font-bold text-gray-900">{lifecycleStatus === 'paused' ? 'College tracking is paused' : 'Ended / Archived'}</h2>
            <p className="mt-2 text-sm text-gray-600">Your completed terms and Career Alignment history remain available. No check-ins are currently due.</p>
            <button
              type="button"
              onClick={() => lifecycleStatus === 'paused'
                ? updateLifecycle('resume')
                : navigate('/college/setup?action=restart', { state: { course: { course_id: collegeInfo.courseId, course_name: collegeInfo.courseName } } })}
              disabled={lifecyclePending}
              className="mt-5 rounded-xl bg-orange-500 px-5 py-3 text-sm font-semibold text-white hover:bg-orange-600"
            >
              {lifecycleStatus === 'paused' ? lifecyclePending ? 'Resuming...' : 'Resume Tracking' : 'Start a New Tracking Cycle'}
            </button>
          </section>
          ) : (<>
            <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
<section className={`college-panel h-full ${checkinCardIsActionable ? 'college-next-action' : ''}`}>
            <p className="college-eyebrow">Your next step</p><IconClipboardCheck size={28} stroke={1.7} className={checkinCardIsActionable ? 'text-orange-500' : 'text-gray-400'} />
            <h2 className="mt-4 text-2xl font-bold tracking-tight text-gray-950">
              {checkinStatus?.state === 'pending' && `Your ${nextCheckinPhase} check-in is ready`}
              {checkinStatus?.state === 'due' && (checkinStatus?.earlyCheckin ? `Your ${nextCheckinPhase} check-in is ahead of schedule` : `Your ${nextCheckinPhase} check-in is ready`)}
              {checkinStatus?.state === 'not_due' && `Next up: ${nextCheckinPhase} check-in`}
              {checkinStatus?.state === 'complete' && 'All check-ins completed this term'}
              {!checkinStatus && 'Your term check-ins'}
            </h2>
            <p className="mt-3 text-base leading-7 text-gray-600">
              {checkinCardIsActionable ? 'Take about a minute to record how your course experience feels right now.' : 'Your completed results remain available in your alignment history.'}
            </p>
            {checkinStatus?.earlyCheckin && checkinCardIsActionable && (
              <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">You can check in now, but LearnMatch recommends completing this check-in during the {nextCheckinPhase}-term period.</p>
            )}
            {checkinCardIsActionable && (
              <button onClick={() => handleStartCheckin(nextCheckinPhase)} disabled={startingCheckin} className="mt-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-orange-500 px-6 py-3 text-sm font-semibold text-white shadow-sm shadow-orange-200 hover:bg-orange-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500 disabled:opacity-50">
                {startingCheckin ? 'Starting...' : checkinStatus?.state === 'pending' ? 'Continue Check-in' : 'Start Check-in'} <IconArrowRight size={16} />
              </button>
            )}
            {checkinStatus?.state === 'complete' && latestResult && (
              <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                {!nextAcademicStage?.programCompleted && (nextAcademicStage || institutionDependentTerm) && (
                  <button type="button" onClick={openNextTermForm} className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-5 py-3 text-sm font-semibold text-white hover:bg-orange-600">
                    {institutionDependentTerm ? 'Start Next Term' : nextTermActionLabel} <IconArrowRight size={16} />
                  </button>
                )}
                <button type="button" onClick={() => document.getElementById('latest-alignment-insight')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-800">
                  View Completed Check-in
                </button>
                {programTrackingComplete && (
                  <button type="button" disabled={lifecyclePending} onClick={() => updateLifecycle('end')} className="inline-flex items-center justify-center gap-2 rounded-xl bg-gray-950 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">
                    {lifecyclePending ? 'Finishing...' : 'Finish Tracking'}
                  </button>
                )}
              </div>
            )}
          </section>
              <CheckinProgress completedPhases={checkinStatus?.completedPhases || []} phaseStates={checkinStatus?.phaseStates || []} nextPhase={checkinStatus?.nextExpectedPhase || null} />
            </div>
        {showNextSemesterForm && (
          <section id="next-term-setup" className="rounded-[20px] border border-orange-100 bg-white p-5 shadow-sm sm:p-8">
            <div className="max-w-3xl">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-orange-600">Term setup</p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight text-gray-950">Start Next Term</h2>
              <p className="mt-2 text-sm leading-6 text-gray-500">Confirm the new term. Exact dates are helpful, but approximate or unknown dates are also okay.</p>

              <div className="mt-7 space-y-6">
                {institutionDependentTerm && (
                  <div className="space-y-4 rounded-2xl border border-orange-100 bg-orange-50/60 p-4 sm:p-5">
                    <p className="text-sm text-orange-800">LearnMatch cannot assume what follows this legacy term. Select the next academic stage explicitly.</p>
                    <div className="motion-stagger grid gap-4 sm:grid-cols-2">
                      <label data-validation-field="nextYearLevel" className="block text-sm font-medium text-gray-700">Next year level <RequiredMark /><select value={confirmedNextYearLevel} onChange={(event) => { setConfirmedNextYearLevel(event.target.value); setNextTermErrors((current) => ({ ...current, nextYearLevel: undefined })) }} aria-invalid={nextTermErrors.nextYearLevel ? 'true' : undefined} aria-describedby={nextTermErrors.nextYearLevel ? 'next-year-level-error' : undefined} className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm">
                        <option value="">Next year level</option>
                        {['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year'].map((year) => <option key={year} value={year}>{year}</option>)}
                      </select><FieldError id="next-year-level-error">{nextTermErrors.nextYearLevel}</FieldError></label>
                      <label data-validation-field="nextSemester" className="block text-sm font-medium text-gray-700">Next semester <RequiredMark /><select value={confirmedNextSemester} onChange={(event) => { setConfirmedNextSemester(event.target.value); setNextTermErrors((current) => ({ ...current, nextSemester: undefined })) }} aria-invalid={nextTermErrors.nextSemester ? 'true' : undefined} aria-describedby={nextTermErrors.nextSemester ? 'next-semester-error' : undefined} className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm">
                        <option value="">Next semester</option>
                        {getCalendarTerms('semester').map((term) => <option key={term.code} value={term.label}>{term.label}</option>)}
                      </select><FieldError id="next-semester-error">{nextTermErrors.nextSemester}</FieldError></label>
                    </div>
                  </div>
                )}

                <label className="block text-sm font-medium text-gray-700">Academic Year <RequiredMark /><input
                  type="text"
                  aria-label="Next academic year"
                  placeholder="2026-2027"
                  value={nextSemesterAcademicYear || nextAcademicYear}
                  readOnly={Boolean(nextAcademicYear)}
                  onChange={(event) => setNextSemesterAcademicYear(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm read-only:bg-gray-50 sm:max-w-sm"
                /></label>

                <fieldset>
                  <legend className="text-sm font-medium text-gray-700">Schedule information <RequiredMark /></legend>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    {[['exact', 'Exact'], ['approximate', 'Approximate'], ['unknown', 'Unknown']].map(([value, label]) => (
                      <button key={value} type="button" onClick={() => setNextTermTiming(value)} className={`rounded-xl border px-4 py-3 text-sm font-semibold ${nextTermTiming === value ? 'border-orange-400 bg-orange-50 text-orange-700' : 'border-gray-200 bg-white text-gray-600'}`}>{label}</button>
                    ))}
                  </div>
                </fieldset>

                {nextTermTiming === 'exact' && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label data-validation-field="nextStartDate" className="block text-sm font-medium text-gray-700">Term start <RequiredMark /><input type="date" value={nextSemesterStartDate} onChange={(event) => { setNextSemesterStartDate(event.target.value); setNextTermErrors((current) => ({ ...current, nextStartDate: undefined })) }} aria-invalid={nextTermErrors.nextStartDate ? 'true' : undefined} aria-describedby={nextTermErrors.nextStartDate ? 'next-start-error' : undefined} className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-3 text-sm" /><FieldError id="next-start-error">{nextTermErrors.nextStartDate}</FieldError></label>
                    <label data-validation-field="nextEndDate" className="block text-sm font-medium text-gray-700">Term end <RequiredMark /><input type="date" min={nextSemesterStartDate || undefined} value={nextSemesterEndDate} onChange={(event) => { setNextSemesterEndDate(event.target.value); setNextTermErrors((current) => ({ ...current, nextEndDate: undefined })) }} aria-invalid={nextTermErrors.nextEndDate ? 'true' : undefined} aria-describedby={nextTermErrors.nextEndDate ? 'next-end-error' : undefined} className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-3 text-sm" /><FieldError id="next-end-error">{nextTermErrors.nextEndDate}</FieldError></label>
                  </div>
                )}

                {nextTermTiming === 'approximate' && <ApproximateScheduleFields academicYears={nextTermAcademicYears} approximateStart={nextApproximateStart} approximateEnd={nextApproximateEnd} setApproximateStart={setNextApproximateStart} setApproximateEnd={setNextApproximateEnd} errors={nextTermErrors} />}

                {nextTermTiming !== 'exact' && <label className="block text-sm font-medium text-gray-700">Current phase when tracking starts <RequiredMark /><select value={nextTermPhase} onChange={(event) => setNextTermPhase(event.target.value)} className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm sm:max-w-md"><option value="Early">Classes recently started</option><option value="Mid">Around the middle</option><option value="End">Approaching the end</option></select></label>}

                <div className="border-t border-gray-100 pt-6">
                  <button type="button" onClick={handleStartNextSemester} disabled={advancingSemester} className="w-full rounded-xl bg-gray-950 px-5 py-3.5 text-sm font-semibold text-white disabled:opacity-50 sm:w-auto sm:min-w-52">{advancingSemester ? 'Starting...' : 'Start Next Term'}</button>
                </div>
              </div>
            </div>
          </section>
        )}

            <div className="grid gap-4">
              <section className="college-panel !p-5"><p className="mb-3 flex items-center gap-2 text-xs font-semibold text-gray-500"><IconChartLine size={17} className="text-orange-500" />Latest alignment</p><p className="text-2xl font-bold text-gray-950">{latestAlignment === null ? 'No result yet' : `${latestAlignment}%`}</p><p className="mt-2 text-sm text-gray-500">{latestResult ? statusLabel(latestResult.status) : 'Complete a check-in to see your result.'}</p></section>

            </div>

            <section id="latest-alignment-insight" className="college-panel scroll-mt-6">
              <p className="college-eyebrow">Understand your result</p><h2 className="college-heading">Latest alignment insight</h2>
              {latestResult ? <><div className="mt-4 flex flex-wrap items-center gap-3"><span className={`inline-flex rounded-full border px-3 py-1.5 text-xs font-bold ${statusStyle(latestResult.status)}`}>{statusLabel(latestResult.status)}</span><span className="text-sm font-semibold text-gray-700">{latestAlignment}% aligned</span></div><div className="mt-5 grid gap-5 md:grid-cols-2"><div className="rounded-2xl bg-gray-50 p-5"><p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">What this means</p><p className="text-base leading-7 text-gray-600">{latestResult.feedback}</p></div><div className="rounded-2xl border border-orange-100 bg-orange-50/50 p-5"><p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-orange-700"><IconSparkles size={16} />Suggested next step</p><p className="text-base leading-7 text-gray-700">{latestResult.recommendation}</p></div></div></> : <p className="mt-4 text-base leading-7 text-gray-500">Your first check-in will show how your current course experience aligns with you.</p>}
            </section>

            <section className="college-panel">
              <div className="mb-5 flex flex-wrap items-start justify-between gap-4"><div><p className="college-eyebrow">Your progress over time</p><h2 className="college-heading">Alignment trend</h2><p className="mt-2 text-sm leading-6 text-gray-500">Compare your check-ins within this term.</p></div><span className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-600">{trend.direction === 'insufficient' ? 'More check-ins needed' : <>{trend.direction === 'improving' ? <IconTrendingUp size={17} className="mr-2 inline text-emerald-600" /> : trend.direction === 'declining' ? <IconTrendingDown size={17} className="mr-2 inline text-red-500" /> : <IconChartLine size={17} className="mr-2 inline" />}<span className="capitalize">{trend.direction}</span>{trend.delta !== 0 && ` (${trend.delta > 0 ? '+' : ''}${trend.delta} points)`}</>}</span></div>
              {currentSemesterRecords.length > 0 ? <><AlignmentTrendChart records={currentSemesterRecords} />{currentSemesterRecords.length === 1 && <p className="mt-2 text-sm text-gray-500">Complete another phase to see how your alignment changes.</p>}</> : <p className="rounded-2xl bg-gray-50 p-5 text-sm leading-6 text-gray-500">Your trend will appear after your first completed check-in.</p>}
              <details className="college-management mt-5 overflow-hidden rounded-2xl border border-gray-200"><summary className="flex cursor-pointer items-center justify-between gap-3 p-4 text-sm font-semibold text-gray-700 focus-visible:outline-2 focus-visible:outline-orange-500">View Early, Mid and End results<IconChevronDown size={17} /></summary><div className="border-t border-gray-100 p-4">
          <div className="grid md:grid-cols-3 gap-4">
            {CHECKIN_PHASES.map((phase) => {
              const record = currentSemesterRecords.find((item) => item.phase === phase)
              const phaseState = checkinStatus?.phaseStates?.find((item) => item.phase === phase)?.state || 'upcoming'
              const isAvailable = phaseState === 'available' || phaseState === 'available_early' || phaseState === 'missed_available'
              const isInitialAvailable = currentSemesterRecords.length === 0 && phaseState === 'available' && phase === collegeInfo?.initialTrackingPhase
              const stateLabel = phaseState === 'not_recorded'
                ? 'Not recorded'
                : phaseState === 'missed_available'
                  ? 'Missed / Still available'
                  : phaseState === 'available_early'
                    ? 'Current · available early'
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
                      <span className={`inline-flex border rounded-full px-2.5 py-1 text-[10px] font-bold mt-4 ${statusStyle(record.status)}`}>{statusLabel(record.status)}</span>
                      <p className="text-xs text-gray-400 mt-3">{formatCheckinDate(record.checkinDate) || 'Completion date unavailable'}</p>
                    </>
                  ) : (
                    <div className="mt-4">
                      <p className="text-xs text-gray-400">No stored result for this phase.</p>
                    </div>
                  )}
                </article>
              )
            })}
          </div>


              </div></details>
            </section>
        {latestResult?.status === 'Needs Attention' && (
          <div className="rounded-2xl border border-red-100 bg-red-50 px-5 py-4 flex gap-3">
            <IconAlertTriangle size={20} className="text-red-500 shrink-0" />
            <p className="text-sm text-red-700">Your latest result suggests that additional support may help. Consider discussing the insight above with an adviser or someone you trust.</p>
          </div>
        )}

          </>)}
        </div>

        {lifecycleStatus === 'active' && <div id="college-panel-roadmap" role="tabpanel" tabIndex={0} aria-labelledby="college-view-roadmap" hidden={visibleView !== 'roadmap'}>
          <CollegeProgramRoadmap key={collegeInfo?.courseCode} years={roadmapYears} currentYear={currentYearNumber} currentTerm={collegeInfo?.semester} duration={courseRoadmap?.program_duration_years} />
          {programTrackingComplete && <div className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50 p-5"><p className="font-bold text-emerald-800">Program Tracking Complete</p><p className="mt-2 text-sm text-emerald-700">You completed the final regular term in this program.</p></div>}
        </div>}

        <div id="college-panel-history" role="tabpanel" tabIndex={0} aria-labelledby="college-view-history" hidden={visibleView !== 'history'}>
        <section className="college-panel">
          <div className="flex items-center gap-2 text-gray-500 mb-2">
            <IconCalendar size={18} stroke={1.8} />
            <h2 className="college-heading">{showFullHistory ? 'Full Check-in History' : 'Check-in History'}</h2>
          </div>
          <p className="text-sm text-gray-500 mb-5">Every completed check-in appears here, newest first, including your current term.</p>
          {displayedHistory.length === 0 ? (
            <p className="text-sm text-gray-400 rounded-2xl bg-gray-50 px-5 py-6">No completed check-ins yet.</p>
          ) : (
            <div className="space-y-3">
              {visibleHistory.map((record) => (
                <article key={record.checkinId} className="border border-gray-100 rounded-2xl px-4 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-sm font-semibold text-gray-900">
                        <CourseName name={record.courseName} secondaryClassName="mt-0.5 text-sm font-medium text-gray-500" />
                        <p className="mt-1 text-xs font-medium text-gray-500">{record.yearLevel} · {record.semester} · {record.phase}</p>
                      </div>
                      <span className={`inline-flex border rounded-full px-2 py-0.5 text-[9px] font-bold ${statusStyle(record.status)}`}>{statusLabel(record.status)}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">{formatCheckinDate(record.checkinDate) || 'Date unavailable'}</p>
                  </div>
                  <div className="sm:text-right">
                    <p className="text-lg font-bold text-orange-500">{record.alignmentPercent}%</p>
                    {hasDisplayableGwa(record) && <p className="text-xs text-gray-400">GWA: {record.gwa}</p>}
                  </div>
                </article>
              ))}
              {displayedHistory.length > 3 && (
                <div className="pt-2 text-center">
                  <button
                    type="button"
                    aria-expanded={showFullHistory}
                    onClick={() => setShowFullHistory((visible) => !visible)}
                    className="inline-flex items-center justify-center rounded-xl border border-orange-200 bg-orange-50 px-5 py-2.5 text-sm font-semibold text-orange-700 transition hover:bg-orange-100"
                  >
                    {showFullHistory ? 'Show Latest 3' : 'View Full History'}
                  </button>
                </div>
              )}
            </div>
          )}
        </section>


        </div>

        <details className="college-management group overflow-hidden rounded-2xl border border-gray-200 bg-white">
          <summary className="flex cursor-pointer items-center justify-between gap-4 p-5 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-orange-500 sm:px-7"><span className="flex items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-500"><IconSettings size={20} stroke={1.6} /></span><span><span className="block text-sm font-semibold text-gray-900">Manage tracking</span><span className="mt-1 block text-xs text-gray-500">Assessment and program settings</span></span></span><IconChevronDown size={18} className="shrink-0 text-gray-400 transition-transform group-open:rotate-180" /></summary>
          {lifecycleStatus === 'active' ? (
<section className="flex flex-wrap gap-3 border-t border-gray-100 px-5 py-5 sm:px-7">
            <button type="button" disabled={startingAssessment} onClick={handleTakeAssessment} className="inline-flex items-center gap-2 rounded-xl border border-orange-200 bg-orange-50 px-4 py-2.5 text-sm font-semibold text-orange-700 disabled:cursor-not-allowed disabled:opacity-50">
              <IconRefresh size={16} stroke={2} /> {startingAssessment ? 'Starting Assessment...' : 'Take Assessment Again'}
            </button>
            <button type="button" disabled={lifecyclePending} onClick={() => setPendingLifecycleAction('pause')} className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 disabled:opacity-50">Pause Tracking</button>
            <button type="button" disabled={lifecyclePending} onClick={() => setPendingLifecycleAction('change')} className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 disabled:opacity-50">Change Program</button>
            {!programTrackingComplete && <button type="button" disabled={lifecyclePending} onClick={() => setPendingLifecycleAction('end')} className="rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-700 disabled:opacity-50">End Tracking</button>}
          </section>
          ) : <p className="border-t border-gray-100 p-5 text-sm text-gray-500">Use the Overview tab to resume or restart your tracking.</p>}
          {collegeInfo?.semesterStartDate && collegeInfo?.semesterEndDate && <div className="border-t border-gray-100 px-5 py-4 text-sm leading-7 text-gray-600 sm:px-7"><p className="font-semibold text-gray-900">Term schedule</p><p>{formatCheckinDate(collegeInfo.semesterStartDate)} to {formatCheckinDate(collegeInfo.semesterEndDate)}</p>{collegeInfo.timingEstimated && <p className="text-xs text-gray-500">Dates are approximate.</p>}</div>}
          {collegeInfo?.timingMode === 'manual' && lifecycleStatus === 'active' && <div className="border-t border-gray-100 px-5 py-4 sm:px-7"><p className="mb-3 text-sm text-gray-500">No term schedule set. You can still complete your check-ins in order.</p><button type="button" onClick={() => navigate('/college/setup')} className="lm-action">Add semester schedule</button></div>}
        </details>
      </main></SkeletonContent>
      <ActionConfirmationModal
        action={pendingEarlyPhase ? 'earlyCheckin' : null}
        description={`Your next check-in is ${pendingEarlyPhase}. ${checkinStatus?.expectedPhase || checkinStatus?.currentPhase ? `Your term is currently in the ${checkinStatus.expectedPhase || checkinStatus.currentPhase} phase. ` : ''}We recommend waiting until the ${pendingEarlyPhase} phase so your answers reflect that part of the term. Would you still like to continue early?`}
        onCancel={() => setPendingEarlyPhase(null)}
        onConfirm={() => handleStartCheckin(pendingEarlyPhase, true)}
        processing={startingCheckin}
        error={pendingEarlyPhase ? error : ''}
      />
      <ActionConfirmationModal
        action={pendingLifecycleAction}
        onCancel={() => setPendingLifecycleAction(null)}
        onConfirm={confirmLifecycleAction}
        processing={lifecyclePending}
      />
    </div>
  )
}

export default CollegeDashboard
