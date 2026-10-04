import { generateMismatchExplanation } from './collegeMismatchExplanationService.js'
import { getPublicCourse } from './publicCourseService.js'
import { isCurrentIndependentCourse } from './courseIdentityService.js'
import { ACADEMIC_CALENDARS, getTermDefinition, resolveActiveCalendarTerm, resolveCalendarTerm } from './academicCalendar.js'

export const CHECKIN_PHASES = ['Early', 'Mid', 'End']
export const YEAR_LEVELS = ['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year']
export const SEMESTERS = ['1st Semester', '2nd Semester', '3rd Semester', 'Summer', 'Summer/Midyear', '1st Trimester', '2nd Trimester', '3rd Trimester']
export const TIMING_MODES = ['exact', 'approximate', 'phase_only', 'manual']
export const MONTH_PARTS = ['early', 'middle', 'late']
export const ALIGNMENT_RULES = Object.freeze({
  passingGwa: 75,
  highAlignmentPercent: 70,
  onTrackMismatchExclusive: 30,
  monitorMismatchExclusive: 60,
})

// Internal LearnMatch estimation rule. These representative days are used only
// to make approximate month selections calculable; they are never presented as
// official or student-confirmed calendar dates.
export const APPROXIMATE_MONTH_DAYS = Object.freeze({ early: 5, middle: 15, late: 25 })

export class CollegeTrackingError extends Error {
  constructor(message, code = 'COLLEGE_TRACKING_ERROR', status = 400) {
    super(message)
    this.name = 'CollegeTrackingError'
    this.code = code
    this.status = status
  }
}

async function getLatestCycle(database, userId, { forUpdate = false } = {}) {
  const [rows] = await database.query(
    `SELECT tracking_cycle_id, user_id, course_id, status, end_reason
     FROM COLLEGE_TRACKING_CYCLE
     WHERE user_id = ?
     ORDER BY tracking_cycle_id DESC
     LIMIT 1${forUpdate ? ' FOR UPDATE' : ''}`,
    [userId]
  )
  return rows[0] || null
}

async function getActiveCycle(database, userId, { forUpdate = false } = {}) {
  const [rows] = await database.query(
    `SELECT tracking_cycle_id, user_id, course_id, status, end_reason
     FROM COLLEGE_TRACKING_CYCLE
     WHERE user_id = ? AND status = 'active'
     LIMIT 1${forUpdate ? ' FOR UPDATE' : ''}`,
    [userId]
  )
  return rows[0] || null
}

function normalizeTermWriteError(error) {
  if (error?.code === 'ER_DUP_ENTRY') {
    return new CollegeTrackingError(
      'That academic term is already recorded in this tracking cycle. Select your actual current term.',
      'TERM_ALREADY_EXISTS',
      409
    )
  }
  return error
}

function validateChoice(value, allowed, label) {
  if (!allowed.includes(value)) {
    throw new CollegeTrackingError(`Invalid ${label}.`, `INVALID_${label.toUpperCase().replace(/ /g, '_')}`)
  }
}

function parseDateOnly(value, label) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) {
    throw new CollegeTrackingError(`Invalid ${label}.`, `INVALID_${label.toUpperCase().replace(/ /g, '_')}`)
  }
  const [year, month, day] = value.split('-').map(Number)
  const timestamp = Date.UTC(year, month - 1, day)
  const parsed = new Date(timestamp)
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new CollegeTrackingError(`Invalid ${label}.`, `INVALID_${label.toUpperCase().replace(/ /g, '_')}`)
  }
  return timestamp
}

function dateOnlyString(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const year = value.getFullYear()
    const month = String(value.getMonth() + 1).padStart(2, '0')
    const day = String(value.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  return String(value || '').slice(0, 10)
}

export function normalizeAcademicYear(value) {
  const match = String(value || '').trim().match(/^(\d{4})\s*[-–]\s*(\d{4})$/)
  if (!match || Number(match[2]) !== Number(match[1]) + 1) {
    throw new CollegeTrackingError(
      'Academic year must contain consecutive years, for example 2026-2027.',
      'INVALID_ACADEMIC_YEAR'
    )
  }
  return `${match[1]}-${match[2]}`
}

export function validateCurrentOrFutureAcademicYear(value, currentDate = new Date()) {
  const normalized = normalizeAcademicYear(value)
  const currentStart = Number(normalizeAcademicYear(
    `${currentDate.getMonth() >= 5 ? currentDate.getFullYear() : currentDate.getFullYear() - 1}-${currentDate.getMonth() >= 5 ? currentDate.getFullYear() + 1 : currentDate.getFullYear()}`
  ).slice(0, 4))
  if (Number(normalized.slice(0, 4)) < currentStart) {
    throw new CollegeTrackingError('Past academic years are not allowed.', 'PAST_ACADEMIC_YEAR')
  }
  return normalized
}

export function normalizeApproximateDate(value, academicYear, label = 'approximate date') {
  const year = Number(value?.year)
  const month = Number(value?.month)
  const part = String(value?.part || '').toLowerCase()
  const [academicStart, academicEnd] = normalizeAcademicYear(academicYear).split('-').map(Number)

  if (!Number.isInteger(year) || ![academicStart, academicEnd].includes(year)) {
    throw new CollegeTrackingError(
      `${label} year must fall within the selected academic year.`,
      'INVALID_APPROXIMATE_DATE'
    )
  }
  if (!Number.isInteger(month) || month < 1 || month > 12 || !MONTH_PARTS.includes(part)) {
    throw new CollegeTrackingError(`Invalid ${label}.`, 'INVALID_APPROXIMATE_DATE')
  }

  return `${year}-${String(month).padStart(2, '0')}-${String(APPROXIMATE_MONTH_DAYS[part]).padStart(2, '0')}`
}

export function resolveTimingInput(input, academicYear, currentDate = new Date()) {
  const inferredMode = input.timingMode || (input.semesterStartDate || input.semesterEndDate ? 'exact' : 'manual')
  validateChoice(inferredMode, TIMING_MODES, 'timing mode')

  if (inferredMode === 'exact') {
    if (!input.semesterStartDate || !input.semesterEndDate) {
      throw new CollegeTrackingError('Enter both semester dates.', 'INVALID_SEMESTER_DATES')
    }
    const normalizedStart = dateOnlyString(input.semesterStartDate)
    const normalizedEnd = dateOnlyString(input.semesterEndDate)
    const allowedYears = normalizeAcademicYear(academicYear).split('-')
    if (!allowedYears.includes(normalizedStart.slice(0, 4)) || !allowedYears.includes(normalizedEnd.slice(0, 4))) {
      throw new CollegeTrackingError(
        'Term dates must fall within the selected academic year.',
        'INVALID_SEMESTER_DATES'
      )
    }
    const timing = calculateSemesterTiming(normalizedStart, normalizedEnd, currentDate)
    return {
      timingMode: inferredMode,
      semesterStartDate: normalizedStart,
      semesterEndDate: normalizedEnd,
      datesSource: 'student_confirmed',
      initialTrackingPhase: timing.expectedPhase === 'NOT_STARTED'
        ? null
        : timing.expectedPhase === 'ENDED' ? 'End' : timing.expectedPhase,
    }
  }

  if (inferredMode === 'approximate') {
    validateChoice(input.initialTrackingPhase, CHECKIN_PHASES, 'initial tracking phase')
    const semesterStartDate = normalizeApproximateDate(input.approximateStart, academicYear, 'semester start')
    const semesterEndDate = normalizeApproximateDate(input.approximateEnd, academicYear, 'semester end')
    const timing = calculateSemesterTiming(semesterStartDate, semesterEndDate, currentDate)
    return {
      timingMode: inferredMode,
      semesterStartDate,
      semesterEndDate,
      datesSource: 'estimated',
      initialTrackingPhase: input.initialTrackingPhase,
    }
  }

  if (inferredMode === 'phase_only') {
    validateChoice(input.initialTrackingPhase, CHECKIN_PHASES, 'initial tracking phase')
    return {
      timingMode: inferredMode,
      semesterStartDate: null,
      semesterEndDate: null,
      datesSource: null,
      initialTrackingPhase: input.initialTrackingPhase,
    }
  }

  return {
    timingMode: 'manual',
    semesterStartDate: null,
    semesterEndDate: null,
    datesSource: null,
    initialTrackingPhase: null,
  }
}

export function calculateSemesterTiming(startDate, endDate, currentDate = new Date()) {
  if (!startDate || !endDate) {
    return {
      timingAvailable: false,
      semesterProgress: null,
      expectedPhase: null,
      semesterState: 'unknown',
      semesterEnded: false,
    }
  }

  const start = parseDateOnly(dateOnlyString(startDate), 'semester start date')
  const end = parseDateOnly(dateOnlyString(endDate), 'semester end date')
  if (end <= start) {
    throw new CollegeTrackingError(
      'Term end date must be after the start date.',
      'INVALID_SEMESTER_DATES'
    )
  }

  const now = currentDate instanceof Date ? currentDate.getTime() : new Date(currentDate).getTime()
  if (!Number.isFinite(now)) {
    throw new CollegeTrackingError('Invalid current date.', 'INVALID_CURRENT_DATE')
  }
  const currentDay = Date.UTC(
    new Date(now).getUTCFullYear(),
    new Date(now).getUTCMonth(),
    new Date(now).getUTCDate()
  )
  const rawProgress = (now - start) / (end - start)
  const progress = Math.min(1, Math.max(0, rawProgress))
  const expectedPhase = currentDay < start
    ? 'NOT_STARTED'
    : currentDay > end
      ? 'ENDED'
      : progress <= 0.33 ? 'Early' : progress <= 0.66 ? 'Mid' : 'End'

  return {
    timingAvailable: true,
    semesterProgress: Math.round(progress * 100),
    semesterProgressRatio: progress,
    expectedPhase,
    semesterState: currentDay < start ? 'upcoming' : currentDay > end ? 'ended' : 'in_progress',
    semesterEnded: currentDay > end,
  }
}

export function buildPhaseStates(
  completedPhases = [],
  timing,
  { legacyCurrentPhase = null, initialTrackingPhase = null } = {}
) {
  const completed = new Set(completedPhases)
  const expectedPhase = timing?.expectedPhase || initialTrackingPhase || legacyCurrentPhase || 'Early'
  const completedHighestIndex = Math.max(-1, ...completedPhases.map((phase) => CHECKIN_PHASES.indexOf(phase)))
  const expectedIndex = timing?.timingAvailable
    ? expectedPhase === 'ENDED'
      ? CHECKIN_PHASES.length - 1
      : CHECKIN_PHASES.indexOf(expectedPhase)
    : Math.min(
      CHECKIN_PHASES.length - 1,
      Math.max(CHECKIN_PHASES.indexOf(expectedPhase), completedHighestIndex + 1)
    )

  return CHECKIN_PHASES.map((phase, index) => {
    if (completed.has(phase)) return { phase, state: 'completed' }
    const initialIndex = CHECKIN_PHASES.indexOf(initialTrackingPhase)
    if (initialIndex > 0 && index < initialIndex) return { phase, state: 'not_recorded' }
    if (!timing?.timingAvailable) {
      return { phase, state: index <= expectedIndex ? 'available' : 'upcoming' }
    }
    if (index < expectedIndex) return { phase, state: 'missed_available' }
    if (index === expectedIndex) return { phase, state: 'available' }
    return { phase, state: 'upcoming' }
  })
}

export function timingForCheckinAvailability(timing, timingMode, initialTrackingPhase) {
  if (timingMode !== 'approximate') return timing
  return {
    ...timing,
    timingAvailable: false,
    expectedPhase: initialTrackingPhase,
  }
}

function requiredTrackingPhases(initialTrackingPhase) {
  const startIndex = CHECKIN_PHASES.indexOf(initialTrackingPhase)
  return CHECKIN_PHASES.slice(startIndex < 0 ? 0 : startIndex)
}

function effectiveTrackingStartPhase(initialTrackingPhase, completedPhases = []) {
  if (CHECKIN_PHASES.includes(initialTrackingPhase)) return initialTrackingPhase
  return CHECKIN_PHASES.find((phase) => completedPhases.includes(phase)) || 'Early'
}

export function getNextSequentialCheckinPhase(completedPhases = [], initialTrackingPhase = null) {
  const completedIndexes = completedPhases
    .map((phase) => CHECKIN_PHASES.indexOf(phase))
    .filter((index) => index >= 0)
  if (completedIndexes.length > 0) {
    return CHECKIN_PHASES[Math.max(...completedIndexes) + 1] || null
  }
  return effectiveTrackingStartPhase(initialTrackingPhase, completedPhases)
}

export function validateCheckinAnswers(answers) {
  if (!Array.isArray(answers) || answers.length !== 5) {
    throw new CollegeTrackingError('Please answer all 5 check-in questions.', 'INVALID_CHECKIN_ANSWERS')
  }

  const normalized = answers.map((answer) => ({
    question_number: Number(answer.question_number),
    score: Number(answer.score),
  }))
  const questionNumbers = normalized.map(({ question_number }) => question_number).sort((a, b) => a - b)

  if (questionNumbers.join(',') !== '1,2,3,4,5') {
    throw new CollegeTrackingError('Each check-in question must be answered exactly once.', 'INVALID_CHECKIN_ANSWERS')
  }
  if (normalized.some(({ score }) => !Number.isInteger(score) || score < 1 || score > 5)) {
    throw new CollegeTrackingError('Check-in answers must use the 1 to 5 scale.', 'INVALID_CHECKIN_ANSWERS')
  }

  return normalized.sort((left, right) => left.question_number - right.question_number)
}

export function determineAlignmentStatus(alignmentPercent, { phase, gwa = null } = {}) {
  const mismatchScore = 100 - alignmentPercent

  if (phase === 'End' && gwa !== null) {
    const passing = gwa >= ALIGNMENT_RULES.passingGwa
    const highAlignment = alignmentPercent >= ALIGNMENT_RULES.highAlignmentPercent
    if (passing && highAlignment) return 'On Track'
    if (passing || highAlignment) return 'Monitor'
    return 'Needs Attention'
  }
  if (mismatchScore < ALIGNMENT_RULES.onTrackMismatchExclusive) return 'On Track'
  if (mismatchScore < ALIGNMENT_RULES.monitorMismatchExclusive) return 'Monitor'
  return 'Needs Attention'
}

export function calculateAlignmentResult(answers, { phase, gwa = null } = {}) {
  const normalizedAnswers = validateCheckinAnswers(answers)
  validateChoice(phase, CHECKIN_PHASES, 'check-in phase')

  const normalizedGwa = gwa === '' || gwa === undefined || gwa === null ? null : Number(gwa)
  if (normalizedGwa !== null && (!Number.isFinite(normalizedGwa) || normalizedGwa < 0 || normalizedGwa > 100)) {
    throw new CollegeTrackingError('GWA must be from 0 to 100.', 'INVALID_GWA')
  }
  if (phase !== 'End' && normalizedGwa !== null) {
    throw new CollegeTrackingError('GWA can only be recorded during the End check-in.', 'INVALID_GWA_PHASE')
  }

  const average = normalizedAnswers.reduce((sum, answer) => sum + answer.score, 0) / normalizedAnswers.length
  const alignmentPercent = Math.round(((average - 1) / 4) * 100)
  const mismatchScore = 100 - alignmentPercent
  const status = determineAlignmentStatus(alignmentPercent, { phase, gwa: normalizedGwa })

  return {
    answers: normalizedAnswers,
    gwa: normalizedGwa,
    alignmentPercent,
    alignmentScore: alignmentPercent / 100,
    mismatchScore,
    status,
  }
}

export function calculateNextAcademicStage(yearLevel, semester, programDurationYears, calendarType, termCode) {
  const yearMatch = String(yearLevel || '').match(/\d+/)
  const currentYear = yearMatch ? Number(yearMatch[0]) : NaN
  const duration = Number(programDurationYears)

  if (!Number.isInteger(currentYear) || !Number.isInteger(duration) || currentYear < 1 || currentYear > duration) {
    throw new CollegeTrackingError('The current program stage is invalid.', 'INVALID_PROGRAM_STAGE')
  }
  const resolved = resolveCalendarTerm({ calendarType, termCode, semester })
  if (!resolved || resolved.calendarType === 'legacy') {
    throw new CollegeTrackingError('The next academic stage requires confirmation.', 'UNSUPPORTED_TERM_PROGRESSION')
  }
  const { calendarType: resolvedCalendar, termCode: resolvedCode } = resolved
  if (resolvedCalendar === 'semester' && resolvedCode === 'SEM_1') {
    return {
      programCompleted: false,
      yearLevel: `${currentYear}${currentYear === 1 ? 'st' : currentYear === 2 ? 'nd' : currentYear === 3 ? 'rd' : 'th'} Year`,
      semester: '2nd Semester', calendarType: 'semester', termCode: 'SEM_2',
    }
  }
  if (resolvedCalendar === 'semester' && resolvedCode === 'SEM_2' && currentYear === duration) {
    return { programCompleted: true, yearLevel: null, semester: null }
  }
  if (resolvedCalendar === 'semester' && resolvedCode === 'SUMMER_MIDYEAR' && currentYear === duration) {
    return { programCompleted: true, yearLevel: null, semester: null, calendarType: 'semester', termCode: null }
  }
  if (resolvedCalendar === 'semester' && (resolvedCode === 'SEM_2' || resolvedCode === 'SUMMER_MIDYEAR')) {
    const nextYear = currentYear + 1
    return {
      programCompleted: false,
      yearLevel: `${nextYear}${nextYear === 1 ? 'st' : nextYear === 2 ? 'nd' : nextYear === 3 ? 'rd' : 'th'} Year`,
      semester: '1st Semester', calendarType: 'semester', termCode: 'SEM_1',
    }
  }

  if (resolvedCalendar === 'trimester' && resolvedCode !== 'TRI_3') {
    const nextCode = resolvedCode === 'TRI_1' ? 'TRI_2' : 'TRI_3'
    const next = getTermDefinition('trimester', nextCode)
    return { programCompleted: false, yearLevel, semester: next.label, calendarType: 'trimester', termCode: nextCode }
  }
  if (resolvedCalendar === 'trimester' && resolvedCode === 'TRI_3' && currentYear === duration) {
    return { programCompleted: true, yearLevel: null, semester: null, calendarType: 'trimester', termCode: null }
  }
  if (resolvedCalendar === 'trimester' && (resolvedCode === 'TRI_3' || resolvedCode === 'SUMMER_MIDYEAR')) {
    if (resolvedCode === 'SUMMER_MIDYEAR' && currentYear === duration) {
      return { programCompleted: true, yearLevel: null, semester: null, calendarType: 'trimester', termCode: null }
    }
    const nextYear = currentYear + 1
    const ordinal = nextYear === 1 ? 'st' : nextYear === 2 ? 'nd' : nextYear === 3 ? 'rd' : 'th'
    return { programCompleted: false, yearLevel: `${nextYear}${ordinal} Year`, semester: '1st Trimester', calendarType: 'trimester', termCode: 'TRI_1' }
  }

  throw new CollegeTrackingError(
    'Term progression is unavailable for this academic stage.',
    'UNSUPPORTED_SEMESTER_PROGRESSION'
  )
}

function validateYearWithinProgram(yearLevel, courseCode, resolveCourse = getPublicCourse) {
  validateChoice(yearLevel, YEAR_LEVELS, 'year level')
  const course = resolveCourse(courseCode)
  const duration = Number(course?.program_duration_years)
  const year = Number(String(yearLevel).match(/\d+/)?.[0])
  if (!Number.isInteger(duration) || !Number.isInteger(year) || year > duration) {
    throw new CollegeTrackingError(
      'Year level exceeds the selected program duration.',
      'INVALID_PROGRAM_STAGE'
    )
  }
  return course
}

export async function createCollegeSetup(
  pool,
  userId,
  {
    courseId,
    academicYear,
    yearLevel,
    semester,
    calendarType,
    termCode,
    semesterStartDate,
    semesterEndDate,
    timingMode,
    approximateStart,
    approximateEnd,
    initialTrackingPhase,
  },
  resolveCourse = getPublicCourse
) {
  const normalizedCourseId = Number(courseId)
  if (!Number.isInteger(normalizedCourseId) || normalizedCourseId <= 0) {
    throw new CollegeTrackingError('Please select a valid active course.', 'INVALID_COURSE')
  }
  const calendarTerm = resolveActiveCalendarTerm({ calendarType, termCode, semester })
  if (!calendarTerm || calendarTerm.calendarType === 'legacy') {
    throw new CollegeTrackingError('Select a valid term for the academic calendar.', 'INVALID_TERM')
  }
  semester = calendarTerm.termLabel
  const normalizedAcademicYear = validateCurrentOrFutureAcademicYear(academicYear)
  const timing = resolveTimingInput({
    timingMode,
    semesterStartDate,
    semesterEndDate,
    approximateStart,
    approximateEnd,
    initialTrackingPhase,
  }, normalizedAcademicYear)

  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    const [courses] = await connection.query(
      'SELECT course_id, course_code, course_name FROM COURSE WHERE course_id = ? AND is_active = 1',
      [normalizedCourseId]
    )
    if (courses.length === 0 || !isCurrentIndependentCourse(courses[0].course_code)) {
      throw new CollegeTrackingError('The selected course is unavailable or inactive.', 'COURSE_UNAVAILABLE', 404)
    }

    validateYearWithinProgram(yearLevel, courses[0].course_code, resolveCourse)

    let cycle = await getActiveCycle(connection, userId, { forUpdate: true })
    if (cycle && Number(cycle.course_id) !== normalizedCourseId) {
      throw new CollegeTrackingError(
        'Use Change Program to start tracking a different course.',
        'PROGRAM_CHANGE_REQUIRED',
        409
      )
    }
    if (!cycle) {
      const latestCycle = await getLatestCycle(connection, userId, { forUpdate: true })
      if (latestCycle?.status === 'paused') {
        throw new CollegeTrackingError('Resume your paused tracking instead.', 'TRACKING_PAUSED', 409)
      }
      const [cycleResult] = await connection.query(
        `INSERT INTO COLLEGE_TRACKING_CYCLE (user_id, course_id, status)
         VALUES (?, ?, 'active')`,
        [userId, normalizedCourseId]
      )
      cycle = { tracking_cycle_id: cycleResult.insertId, course_id: normalizedCourseId, status: 'active' }
    }

    const [existing] = await connection.query(
      `SELECT term_id, timing_mode
       FROM COLLEGE_TERM
       WHERE user_id = ? AND tracking_cycle_id = ? AND course_id = ? AND academic_year = ? AND year_level = ? AND term_code = ?
       LIMIT 1
       FOR UPDATE`,
      [userId, cycle.tracking_cycle_id, normalizedCourseId, normalizedAcademicYear, yearLevel, calendarTerm.termCode]
    )
    if (existing.length > 0) {
      if (timing.timingMode === 'exact' || timing.timingMode === 'approximate') {
        await connection.query(
          `UPDATE COLLEGE_TERM
           SET semester_start_date = ?, semester_end_date = ?, dates_source = ?, timing_mode = ?, initial_tracking_phase = ?
           WHERE term_id = ?`,
          [
            timing.semesterStartDate,
            timing.semesterEndDate,
            timing.datesSource,
            timing.timingMode,
            timing.initialTrackingPhase,
            existing[0].term_id,
          ]
        )
      }
      await connection.commit()
      return {
        created: false,
        timingUpdated: timing.timingMode === 'exact' || timing.timingMode === 'approximate',
        termId: existing[0].term_id,
        course: courses[0],
        calendarType: calendarTerm.calendarType,
        termCode: calendarTerm.termCode,
        semester,
      }
    }

    const [result] = await connection.query(
      `INSERT INTO COLLEGE_TERM
        (user_id, tracking_cycle_id, course_id, academic_year, year_level, calendar_type, term_code, semester,
         semester_start_date, semester_end_date, dates_source, timing_mode, initial_tracking_phase)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        cycle.tracking_cycle_id,
        normalizedCourseId,
        normalizedAcademicYear,
        yearLevel,
        calendarTerm.calendarType,
        calendarTerm.termCode,
        semester,
        timing.semesterStartDate,
        timing.semesterEndDate,
        timing.datesSource,
        timing.timingMode,
        timing.initialTrackingPhase,
      ]
    )
    await connection.commit()
    return {
      created: true,
      termId: result.insertId,
      course: courses[0],
      calendarType: calendarTerm.calendarType,
      termCode: calendarTerm.termCode,
      semester,
    }
  } catch (error) {
    await connection.rollback()
    throw normalizeTermWriteError(error)
  } finally {
    connection.release()
  }
}

async function insertLifecycleTerm(connection, userId, cycleId, course, input, resolveCourse) {
  const calendarTerm = resolveActiveCalendarTerm(input)
  if (!calendarTerm || calendarTerm.calendarType === 'legacy') {
    throw new CollegeTrackingError('Select a valid term for the academic calendar.', 'INVALID_TERM')
  }
  const academicYear = validateCurrentOrFutureAcademicYear(input.academicYear)
  validateYearWithinProgram(input.yearLevel, course.course_code, resolveCourse)
  const timing = resolveTimingInput(input, academicYear)
  const [existing] = await connection.query(
    `SELECT term_id FROM COLLEGE_TERM
     WHERE tracking_cycle_id = ? AND academic_year = ? AND year_level = ? AND term_code = ?
     LIMIT 1 FOR UPDATE`,
    [cycleId, academicYear, input.yearLevel, calendarTerm.termCode]
  )
  if (existing.length > 0) {
    throw new CollegeTrackingError(
      'That academic term is already recorded in this tracking cycle. Select your actual current term.',
      'TERM_ALREADY_EXISTS',
      409
    )
  }
  const [result] = await connection.query(
    `INSERT INTO COLLEGE_TERM
      (user_id, tracking_cycle_id, course_id, academic_year, year_level, calendar_type, term_code, semester,
       semester_start_date, semester_end_date, dates_source, timing_mode, initial_tracking_phase)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId, cycleId, course.course_id, academicYear, input.yearLevel,
      calendarTerm.calendarType, calendarTerm.termCode, calendarTerm.termLabel,
      timing.semesterStartDate, timing.semesterEndDate, timing.datesSource,
      timing.timingMode, timing.initialTrackingPhase,
    ]
  )
  return { termId: result.insertId, calendarType: calendarTerm.calendarType, termCode: calendarTerm.termCode }
}

export async function pauseCollegeTracking(pool, userId) {
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    const cycle = await getActiveCycle(connection, userId, { forUpdate: true })
    if (!cycle) throw new CollegeTrackingError('No active college tracking cycle found.', 'NO_ACTIVE_TRACKING', 409)
    await connection.query(
      `UPDATE COLLEGE_TRACKING_CYCLE
       SET status = 'paused', paused_at = CURRENT_TIMESTAMP, end_reason = NULL
       WHERE tracking_cycle_id = ?`,
      [cycle.tracking_cycle_id]
    )
    await connection.commit()
    return { trackingCycleId: cycle.tracking_cycle_id, lifecycleStatus: 'paused' }
  } catch (error) {
    await connection.rollback()
    throw normalizeTermWriteError(error)
  } finally {
    connection.release()
  }
}

export async function endCollegeTracking(pool, userId, reason = 'student_ended') {
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    const cycle = await getActiveCycle(connection, userId, { forUpdate: true })
    if (!cycle) throw new CollegeTrackingError('No active college tracking cycle found.', 'NO_ACTIVE_TRACKING', 409)
    await connection.query(
      `UPDATE COLLEGE_TRACKING_CYCLE
       SET status = 'ended', ended_at = CURRENT_TIMESTAMP, paused_at = NULL, end_reason = ?
       WHERE tracking_cycle_id = ?`,
      [String(reason || 'student_ended').slice(0, 32), cycle.tracking_cycle_id]
    )
    await connection.commit()
    return { trackingCycleId: cycle.tracking_cycle_id, lifecycleStatus: 'ended' }
  } catch (error) {
    await connection.rollback()
    throw normalizeTermWriteError(error)
  } finally {
    connection.release()
  }
}

export async function resumeCollegeTracking(pool, userId) {
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    const cycle = await getLatestCycle(connection, userId, { forUpdate: true })
    if (!cycle || cycle.status !== 'paused') {
      throw new CollegeTrackingError('Only paused college tracking can be resumed.', 'TRACKING_NOT_PAUSED', 409)
    }
    const [terms] = await connection.query(
      `SELECT term_id, course_id, academic_year, year_level, calendar_type, term_code, semester,
              semester_start_date, semester_end_date
       FROM COLLEGE_TERM
       WHERE user_id = ? AND tracking_cycle_id = ?
       ORDER BY term_id DESC
       LIMIT 1 FOR UPDATE`,
      [userId, cycle.tracking_cycle_id]
    )
    const storedTerm = terms[0]
    const normalizedTerm = storedTerm && resolveActiveCalendarTerm({
      calendarType: storedTerm.calendar_type,
      termCode: storedTerm.term_code,
      semester: storedTerm.semester || storedTerm.term_code,
    })
    if (!storedTerm || !normalizedTerm || Number(storedTerm.course_id) !== Number(cycle.course_id)) {
      throw new CollegeTrackingError(
        'Select a valid term for the academic calendar.',
        'INVALID_TERM'
      )
    }
    await connection.query(
      `UPDATE COLLEGE_TRACKING_CYCLE
       SET status = 'active', paused_at = NULL, end_reason = NULL
       WHERE tracking_cycle_id = ?`,
      [cycle.tracking_cycle_id]
    )
    await connection.commit()
    return {
      trackingCycleId: cycle.tracking_cycle_id,
      lifecycleStatus: 'active',
      termId: storedTerm.term_id,
      calendarType: normalizedTerm.calendarType,
      termCode: normalizedTerm.termCode,
    }
  } catch (error) {
    await connection.rollback()
    throw normalizeTermWriteError(error)
  } finally {
    connection.release()
  }
}

export async function changeCollegeProgram(pool, userId, termInput, resolveCourse = getPublicCourse) {
  const courseId = Number(termInput.courseId)
  if (!Number.isInteger(courseId) || courseId <= 0) {
    throw new CollegeTrackingError('Please select a valid active course.', 'INVALID_COURSE')
  }
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    const active = await getActiveCycle(connection, userId, { forUpdate: true })
    if (!active) throw new CollegeTrackingError('No active college tracking cycle found.', 'NO_ACTIVE_TRACKING', 409)
    if (Number(active.course_id) === courseId) {
      throw new CollegeTrackingError('Select a different program.', 'SAME_PROGRAM', 409)
    }
    const [courses] = await connection.query(
      'SELECT course_id, course_code, course_name FROM COURSE WHERE course_id = ? AND is_active = 1',
      [courseId]
    )
    if (courses.length === 0 || !isCurrentIndependentCourse(courses[0].course_code)) {
      throw new CollegeTrackingError('The selected course is unavailable or inactive.', 'COURSE_UNAVAILABLE', 404)
    }
    await connection.query(
      `UPDATE COLLEGE_TRACKING_CYCLE
       SET status = 'ended', ended_at = CURRENT_TIMESTAMP, end_reason = 'program_change'
       WHERE tracking_cycle_id = ?`,
      [active.tracking_cycle_id]
    )
    const [cycleResult] = await connection.query(
      `INSERT INTO COLLEGE_TRACKING_CYCLE (user_id, course_id, status)
       VALUES (?, ?, 'active')`,
      [userId, courseId]
    )
    const term = await insertLifecycleTerm(
      connection, userId, cycleResult.insertId, courses[0], termInput, resolveCourse
    )
    await connection.commit()
    return {
      ...term,
      trackingCycleId: cycleResult.insertId,
      lifecycleStatus: 'active',
      course: courses[0],
    }
  } catch (error) {
    await connection.rollback()
    throw normalizeTermWriteError(error)
  } finally {
    connection.release()
  }
}

export async function getCollegeStatus(database, userId, currentDate = new Date()) {
  const [termRows] = await database.query(
    `SELECT cycle.tracking_cycle_id, cycle.status AS lifecycle_status, cycle.end_reason,
            term.term_id, term.academic_year, term.year_level, term.calendar_type, term.term_code, term.semester,
            term.semester_start_date, term.semester_end_date, term.dates_source,
            term.timing_mode, term.initial_tracking_phase,
            c.course_id, c.course_code, c.course_name,
            (SELECT previous.gwa
             FROM SEMESTER_CHECKIN previous
             JOIN COLLEGE_TERM previous_term ON previous_term.term_id = previous.term_id
             WHERE previous.user_id = cycle.user_id
               AND previous_term.tracking_cycle_id = cycle.tracking_cycle_id
               AND previous.gwa IS NOT NULL
             ORDER BY previous.checkin_id DESC LIMIT 1) AS latest_gwa
     FROM COLLEGE_TRACKING_CYCLE cycle
     JOIN COURSE c ON c.course_id = cycle.course_id
     LEFT JOIN COLLEGE_TERM term ON term.term_id = (
       SELECT MAX(current_term.term_id) FROM COLLEGE_TERM current_term
       WHERE current_term.tracking_cycle_id = cycle.tracking_cycle_id
     )
     WHERE cycle.user_id = ?
     ORDER BY cycle.tracking_cycle_id DESC
     LIMIT 1`,
    [userId]
  )
  if (termRows.length > 0) {
    const row = termRows[0]
    return {
      trackingCycleId: row.tracking_cycle_id,
      lifecycleStatus: row.lifecycle_status,
      endReason: row.end_reason,
      termId: row.term_id,
      courseId: row.course_id,
      courseCode: row.course_code,
      courseName: row.course_name,
      academicYear: row.academic_year,
      yearLevel: row.year_level,
      semester: row.semester,
      calendarType: row.calendar_type || resolveCalendarTerm({ semester: row.semester })?.calendarType || 'legacy',
      termCode: row.term_code || resolveCalendarTerm({ semester: row.semester })?.termCode || null,
      termLabel: row.semester,
      semesterStartDate: row.semester_start_date,
      semesterEndDate: row.semester_end_date,
      datesSource: row.dates_source,
      timingMode: row.timing_mode,
      initialTrackingPhase: row.initial_tracking_phase,
      timingEstimated: row.timing_mode === 'approximate',
      latestGwa: row.latest_gwa === null ? null : Number(row.latest_gwa),
      ...calculateSemesterTiming(row.semester_start_date, row.semester_end_date, currentDate),
    }
  }

  const [rows] = await database.query(
    `SELECT sc.checkin_id, sc.year_level, sc.semester, sc.phase,
            c.course_id, c.course_code, c.course_name,
            (SELECT previous.gwa FROM SEMESTER_CHECKIN previous
             WHERE previous.user_id = sc.user_id AND previous.gwa IS NOT NULL
             ORDER BY previous.checkin_id DESC LIMIT 1) AS latest_gwa
     FROM SEMESTER_CHECKIN sc
     JOIN COURSE c ON c.course_id = sc.course_id
     WHERE sc.user_id = ? AND sc.term_id IS NULL
     ORDER BY sc.checkin_id DESC LIMIT 1`,
    [userId]
  )
  if (rows.length === 0) return null
  const row = rows[0]
  return {
    checkinId: row.checkin_id,
    courseId: row.course_id,
    courseCode: row.course_code,
    courseName: row.course_name,
    yearLevel: row.year_level,
    semester: row.semester,
    currentPhase: row.phase,
    latestGwa: row.latest_gwa === null ? null : Number(row.latest_gwa),
    academicYear: null,
    semesterStartDate: null,
    semesterEndDate: null,
    datesSource: null,
    timingMode: 'manual',
    initialTrackingPhase: null,
    timingEstimated: false,
    ...calculateSemesterTiming(null, null, currentDate),
  }
}

export async function getPendingCheckin(database, userId) {
  const [rows] = await database.query(
    `SELECT sc.checkin_id, sc.phase, c.course_code, c.course_name
     FROM SEMESTER_CHECKIN sc
     JOIN COURSE c ON c.course_id = sc.course_id
     WHERE sc.user_id = ?
       AND sc.term_id = (
         SELECT MAX(term.term_id)
         FROM COLLEGE_TERM term
         JOIN COLLEGE_TRACKING_CYCLE cycle ON cycle.tracking_cycle_id = term.tracking_cycle_id
         WHERE cycle.user_id = ? AND cycle.status = 'active'
       )
       AND NOT EXISTS (
         SELECT 1 FROM CHECKIN_ALIGNMENT_RESPONSE response
         WHERE response.checkin_id = sc.checkin_id
       )
     ORDER BY sc.checkin_id DESC
     LIMIT 1`,
    [userId, userId]
  )
  return rows[0] || null
}

export async function submitCollegeCheckin(
  pool,
  userId,
  { checkinId, answers, gwa },
  explainMismatch = generateMismatchExplanation
) {
  const normalizedCheckinId = Number(checkinId)
  if (!Number.isInteger(normalizedCheckinId) || normalizedCheckinId <= 0) {
    throw new CollegeTrackingError('Invalid check-in.', 'INVALID_CHECKIN')
  }

  const [ownedRows] = await pool.query(
    `SELECT sc.checkin_id, sc.phase, c.course_name
     FROM SEMESTER_CHECKIN sc
     JOIN COURSE c ON c.course_id = sc.course_id
     LEFT JOIN COLLEGE_TERM term ON term.term_id = sc.term_id
     LEFT JOIN COLLEGE_TRACKING_CYCLE cycle ON cycle.tracking_cycle_id = term.tracking_cycle_id
     WHERE sc.checkin_id = ? AND sc.user_id = ?
       AND (cycle.status = 'active' OR (
         sc.term_id IS NULL AND NOT EXISTS (
           SELECT 1 FROM COLLEGE_TRACKING_CYCLE owned_cycle WHERE owned_cycle.user_id = sc.user_id
         )
       ))`,
    [normalizedCheckinId, userId]
  )
  if (ownedRows.length === 0) {
    throw new CollegeTrackingError('Check-in not found.', 'CHECKIN_NOT_FOUND', 404)
  }

  const calculation = calculateAlignmentResult(answers, { phase: ownedRows[0].phase, gwa })
  const explanation = await explainMismatch({
    ...calculation,
    phase: ownedRows[0].phase,
    courseName: ownedRows[0].course_name,
  })

  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    const [lockedRows] = await connection.query(
      `SELECT checkin_id FROM SEMESTER_CHECKIN
       WHERE checkin_id = ? AND user_id = ? FOR UPDATE`,
      [normalizedCheckinId, userId]
    )
    if (lockedRows.length === 0) {
      throw new CollegeTrackingError('Check-in not found.', 'CHECKIN_NOT_FOUND', 404)
    }

    const [[existing]] = await connection.query(
      `SELECT
         (SELECT COUNT(*) FROM CHECKIN_ALIGNMENT_RESPONSE WHERE checkin_id = ?) AS response_count,
         (SELECT COUNT(*) FROM AI_MISMATCH_ANALYSIS WHERE checkin_id = ?) AS analysis_count`,
      [normalizedCheckinId, normalizedCheckinId]
    )
    if (Number(existing.response_count) > 0 || Number(existing.analysis_count) > 0) {
      throw new CollegeTrackingError('This check-in was already submitted.', 'CHECKIN_ALREADY_SUBMITTED', 409)
    }

    for (const answer of calculation.answers) {
      await connection.query(
        `INSERT INTO CHECKIN_ALIGNMENT_RESPONSE (checkin_id, question_number, answer_score)
         VALUES (?, ?, ?)`,
        [normalizedCheckinId, answer.question_number, answer.score]
      )
    }
    await connection.query(
      'UPDATE SEMESTER_CHECKIN SET gwa = ?, alignment_score = ? WHERE checkin_id = ?',
      [calculation.gwa, calculation.alignmentScore, normalizedCheckinId]
    )
    await connection.query(
      `INSERT INTO AI_MISMATCH_ANALYSIS
        (checkin_id, mismatch_score, status, ai_feedback, recommendation)
       VALUES (?, ?, ?, ?, ?)`,
      [
        normalizedCheckinId,
        Math.min(calculation.mismatchScore, 99.99),
        calculation.status,
        explanation.feedback,
        explanation.recommendation,
      ]
    )
    await connection.commit()
    return { ...calculation, ...explanation }
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

export async function getCheckinHistory(database, userId, limit = 10) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 10, 50))
  const [rows] = await database.query(
    `SELECT sc.checkin_id, sc.term_id, term.tracking_cycle_id, sc.phase, sc.year_level, sc.semester, sc.gwa,
            sc.alignment_score, sc.checkin_date, c.course_code, c.course_name,
            term.academic_year, term.calendar_type, term.term_code,
            analysis.mismatch_score, analysis.status, analysis.ai_feedback, analysis.recommendation
     FROM SEMESTER_CHECKIN sc
     JOIN COURSE c ON c.course_id = sc.course_id
     LEFT JOIN COLLEGE_TERM term ON term.term_id = sc.term_id
     JOIN AI_MISMATCH_ANALYSIS analysis ON analysis.analysis_id = (
       SELECT MAX(latest.analysis_id) FROM AI_MISMATCH_ANALYSIS latest
       WHERE latest.checkin_id = sc.checkin_id
     )
     WHERE sc.user_id = ?
     ORDER BY sc.checkin_id DESC
     LIMIT ?`,
    [userId, safeLimit]
  )
  return rows.map((row) => ({
    checkinId: row.checkin_id,
    termId: row.term_id,
    trackingCycleId: row.tracking_cycle_id || null,
    phase: row.phase,
    academicYear: row.academic_year,
    calendarType: row.calendar_type || null,
    termCode: row.term_code || null,
    termLabel: row.semester,
    yearLevel: row.year_level,
    semester: row.semester,
    gwa: row.gwa === null ? null : Number(row.gwa),
    alignmentPercent: row.alignment_score === null
      ? Math.round(100 - Number(row.mismatch_score))
      : Math.round(Number(row.alignment_score) * 100),
    status: row.status,
    feedback: row.ai_feedback,
    recommendation: row.recommendation,
    courseCode: row.course_code,
    courseName: row.course_name,
    checkinDate: row.checkin_date,
  }))
}

export async function getCheckinStatus(database, userId, currentDate = new Date()) {
  const pending = await getPendingCheckin(database, userId)
  const history = await getCheckinHistory(database, userId, 50)

  const college = await getCollegeStatus(database, userId, currentDate)
  const latestResult = college?.trackingCycleId
    ? history.find(({ trackingCycleId }) => Number(trackingCycleId) === Number(college.trackingCycleId)) || null
    : history[0] || null
  if (!college) return { state: 'complete', latestResult, phaseStates: [] }
  if (college.lifecycleStatus && college.lifecycleStatus !== 'active') {
    return {
      state: college.lifecycleStatus,
      lifecycleStatus: college.lifecycleStatus,
      latestResult,
      completedPhases: [],
      availablePhases: [],
      upcomingPhases: [],
      phaseStates: [],
      progressionEligible: false,
    }
  }

  let completedPhases = []
  if (college.termId) {
    const [completedRows] = await database.query(
      `SELECT DISTINCT sc.phase
       FROM SEMESTER_CHECKIN sc
       WHERE sc.user_id = ? AND sc.term_id = ?
         AND EXISTS (
           SELECT 1 FROM CHECKIN_ALIGNMENT_RESPONSE response
           WHERE response.checkin_id = sc.checkin_id
         )`,
      [userId, college.termId]
    )
    completedPhases = completedRows.map(({ phase }) => phase)
  } else {
    const [completedRows] = await database.query(
      `SELECT DISTINCT sc.phase
       FROM SEMESTER_CHECKIN sc
       WHERE sc.user_id = ? AND sc.term_id IS NULL
         AND sc.course_id = ? AND sc.year_level = ? AND sc.semester = ?
         AND EXISTS (
           SELECT 1 FROM CHECKIN_ALIGNMENT_RESPONSE response
           WHERE response.checkin_id = sc.checkin_id
         )`,
      [userId, college.courseId, college.yearLevel, college.semester]
    )
    completedPhases = completedRows.map(({ phase }) => phase)
  }

  const availabilityTiming = timingForCheckinAvailability(
    college,
    college.timingMode,
    college.initialTrackingPhase
  )
  const effectiveInitialPhase = effectiveTrackingStartPhase(college.initialTrackingPhase, completedPhases)
  let phaseStates = buildPhaseStates(completedPhases, availabilityTiming, {
    legacyCurrentPhase: college.currentPhase,
    initialTrackingPhase: effectiveInitialPhase,
  })
  const requiredPhases = requiredTrackingPhases(effectiveInitialPhase)
  const nextRequiredPhase = getNextSequentialCheckinPhase(completedPhases, effectiveInitialPhase)
  // Recommended timing is guidance, not a gate. Keep check-ins sequential while
  // allowing the next required phase to be completed early.
  if (nextRequiredPhase) {
    phaseStates = phaseStates.map((item) => item.phase === nextRequiredPhase && item.state === 'upcoming'
      ? { ...item, state: 'available_early' }
      : item)
  }
  const availablePhases = nextRequiredPhase ? [nextRequiredPhase] : []
  const allCheckinsCompleted = requiredPhases.every((phase) => completedPhases.includes(phase))
  const semesterTrackingCompleted = allCheckinsCompleted && college.semesterEnded
  const progressionEligible = allCheckinsCompleted

  return {
    state: allCheckinsCompleted ? 'complete' : pending ? 'pending' : availablePhases.length ? 'due' : 'not_due',
    checkinId: pending?.checkin_id || null,
    phase: pending?.phase || null,
    currentPhase: college.timingMode === 'approximate'
      ? college.initialTrackingPhase
      : college.expectedPhase || college.currentPhase,
    expectedPhase: college.expectedPhase,
    courseName: college.courseName,
    latestResult,
    completedPhases,
    availablePhases,
    upcomingPhases: phaseStates.filter(({ state }) => state === 'upcoming').map(({ phase }) => phase),
    phaseStates,
    allCheckinsCompleted,
    semesterTrackingCompleted,
    progressionEligible,
    semesterProgress: college.semesterProgress,
    semesterState: college.semesterState,
    semesterEnded: college.semesterEnded,
    timingAvailable: college.timingAvailable,
    timingMode: college.timingMode,
    timingEstimated: college.timingEstimated,
    initialTrackingPhase: college.initialTrackingPhase,
    requiredPhases,
    nextExpectedPhase: nextRequiredPhase,
    earlyCheckin: phaseStates.some(({ phase, state }) => phase === nextRequiredPhase && state === 'available_early'),
  }
}

export async function startNextCheckin(pool, userId, { phase: requestedPhase } = {}) {
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    const [termRows] = await connection.query(
      `SELECT term.term_id, term.course_id, term.year_level, term.semester,
              term.semester_start_date, term.semester_end_date,
              term.initial_tracking_phase, term.timing_mode
       FROM COLLEGE_TERM term
       JOIN COLLEGE_TRACKING_CYCLE cycle ON cycle.tracking_cycle_id = term.tracking_cycle_id
       WHERE term.user_id = ? AND cycle.status = 'active'
       ORDER BY term.term_id DESC LIMIT 1 FOR UPDATE`,
      [userId]
    )
    if (termRows.length > 0) {
      const term = termRows[0]
      const [completedRows] = await connection.query(
        `SELECT DISTINCT sc.phase
         FROM SEMESTER_CHECKIN sc
         WHERE sc.user_id = ? AND sc.term_id = ?
           AND EXISTS (
             SELECT 1 FROM CHECKIN_ALIGNMENT_RESPONSE response
             WHERE response.checkin_id = sc.checkin_id
           )`,
        [userId, term.term_id]
      )
      const completedPhases = completedRows.map(({ phase }) => phase)
      const nextRequiredPhase = getNextSequentialCheckinPhase(completedPhases, term.initial_tracking_phase)
      const phase = requestedPhase || nextRequiredPhase
      if (!nextRequiredPhase || phase !== nextRequiredPhase) {
        throw new CollegeTrackingError('That check-in is not currently available.', 'CHECKIN_NOT_AVAILABLE', 409)
      }

      const [existing] = await connection.query(
        `SELECT checkin_id FROM SEMESTER_CHECKIN
         WHERE user_id = ? AND term_id = ? AND phase = ?
         ORDER BY checkin_id DESC LIMIT 1`,
        [userId, term.term_id, phase]
      )
      if (existing.length > 0) {
        await connection.commit()
        return { created: false, checkinId: existing[0].checkin_id, phase }
      }

      const [result] = await connection.query(
        `INSERT INTO SEMESTER_CHECKIN
          (user_id, course_id, term_id, semester, phase, year_level)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [userId, term.course_id, term.term_id, term.semester, phase, term.year_level]
      )
      await connection.commit()
      return { created: true, checkinId: result.insertId, phase }
    }

    const [rows] = await connection.query(
      `SELECT checkin_id, course_id, year_level, semester, phase
       FROM SEMESTER_CHECKIN WHERE user_id = ? AND term_id IS NULL
       ORDER BY checkin_id DESC LIMIT 1 FOR UPDATE`,
      [userId]
    )
    if (rows.length === 0) throw new CollegeTrackingError('No prior enrollment found.', 'NO_ENROLLMENT')

    const last = rows[0]
    const [[completion]] = await connection.query(
      'SELECT COUNT(*) AS response_count FROM CHECKIN_ALIGNMENT_RESPONSE WHERE checkin_id = ?',
      [last.checkin_id]
    )
    if (Number(completion.response_count) !== 5) {
      await connection.commit()
      return { created: false, checkinId: last.checkin_id, phase: last.phase }
    }

    const nextPhase = CHECKIN_PHASES[CHECKIN_PHASES.indexOf(last.phase) + 1]
    if (!nextPhase) throw new CollegeTrackingError('All check-ins are complete for this semester.', 'CHECKINS_COMPLETE')

    const [existing] = await connection.query(
      `SELECT checkin_id FROM SEMESTER_CHECKIN
       WHERE user_id = ? AND course_id = ? AND year_level = ? AND semester = ? AND phase = ?
       ORDER BY checkin_id DESC LIMIT 1`,
      [userId, last.course_id, last.year_level, last.semester, nextPhase]
    )
    if (existing.length > 0) {
      await connection.commit()
      return { created: false, checkinId: existing[0].checkin_id, phase: nextPhase }
    }

    const [result] = await connection.query(
      `INSERT INTO SEMESTER_CHECKIN (user_id, course_id, semester, phase, year_level)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, last.course_id, last.semester, nextPhase, last.year_level]
    )
    await connection.commit()
    return { created: true, checkinId: result.insertId, phase: nextPhase }
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

function nextAcademicYear(academicYear, currentYearLevel, nextYearLevel) {
  const normalized = normalizeAcademicYear(academicYear)
  if (currentYearLevel === nextYearLevel) return normalized
  const [start, end] = normalized.split('-').map(Number)
  return `${start + 1}-${end + 1}`
}

export async function startNextSemester(pool, userId, termInput = {}, resolveCourse = getPublicCourse) {
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    let [latestRows] = await connection.query(
      `SELECT term.term_id, term.tracking_cycle_id, term.course_id, term.academic_year, term.year_level,
              term.calendar_type, term.term_code, term.semester, term.semester_start_date, term.semester_end_date,
              term.initial_tracking_phase, term.timing_mode,
              c.course_code, c.is_active
       FROM COLLEGE_TERM term
       JOIN COLLEGE_TRACKING_CYCLE cycle ON cycle.tracking_cycle_id = term.tracking_cycle_id
       JOIN COURSE c ON c.course_id = term.course_id
       WHERE term.user_id = ? AND cycle.status = 'active'
       ORDER BY term.term_id DESC LIMIT 1 FOR UPDATE`,
      [userId]
    )
    let legacy = false
    if (latestRows.length === 0) {
      ;[latestRows] = await connection.query(
        `SELECT NULL AS term_id, sc.course_id, NULL AS academic_year, sc.year_level,
                NULL AS calendar_type, NULL AS term_code,
                sc.semester, NULL AS semester_start_date, NULL AS semester_end_date,
                c.course_code, c.is_active
         FROM SEMESTER_CHECKIN sc
         JOIN COURSE c ON c.course_id = sc.course_id
         WHERE sc.user_id = ? AND sc.term_id IS NULL
         ORDER BY sc.checkin_id DESC LIMIT 1 FOR UPDATE`,
        [userId]
      )
      legacy = true
    }
    if (latestRows.length === 0) {
      throw new CollegeTrackingError('No college enrollment found.', 'NO_ENROLLMENT', 404)
    }

    const latest = latestRows[0]
    if (!latest.is_active) {
      throw new CollegeTrackingError('The enrolled course is unavailable or inactive.', 'COURSE_UNAVAILABLE', 404)
    }
    const [recentRows] = await connection.query(
      `SELECT sc.phase,
              COUNT(response.response_id) AS response_count
       FROM SEMESTER_CHECKIN sc
       LEFT JOIN CHECKIN_ALIGNMENT_RESPONSE response ON response.checkin_id = sc.checkin_id
       WHERE sc.user_id = ? AND ${legacy
         ? 'sc.term_id IS NULL AND sc.course_id = ? AND sc.year_level = ? AND sc.semester = ?'
         : 'sc.term_id = ?'}
       GROUP BY sc.checkin_id, sc.phase
       ORDER BY sc.checkin_id`,
      legacy
        ? [userId, latest.course_id, latest.year_level, latest.semester]
        : [userId, latest.term_id]
    )
    const completedPhases = recentRows
      .filter(({ response_count }) => Number(response_count) === 5)
      .map(({ phase }) => phase)
    const completedCurrentSemester = requiredTrackingPhases(latest.initial_tracking_phase)
      .every((phase) => completedPhases.includes(phase))
    if (!completedCurrentSemester) {
      throw new CollegeTrackingError(
        'Complete all check-ins before starting the next term.',
        'SEMESTER_NOT_COMPLETE',
        409
      )
    }

    const course = resolveCourse(latest.course_code)
    if (!course?.program_duration_years) {
      throw new CollegeTrackingError('The program roadmap is unavailable.', 'ROADMAP_UNAVAILABLE', 409)
    }
    const latestCalendarTerm = resolveCalendarTerm({
      calendarType: latest.calendar_type,
      termCode: latest.term_code,
      semester: latest.semester,
    })
    const institutionDependentProgression = !latestCalendarTerm || latestCalendarTerm.calendarType === 'legacy'
    let nextStage
    if (institutionDependentProgression) {
      const confirmedTerm = resolveActiveCalendarTerm({
        calendarType: termInput.calendarType,
        termCode: termInput.termCode,
        semester: termInput.nextSemester,
      })
      if (!confirmedTerm || confirmedTerm.calendarType === 'legacy') {
        throw new CollegeTrackingError('Select a valid next term.', 'INVALID_TERM')
      }
      validateYearWithinProgram(termInput.nextYearLevel, latest.course_code, resolveCourse)
      if (termInput.nextYearLevel === latest.year_level && termInput.nextSemester === latest.semester) {
        throw new CollegeTrackingError(
          'The next academic stage must differ from the completed term.',
          'INVALID_PROGRAM_STAGE'
        )
      }
      nextStage = {
        programCompleted: false,
        yearLevel: termInput.nextYearLevel,
        semester: confirmedTerm.termLabel,
        calendarType: confirmedTerm.calendarType,
        termCode: confirmedTerm.termCode,
      }
    } else {
      nextStage = calculateNextAcademicStage(
        latest.year_level,
        latest.semester,
        course.program_duration_years,
        latestCalendarTerm.calendarType,
        latestCalendarTerm.termCode
      )
    }
    if (nextStage.programCompleted) {
      await connection.commit()
      return { created: false, programCompleted: true }
    }

    const academicYear = legacy || institutionDependentProgression
      ? normalizeAcademicYear(termInput.academicYear)
      : nextAcademicYear(latest.academic_year, latest.year_level, nextStage.yearLevel)
    const normalizedInputYear = normalizeAcademicYear(termInput.academicYear)
    if (!legacy && !institutionDependentProgression && normalizedInputYear !== academicYear) {
      throw new CollegeTrackingError(`The next academic year must be ${academicYear}.`, 'INVALID_ACADEMIC_YEAR')
    }
    const newTiming = resolveTimingInput(termInput, academicYear)

    const [existing] = await connection.query(
      `SELECT term_id FROM COLLEGE_TERM
       WHERE user_id = ? AND tracking_cycle_id = ? AND course_id = ? AND academic_year = ?
         AND year_level = ? AND calendar_type = ? AND term_code = ? LIMIT 1`,
      [userId, latest.tracking_cycle_id, latest.course_id, academicYear, nextStage.yearLevel, nextStage.calendarType, nextStage.termCode]
    )
    if (existing.length > 0) {
      await connection.commit()
      return {
        created: false,
        programCompleted: false,
        termId: existing[0].term_id,
        yearLevel: nextStage.yearLevel,
        semester: nextStage.semester,
        calendarType: nextStage.calendarType,
        termCode: nextStage.termCode,
      }
    }

    const [result] = await connection.query(
      `INSERT INTO COLLEGE_TERM
        (user_id, tracking_cycle_id, course_id, academic_year, year_level, calendar_type, term_code, semester,
         semester_start_date, semester_end_date, dates_source, timing_mode, initial_tracking_phase)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        latest.tracking_cycle_id,
        latest.course_id,
        academicYear,
        nextStage.yearLevel,
        nextStage.calendarType,
        nextStage.termCode,
        nextStage.semester,
        newTiming.semesterStartDate,
        newTiming.semesterEndDate,
        newTiming.datesSource,
        newTiming.timingMode,
        newTiming.initialTrackingPhase,
      ]
    )
    await connection.commit()
    return {
      created: true,
      programCompleted: false,
      termId: result.insertId,
      academicYear,
      yearLevel: nextStage.yearLevel,
      semester: nextStage.semester,
      calendarType: nextStage.calendarType,
      termCode: nextStage.termCode,
    }
  } catch (error) {
    await connection.rollback()
    throw normalizeTermWriteError(error)
  } finally {
    connection.release()
  }
}
