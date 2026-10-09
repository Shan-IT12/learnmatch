import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { IconCalendarEvent, IconSchool, IconSearch } from '@tabler/icons-react'
import {
  approximateScheduleValue,
  buildCollegeSetupPayload,
  calculateDisplayedSemesterPhase,
  getAcademicYearOptions,
  getCollegeSetupAcademicYear,
  getCurrentAcademicYear,
  isApproximateEndAfterStart,
} from '../../utils/collegeSchedule'
import { ACADEMIC_CALENDARS, getCalendarTerms } from '../../constants/academicCalendars'
import { FieldError, RequiredMark } from '../../components/FormValidation'
import { scrollToFirstInvalidField } from '../../utils/formValidation'
import CourseName from '../../components/CourseName'
import { shouldReviewCollegeSetup } from '../../utils/collegeSetupReview'
import SuccessConfirmation from '../../components/SuccessConfirmation'
import { waitForSuccessConfirmation } from '../../utils/successConfirmation'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const MONTH_PARTS = [
  { value: 'early', label: 'Early in the month' },
  { value: 'middle', label: 'Middle of the month' },
  { value: 'late', label: 'Late in the month' },
]
const POSITION_OPTIONS = [
  { value: 'Early', label: 'Classes recently started' },
  { value: 'Mid', label: "We're around the middle of the term" },
  { value: 'End', label: "We're approaching final exams / the end of the term" },
]
const EXACT_PHASE_LABELS = {
  NOT_STARTED: 'Not Started Yet',
  ENDED: 'Term Ended',
}

function SemesterPhaseSelector({ value, onChange, error = '' }) {
  return (
    <fieldset data-validation-field="semesterPosition" aria-invalid={error ? 'true' : undefined} aria-describedby={error ? 'semester-position-error' : undefined}>
      <legend className="text-sm font-medium text-gray-700 mb-3">Where are you currently in this term? <RequiredMark /></legend>
      <div className="space-y-2">
        {POSITION_OPTIONS.map((option) => (
          <label key={option.value} className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition duration-150 ${value === option.value ? 'border-orange-300 bg-orange-50/80 shadow-sm' : 'border-gray-200 bg-white hover:border-orange-200 hover:bg-orange-50/30'}`}>
            <input type="radio" name="semester-position" value={option.value} checked={value === option.value} onChange={() => onChange(option.value)} className="accent-orange-500" />
            <span className="text-sm text-gray-700">{option.label}</span>
          </label>
        ))}
      </div>
      <FieldError id="semester-position-error">{error}</FieldError>
    </fieldset>
  )
}

export function ApproximateScheduleFields({ academicYears, approximateStart, approximateEnd, setApproximateStart, setApproximateEnd, errors = {} }) {
  return (
    <div className="space-y-6">
      {[
        ['Approximate start', approximateStart, setApproximateStart, false],
        ['Approximate end', approximateEnd, setApproximateEnd, true],
      ].map(([label, value, setter, isEnd]) => (
        <fieldset key={label} data-validation-field={isEnd ? 'approximateEnd' : 'approximateStart'} aria-invalid={errors[isEnd ? 'approximateEnd' : 'approximateStart'] ? 'true' : undefined} aria-describedby={errors[isEnd ? 'approximateEnd' : 'approximateStart'] ? `${isEnd ? 'approximate-end' : 'approximate-start'}-error` : undefined} className="rounded-xl border border-gray-100 bg-gray-50/60 p-4">
          <legend className="px-1 text-sm font-semibold text-gray-800">{label} <RequiredMark /></legend>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <label className="block min-w-0 text-xs font-medium text-gray-600">
              Month
              <select aria-label={`${label} month`} value={value.month} onChange={(event) => setter({ ...value, month: event.target.value })} className="mt-1.5 w-full min-w-0 rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm outline-none transition focus:border-orange-400 focus:ring-4 focus:ring-orange-100/80">
                <option value="">Select month</option>
                {MONTHS.map((month, index) => {
                  const monthValue = String(index + 1)
                  const disabled = isEnd && value.year === approximateStart.year && Number(monthValue) < Number(approximateStart.month)
                  return <option key={month} value={monthValue} disabled={disabled}>{month}</option>
                })}
              </select>
            </label>
            <label className="block min-w-0 text-xs font-medium text-gray-600">
              Year
              <select aria-label={`${label} year`} value={value.year} onChange={(event) => setter({ ...value, year: event.target.value })} className="mt-1.5 w-full min-w-0 rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm outline-none transition focus:border-orange-400 focus:ring-4 focus:ring-orange-100/80">
                <option value="">Select year</option>
                {academicYears.map((year) => (
                  <option key={year} value={year} disabled={isEnd && Number(year) < Number(approximateStart.year)}>{year}</option>
                ))}
              </select>
            </label>
            <label className="block min-w-0 text-xs font-medium text-gray-600 sm:col-span-2">
              Part of month
              <select aria-label={`${label} part of month`} value={value.part} onChange={(event) => setter({ ...value, part: event.target.value })} className="mt-1.5 w-full min-w-0 rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm outline-none transition focus:border-orange-400 focus:ring-4 focus:ring-orange-100/80">
                <option value="">Select part of month</option>
                {MONTH_PARTS.map((part) => {
                  const candidate = { ...value, part: part.value }
                  const disabled = isEnd && value.year === approximateStart.year && value.month === approximateStart.month && approximateScheduleValue(candidate) <= approximateScheduleValue(approximateStart)
                  return <option key={part.value} value={part.value} disabled={disabled}>{part.label}</option>
                })}
              </select>
            </label>
          </div>
          <FieldError id={`${isEnd ? 'approximate-end' : 'approximate-start'}-error`}>{errors[isEnd ? 'approximateEnd' : 'approximateStart']}</FieldError>
        </fieldset>
      ))}
    </div>
  )
}

export function ResumeProgramCard({ course, loading = false }) {
  return (
    <div aria-label="Current Program" className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-4">
      <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-orange-600">Current Program</p>
      {loading ? <p className="mt-2 text-base font-semibold text-gray-900">Loading your existing program...</p> : <CourseName name={course?.course_name || 'Program unavailable'} className="mt-2 block text-base font-semibold text-gray-900" secondaryClassName="mt-0.5 text-sm font-medium text-gray-600" />}
      {!loading && <p className="mt-1 text-sm text-gray-600">You’re resuming tracking for your existing program.</p>}
    </div>
  )
}

export function AcademicYearField({ academicYear, isStored = false }) {
  return (
    <div>
      <label htmlFor="academic-year" className="mb-2 block text-sm font-medium text-gray-700">Academic year</label>
      <output id="academic-year" aria-readonly="true" className="block w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3.5 text-sm font-semibold text-gray-900">
        {academicYear.replace('-', '–')}
      </output>
      <p className="mt-2 text-xs text-gray-500">{isStored ? 'Saved academic year for this tracking cycle.' : 'Automatically based on the current academic year.'}</p>
    </div>
  )
}

function CollegeSetup() {
  const navigate = useNavigate()
  const location = useLocation()
  const token = localStorage.getItem('token')
  const lifecycleAction = new URLSearchParams(location.search).get('action') || 'setup'
  const isResume = lifecycleAction === 'resume'
  const restoredDraft = shouldReviewCollegeSetup(lifecycleAction) ? location.state?.setupDraft : null
  const fixedCourse = lifecycleAction === 'restart' ? location.state?.course || null : null

  const [courses, setCourses] = useState([])
  const [search, setSearch] = useState(restoredDraft?.selectedCourse?.course_name || '')
  const [searchStatus, setSearchStatus] = useState('idle')
  const [selectedCourse, setSelectedCourse] = useState(restoredDraft?.selectedCourse || fixedCourse)
  const [academicYear, setAcademicYear] = useState(restoredDraft?.academicYear || getCurrentAcademicYear)
  const [yearLevel, setYearLevel] = useState(restoredDraft?.yearLevel || '')
  const [semester, setSemester] = useState(restoredDraft?.semester || '')
  const [calendarType, setCalendarType] = useState(restoredDraft?.calendarType || 'semester')
  const [termCode, setTermCode] = useState(restoredDraft?.termCode || '')
  const [semesterStartDate, setSemesterStartDate] = useState(restoredDraft?.semesterStartDate || '')
  const [semesterEndDate, setSemesterEndDate] = useState(restoredDraft?.semesterEndDate || '')
  const [timingChoice, setTimingChoice] = useState(restoredDraft?.timingChoice || 'exact')
  const [approximateStart, setApproximateStart] = useState(restoredDraft?.approximateStart || { month: '', year: '', part: '' })
  const [approximateEnd, setApproximateEnd] = useState(restoredDraft?.approximateEnd || { month: '', year: '', part: '' })
  const [semesterPosition, setSemesterPosition] = useState(restoredDraft?.semesterPosition || '')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resumeProgramLoading, setResumeProgramLoading] = useState(isResume)
  const [fieldErrors, setFieldErrors] = useState({})
  const [successMessage, setSuccessMessage] = useState('')

  useEffect(() => {
    if (!token) navigate('/login')
  }, [token, navigate])

  useEffect(() => {
    if (!token || !isResume) return undefined
    const controller = new AbortController()
    const loadPausedProgram = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/college/status`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        })
        if (response.status === 401 || response.status === 403) {
          navigate('/login', { replace: true })
          return
        }
        const data = await response.json()
        if (!response.ok || data.lifecycleStatus !== 'paused') {
          throw new Error(data.message || 'Paused tracking could not be loaded.')
        }
        const courseResponse = await fetch(`${import.meta.env.VITE_API_URL}/api/search?q=${encodeURIComponent(data.courseCode)}`, { signal: controller.signal })
        const courseData = courseResponse.ok ? await courseResponse.json() : { courses: [] }
        const resolvedCourse = courseData.courses?.find((course) => course.course_id === data.courseId)
        setSelectedCourse(resolvedCourse || { course_id: data.courseId, course_name: data.courseName, course_code: data.courseCode })
        setAcademicYear(getCollegeSetupAcademicYear('resume', data.academicYear))
      } catch (requestError) {
        if (requestError.name !== 'AbortError') setError(requestError.message || 'Paused tracking could not be loaded.')
      } finally {
        if (!controller.signal.aborted) setResumeProgramLoading(false)
      }
    }
    loadPausedProgram()
    return () => controller.abort()
  }, [token, navigate, isResume])

  useEffect(() => {
    if (isResume) return undefined
    const query = search.trim().replace(/\s+/g, ' ')
    if (selectedCourse || query.length < 2) return undefined

    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setSearchStatus('loading')
      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_URL}/api/search?q=${encodeURIComponent(query)}`,
          { signal: controller.signal }
        )
        if (!response.ok) throw new Error('Course search failed')
        const data = await response.json()
        setCourses(data.courses || [])
        setSearchStatus('success')
      } catch (requestError) {
        if (requestError.name !== 'AbortError') {
          setCourses([])
          setSearchStatus('error')
        }
      }
    }, 200)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [search, selectedCourse, isResume])

  const academicYears = getAcademicYearOptions(academicYear)
  const programDuration = Number(selectedCourse?.program_duration_years) || 5
  const academicDateMin = academicYears.length === 2 ? `${academicYears[0]}-01-01` : undefined
  const academicDateMax = academicYears.length === 2 ? `${academicYears[1]}-12-31` : undefined
  const detectedExactPhase = calculateDisplayedSemesterPhase(semesterStartDate, semesterEndDate)

  const validTerm = getCalendarTerms(calendarType).some((term) => term.code === termCode && term.label === semester)
  const validYearLevel = Boolean(yearLevel) && Number(yearLevel.match(/\d+/)?.[0]) <= programDuration
  const validExactSchedule = timingChoice !== 'exact' || Boolean(
    semesterStartDate && semesterEndDate && semesterEndDate > semesterStartDate &&
    academicYears.includes(semesterStartDate.slice(0, 4)) && academicYears.includes(semesterEndDate.slice(0, 4))
  )
  const validApproximateSchedule = timingChoice !== 'approximate' || Boolean(
    approximateStart.month && approximateStart.year && approximateStart.part &&
    approximateEnd.month && approximateEnd.year && approximateEnd.part &&
    isApproximateEndAfterStart(approximateStart, approximateEnd) && semesterPosition
  )
  const validUnknownSchedule = timingChoice !== 'unknown' || Boolean(semesterPosition)
  const isFormComplete = Boolean(
    selectedCourse && academicYears.length === 2 && validYearLevel && validTerm &&
    validExactSchedule && validApproximateSchedule && validUnknownSchedule
  )

  const handleSemesterChoice = (term) => {
    setSemester(term.label)
    setTermCode(term.code)
    setFieldErrors((current) => ({ ...current, semester: undefined }))
    if (academicYears.length !== 2) return
    const suggestedYear = term.code === 'SEM_1' || term.code === 'TRI_1' ? academicYears[0] : academicYears[1]
    setApproximateStart((current) => ({ ...current, year: suggestedYear }))
    setApproximateEnd((current) => ({ ...current, year: suggestedYear }))
  }

  const selectCourse = (course) => {
    const nextDuration = Number(course?.program_duration_years) || 5
    if (Number(String(yearLevel).match(/\d+/)?.[0]) > nextDuration) setYearLevel('')
    setSelectedCourse(course)
    setSearch(course.course_name)
    setCourses([])
    setSearchStatus('idle')
    setFieldErrors((current) => ({ ...current, course: undefined }))
  }

  const handleSearchChange = (event) => {
    setSearch(event.target.value)
    setSelectedCourse(null)
    setYearLevel('')
    setCourses([])
    setSearchStatus('idle')
  }

  const handleApproximateStartChange = (nextStart) => {
    setApproximateStart(nextStart)
    setFieldErrors((current) => ({ ...current, approximateStart: undefined }))
    setApproximateEnd((current) => (
      approximateScheduleValue(current) !== null && !isApproximateEndAfterStart(nextStart, current)
        ? { month: '', year: '', part: '' }
        : current
    ))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (loading) return
    setError('')

    const nextErrors = {}
    if (!selectedCourse) nextErrors.course = 'Please select a course from the list.'
    if (academicYears.length !== 2) nextErrors.academicYear = 'The academic year is unavailable.'
    if (!yearLevel || Number(yearLevel.match(/\d+/)?.[0]) > programDuration) nextErrors.yearLevel = 'Please select a valid year level for this course.'
    if (!getCalendarTerms(calendarType).some((term) => term.code === termCode && term.label === semester)) nextErrors.semester = 'Please select a valid term for this academic calendar.'
    if (timingChoice === 'exact' && (!semesterStartDate || !semesterEndDate || semesterEndDate <= semesterStartDate)) {
      if (!semesterStartDate) nextErrors.semesterStartDate = 'Please select the term start date.'
      if (!semesterEndDate || semesterEndDate <= semesterStartDate) nextErrors.semesterEndDate = 'Select an end date after the start date.'
    }
    if (timingChoice === 'exact' && (
      !academicYears.includes(semesterStartDate.slice(0, 4)) ||
      !academicYears.includes(semesterEndDate.slice(0, 4))
    )) {
      nextErrors.semesterStartDate = 'Term dates must fall within the selected academic year.'
    }
    if (timingChoice === 'approximate' && (
      !approximateStart.month || !approximateStart.year || !approximateStart.part ||
      !approximateEnd.month || !approximateEnd.year || !approximateEnd.part
    )) {
      if (!approximateStart.month || !approximateStart.year || !approximateStart.part) nextErrors.approximateStart = 'Please complete the approximate start schedule.'
      if (!approximateEnd.month || !approximateEnd.year || !approximateEnd.part) nextErrors.approximateEnd = 'Please complete the approximate end schedule.'
    }
    if (timingChoice === 'approximate' && !isApproximateEndAfterStart(approximateStart, approximateEnd)) {
      nextErrors.approximateEnd = 'Choose an approximate end after the term start.'
    }
    if ((timingChoice === 'approximate' || timingChoice === 'unknown') && !semesterPosition) {
      nextErrors.semesterPosition = 'Please select your current position in the term.'
    }
    if (Object.keys(nextErrors).length) { setFieldErrors(nextErrors); scrollToFirstInvalidField(Object.keys(nextErrors)); return }
    setFieldErrors({})

    const enrollment = {
      academicYear,
      yearLevel,
      semester,
      calendarType,
      termCode,
      timingMode: timingChoice === 'unknown' ? 'phase_only' : timingChoice,
      semesterStartDate: timingChoice === 'exact' ? semesterStartDate : undefined,
      semesterEndDate: timingChoice === 'exact' ? semesterEndDate : undefined,
      approximateStart: timingChoice === 'approximate' ? approximateStart : undefined,
      approximateEnd: timingChoice === 'approximate' ? approximateEnd : undefined,
      initialTrackingPhase: timingChoice !== 'exact' ? semesterPosition : undefined,
    }

    if (shouldReviewCollegeSetup(lifecycleAction)) {
      navigate('/college/setup/review', {
        state: {
          setupDraft: {
            selectedCourse,
            academicYear,
            yearLevel,
            semester,
            calendarType,
            termCode,
            timingChoice,
            semesterStartDate,
            semesterEndDate,
            approximateStart,
            approximateEnd,
            semesterPosition,
            payload: buildCollegeSetupPayload(lifecycleAction, selectedCourse, enrollment),
          },
        },
      })
      return
    }

    setLoading(true)
    try {
      const lifecycleEndpoints = {
        resume: '/api/college/tracking/resume',
        change: '/api/college/tracking/change-program',
      }
      const endpoint = lifecycleEndpoints[lifecycleAction] || '/api/college/setup'
      const response = await fetch(`${import.meta.env.VITE_API_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(buildCollegeSetupPayload(lifecycleAction, selectedCourse, enrollment)),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.message)
        setLoading(false)
        return
      }

      setSuccessMessage(lifecycleAction === 'resume' ? 'Tracking Resumed' : lifecycleAction === 'change' ? 'Program Changed' : 'College Phase Started')
      await waitForSuccessConfirmation()
      navigate('/college')
    } catch {
      setError('Cannot connect to server. Please try again.')
      setLoading(false)
    }
  }

  if (successMessage) return <div className="flex min-h-screen items-center justify-center bg-[#fbf8f3] px-5"><SuccessConfirmation message={successMessage} /></div>

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#fbf8f3] text-gray-900">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(circle_at_12%_16%,rgba(251,146,60,.11),transparent_28%),radial-gradient(circle_at_82%_22%,rgba(253,186,116,.1),transparent_28%),linear-gradient(115deg,rgba(255,255,255,.8),rgba(255,247,237,.24))]" />
      {/* Nav */}
      <nav className="relative z-10 mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-5 py-5 sm:px-8 lg:px-10">
        <span className="text-xl font-bold tracking-tight">
          Learn<span className="text-orange-500">Match</span>
        </span>
        <button
          onClick={() => navigate('/dashboard')}
          disabled={loading}
          className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition duration-150 hover:border-orange-200 hover:bg-orange-50 hover:text-orange-700 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
        >
          ← Back to Dashboard
        </button>
      </nav>

      <main className="relative z-0 mx-auto max-w-[1100px] px-5 pb-14 pt-7 sm:px-8 sm:pt-10 lg:px-10 lg:pb-20">
        <div className="mx-auto mb-9 max-w-2xl text-center">
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-orange-600">College Phase</p>
        <h1 className="text-3xl font-bold tracking-[-0.03em] text-gray-950 sm:text-4xl">
          {lifecycleAction === 'resume' ? 'Resume College Tracking' : lifecycleAction === 'change' ? 'Change your College Program' : 'Set up your College Phase'}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-gray-500 sm:text-base">
          {lifecycleAction === 'change'
            ? 'Select the program you are actually enrolled in and provide its current academic context.'
            : isResume
              ? 'Provide your fresh academic term and schedule details to continue tracking.'
              : 'Tell us about your current enrollment so we can track your academic alignment.'}
        </p>
        </div>

        {error && (
          <div role="alert" className="mx-auto mb-6 max-w-3xl rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="motion-stagger grid gap-6 lg:grid-cols-2 lg:items-start">
          <fieldset disabled={loading} className="contents">

          <section className="rounded-[26px] border border-white/90 bg-white/75 p-5 shadow-[0_22px_60px_-42px_rgba(120,53,15,.48)] backdrop-blur-xl sm:p-7">
            <div className="mb-6 flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-orange-100 text-orange-600"><IconSchool size={22} stroke={1.7} /></span>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-orange-600">Current enrollment</p>
                <h2 className="mt-1 text-lg font-bold tracking-tight text-gray-900">Enrollment Details</h2>
              </div>
            </div>
            <div className="space-y-6">

          {isResume ? (
            <ResumeProgramCard course={selectedCourse} loading={resumeProgramLoading} />
          ) : <>
          <p className="text-sm font-semibold text-gray-800">What course are you enrolled in? <RequiredMark /></p>
          {lifecycleAction === 'change' && (
            <p className="mt-1 text-xs leading-relaxed text-amber-700">This records your actual enrollment. It is not a new LearnMatch recommendation. Your previous program history will remain unchanged.</p>
          )}

          {/* Course search */}
          <div data-validation-field="course" aria-invalid={fieldErrors.course ? 'true' : undefined} aria-describedby={fieldErrors.course ? 'college-course-error' : undefined}>
            <label className="mb-3 flex items-center gap-3 text-xs font-medium text-gray-500">
              <span className="h-px flex-1 bg-gray-200" />
              Search for your enrolled course
              <span className="h-px flex-1 bg-gray-200" />
            </label>
            {!selectedCourse && <>
            <div className="relative">
              <IconSearch size={18} stroke={1.75} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={handleSearchChange}
                placeholder="Search by course name, abbreviation, or code..."
                aria-label="Search active courses by name, abbreviation, or code"
                className="w-full rounded-2xl border border-orange-200 bg-[#fffdf9] py-3.5 pl-11 pr-11 text-sm outline-none transition duration-150 hover:border-orange-300 focus:border-orange-400 focus:ring-4 focus:ring-orange-100/80"
              />
            </div>

            {/* Search results dropdown */}
            {searchStatus === 'loading' && !selectedCourse && (
              <p className="mt-2 text-xs text-gray-400">Finding courses...</p>
            )}
            {searchStatus === 'success' && courses.length > 0 && !selectedCourse && (
              <div className="course-suggestion-scroll mt-2 w-full rounded-xl border border-orange-100 bg-white shadow-lg">
                {courses.map((course) => (
                  <button
                    key={course.course_id}
                    type="button"
                    onClick={() => selectCourse(course)}
                    className="block w-full text-left px-4 py-3 hover:bg-orange-50 border-t border-gray-50 first:border-t-0 focus:outline-none focus:bg-orange-50"
                  >
                    <CourseName name={course.course_name} abbreviation={course.course_abbreviation} className="text-sm font-medium text-gray-800" secondaryClassName="mt-1 text-sm font-normal text-gray-500" />
                  </button>
                ))}
              </div>
            )}
            {searchStatus === 'success' && courses.length === 0 && !selectedCourse && (
              <p className="mt-2 text-xs text-gray-400">No active courses found.</p>
            )}
            {searchStatus === 'error' && !selectedCourse && (
              <p className="mt-2 text-xs text-red-500">Course search is unavailable. Please try again.</p>
            )}
            </>}

            {selectedCourse && (
              <div className="mt-2 bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 flex justify-between items-center">
                <div>
                  <CourseName name={selectedCourse.course_name} abbreviation={selectedCourse.course_abbreviation} className="text-sm font-medium text-gray-800" secondaryClassName="mt-1 text-sm font-normal text-gray-500" />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCourse(null)
                     setSearch('')
                     setCourses([])
                     setSearchStatus('idle')
                  }}
                  className="text-xs text-gray-400 hover:text-gray-600 disabled:hidden"
                >
                  Change
                </button>
              </div>
            )}
            <FieldError id="college-course-error">{fieldErrors.course}</FieldError>
          </div>
          </>}

          {/* Academic year */}
          <div data-validation-field="academicYear">
            <AcademicYearField academicYear={academicYear} isStored={isResume} />
            <FieldError id="academic-year-error">{fieldErrors.academicYear}</FieldError>
          </div>

          {/* Year level */}
          <div data-validation-field="yearLevel" aria-invalid={fieldErrors.yearLevel ? 'true' : undefined} aria-describedby={fieldErrors.yearLevel ? 'year-level-error' : undefined}>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              What year level are you in? <RequiredMark />
            </label>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year'].map((year, index) => (
                <button
                  key={year}
                  type="button"
                  disabled={!selectedCourse || index + 1 > programDuration}
                  onClick={() => { setYearLevel(year); setFieldErrors((current) => ({ ...current, yearLevel: undefined })) }}
                  className={`rounded-xl border py-3 text-sm font-medium transition duration-150 disabled:cursor-not-allowed disabled:border-gray-100 disabled:bg-gray-100 disabled:text-gray-300 ${
                    yearLevel === year
                      ? 'border-orange-400 bg-orange-50 text-orange-700 shadow-sm ring-1 ring-orange-200'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-orange-300 hover:bg-orange-50/40'
                  }`}
                >
                  {year.replace(' Year', '')}
                </button>
              ))}
            </div>
            <FieldError id="year-level-error">{fieldErrors.yearLevel}</FieldError>
          </div>

          {/* Academic calendar */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Academic calendar type <RequiredMark />
            </label>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(ACADEMIC_CALENDARS).map(([value, calendar]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setCalendarType(value)
                    setSemester('')
                    setTermCode('')
                  }}
                  className={`rounded-xl border py-3 text-sm font-medium transition duration-150 ${
                    calendarType === value
                      ? 'border-orange-400 bg-orange-50 text-orange-700 shadow-sm ring-1 ring-orange-200'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-orange-300 hover:bg-orange-50/40'
                  }`}
                >
                  {calendar.label}
                </button>
              ))}
            </div>
          </div>

          {/* Current term */}
          <div data-validation-field="semester" aria-invalid={fieldErrors.semester ? 'true' : undefined} aria-describedby={fieldErrors.semester ? 'semester-error' : undefined}>
            <label className="block text-sm font-medium text-gray-700 mb-2">Current term <RequiredMark /></label>
            <div className="grid grid-cols-2 gap-2">
              {getCalendarTerms(calendarType).map((term) => (
                <button key={term.code} type="button" onClick={() => handleSemesterChoice(term)} className={`rounded-xl border px-2 py-3 text-sm font-medium transition duration-150 ${semester === term.label ? 'border-orange-400 bg-orange-50 text-orange-700 shadow-sm ring-1 ring-orange-200' : 'border-gray-200 bg-white text-gray-600 hover:border-orange-300 hover:bg-orange-50/40'}`}>
                  {term.label}{term.optional ? ' (Optional)' : ''}
                </button>
              ))}
            </div>
            <FieldError id="semester-error">{fieldErrors.semester}</FieldError>
          </div>

            </div>
          </section>

          <section className="space-y-5 rounded-[26px] border border-white/90 bg-white/75 p-5 shadow-[0_22px_60px_-42px_rgba(120,53,15,.48)] backdrop-blur-xl sm:p-7">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-orange-100 text-orange-600"><IconCalendarEvent size={22} stroke={1.7} /></span>
              <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-orange-600">Term tracking</p>
              <h2 className="mt-1 text-lg font-bold tracking-tight text-gray-900">Plan your check-ins</h2>
              <p className="text-sm text-gray-500 mt-1">Help LearnMatch determine when your Early, Mid, and End term check-ins should happen.</p>
              </div>
            </div>

            <fieldset className="space-y-2"><legend className="mb-2 text-sm font-medium text-gray-700">Schedule information <RequiredMark /></legend>
              {[
                ['exact', 'I know my exact term dates'],
                ['approximate', 'I only know the approximate schedule'],
                ['unknown', "I don't know my term schedule"],
              ].map(([value, label]) => (
                <label key={value} className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3.5 transition duration-150 ${timingChoice === value ? 'border-orange-300 bg-orange-50/80 shadow-sm' : 'border-gray-200 bg-white hover:border-orange-200 hover:bg-orange-50/30'}`}>
                  <input type="radio" name="timing-choice" value={value} checked={timingChoice === value} onChange={() => setTimingChoice(value)} className="h-4 w-4 accent-orange-500" />
                  <span className="text-sm font-medium text-gray-700">{label}</span>
                </label>
              ))}
            </fieldset>

            {timingChoice === 'exact' && (
              <div className="grid sm:grid-cols-2 gap-4">
                <div data-validation-field="semesterStartDate">
                  <label htmlFor="semester-start" className="block text-sm font-medium text-gray-700 mb-2">Term start <RequiredMark /></label>
                  <input id="semester-start" type="date" min={academicDateMin} max={academicDateMax} value={semesterStartDate} required aria-required="true" aria-invalid={fieldErrors.semesterStartDate ? 'true' : undefined} aria-describedby={fieldErrors.semesterStartDate ? 'semester-start-error' : undefined} onChange={(event) => {
                    const nextStart = event.target.value
                    setSemesterStartDate(nextStart)
                    setFieldErrors((current) => ({ ...current, semesterStartDate: undefined }))
                    if (semesterEndDate && semesterEndDate <= nextStart) setSemesterEndDate('')
                  }} className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-orange-400 focus:ring-4 focus:ring-orange-100/80" />
                  <FieldError id="semester-start-error">{fieldErrors.semesterStartDate}</FieldError>
                </div>
                <div data-validation-field="semesterEndDate">
                  <label htmlFor="semester-end" className="block text-sm font-medium text-gray-700 mb-2">Term end <RequiredMark /></label>
                  <input id="semester-end" type="date" min={semesterStartDate || academicDateMin} max={academicDateMax} value={semesterEndDate} onChange={(event) => { setSemesterEndDate(event.target.value); setFieldErrors((current) => ({ ...current, semesterEndDate: undefined })) }} required aria-required="true" aria-invalid={fieldErrors.semesterEndDate ? 'true' : undefined} aria-describedby={fieldErrors.semesterEndDate ? 'semester-end-error' : undefined} className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-orange-400 focus:ring-4 focus:ring-orange-100/80" />
                  <FieldError id="semester-end-error">{fieldErrors.semesterEndDate}</FieldError>
                </div>
                {detectedExactPhase && (
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 sm:col-span-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Detected current phase</p>
                    <p className="mt-1 text-sm text-emerald-900"><strong>{EXACT_PHASE_LABELS[detectedExactPhase] || detectedExactPhase}</strong> — calculated from today and your exact term dates.</p>
                  </div>
                )}
              </div>
            )}

            {timingChoice === 'approximate' && (
              <ApproximateScheduleFields
                academicYears={academicYears}
                approximateStart={approximateStart}
                approximateEnd={approximateEnd}
                setApproximateStart={handleApproximateStartChange}
                setApproximateEnd={(value) => { setApproximateEnd(value); setFieldErrors((current) => ({ ...current, approximateEnd: undefined })) }}
                errors={fieldErrors}
              />
            )}

            {timingChoice === 'approximate' && (
              <SemesterPhaseSelector value={semesterPosition} onChange={(value) => { setSemesterPosition(value); setFieldErrors((current) => ({ ...current, semesterPosition: undefined })) }} error={fieldErrors.semesterPosition} />
            )}

            {timingChoice === 'unknown' && (
              <SemesterPhaseSelector value={semesterPosition} onChange={(value) => { setSemesterPosition(value); setFieldErrors((current) => ({ ...current, semesterPosition: undefined })) }} error={fieldErrors.semesterPosition} />
            )}
          </section>

          <div className="flex justify-center lg:col-span-2">
          <button
            type="submit"
            disabled={loading || resumeProgramLoading || !isFormComplete}
            className="inline-flex w-full max-w-md items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-orange-600 px-7 py-3.5 text-sm font-semibold text-white shadow-[0_12px_28px_-12px_rgba(234,88,12,.8)] transition duration-150 hover:-translate-y-0.5 hover:shadow-[0_16px_32px_-12px_rgba(234,88,12,.72)] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Saving...' : lifecycleAction === 'resume' ? 'Resume Tracking' : lifecycleAction === 'change' ? 'Confirm Program Change' : 'Continue to College Phase →'}
          </button>
          </div>
          </fieldset>
        </form>
      </main>
    </div>
  )
}

export default CollegeSetup
