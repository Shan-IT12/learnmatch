const ACADEMIC_YEAR_PATTERN = /^(\d{4})\s*[-–]\s*(\d{4})$/
const ACADEMIC_YEAR_START_MONTH = 5

export function getCurrentAcademicYear(date = new Date()) {
  const calendarYear = date.getFullYear()
  const startYear = date.getMonth() >= ACADEMIC_YEAR_START_MONTH
    ? calendarYear
    : calendarYear - 1

  return `${startYear}-${startYear + 1}`
}

export function getAcademicYearOptions(value) {
  const match = String(value || '').trim().match(ACADEMIC_YEAR_PATTERN)
  if (!match) return []

  const startYear = Number(match[1])
  const endYear = Number(match[2])
  if (endYear !== startYear + 1) return []

  return Array.from(
    { length: endYear - startYear + 1 },
    (_, index) => String(startYear + index)
  )
}

const MONTH_PART_ORDER = Object.freeze({ early: 5, middle: 15, late: 25 })

export function approximateScheduleValue(value) {
  const year = Number(value?.year)
  const month = Number(value?.month)
  const day = MONTH_PART_ORDER[value?.part]
  if (!Number.isInteger(year) || !Number.isInteger(month) || !day) return null
  return year * 10000 + month * 100 + day
}

export function isApproximateEndAfterStart(start, end) {
  const startValue = approximateScheduleValue(start)
  const endValue = approximateScheduleValue(end)
  return startValue !== null && endValue !== null && endValue > startValue
}

export function calculateDisplayedSemesterPhase(startDate, endDate, currentDate = new Date()) {
  if (!startDate || !endDate) return null
  const start = Date.parse(`${startDate}T00:00:00Z`)
  const end = Date.parse(`${endDate}T00:00:00Z`)
  const current = Date.UTC(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate())
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null

  const progress = Math.min(1, Math.max(0, (current - start) / (end - start)))
  return progress <= 0.33 ? 'Early' : progress <= 0.66 ? 'Mid' : 'End'
}

export function buildCollegeSetupPayload(action, selectedCourse, enrollment) {
  return {
    ...(action === 'resume' ? {} : {
      courseId: selectedCourse?.course_id,
      courseName: selectedCourse?.course_name,
    }),
    ...enrollment,
  }
}
