import { getCalendarTerms } from '../constants/academicCalendars.js'
import { getAcademicYearOptions, isApproximateEndAfterStart } from './collegeSchedule.js'

export function termDateErrors(start, end, academicYears, { partial = false } = {}) {
  const errors = {}
  const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') &&
    Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
  for (const [field, value, label] of [['semesterStartDate', start, 'start'], ['semesterEndDate', end, 'end']]) {
    if (!value) { if (!partial) errors[field] = `Please select the term ${label} date.` }
    else if (!validDate(value)) errors[field] = `Please enter a valid term ${label} date.`
    else if (!academicYears.includes(value.slice(0, 4))) errors[field] = 'Term dates must fall within the selected academic year.'
  }
  if (validDate(start) && validDate(end) && end <= start) {
    errors.semesterEndDate = 'The end date must be later than the start date.'
  }
  return errors
}

export function validateCollegeSetup({ selectedCourse, academicYear, yearLevel, programDuration, calendarType,
  termCode, semester, timingChoice, semesterStartDate, semesterEndDate, approximateStart, approximateEnd, semesterPosition }) {
  const errors = {}
  const years = getAcademicYearOptions(academicYear)
  if (!selectedCourse) errors.course = 'Please select a course from the list.'
  if (years.length !== 2) errors.academicYear = 'The academic year is unavailable. Please reload the page.'
  const year = Number(String(yearLevel).match(/\d+/)?.[0])
  if (!Number.isInteger(year) || year < 1 || year > programDuration) errors.yearLevel = 'Please select a valid year level for this course.'
  if (!getCalendarTerms(calendarType).some(term => term.code === termCode && term.label === semester)) {
    errors.semester = 'Please select a valid term for this academic calendar.'
  }
  if (timingChoice === 'exact') Object.assign(errors, termDateErrors(semesterStartDate, semesterEndDate, years))
  if (timingChoice === 'approximate') {
    const complete = value => value && Number(value.month) >= 1 && Number(value.month) <= 12 &&
      years.includes(value.year) && ['early', 'middle', 'late'].includes(value.part)
    if (!complete(approximateStart)) errors.approximateStart = 'Please complete the approximate start within the academic year.'
    if (!complete(approximateEnd)) errors.approximateEnd = 'Please complete the approximate end within the academic year.'
    else if (complete(approximateStart) && !isApproximateEndAfterStart(approximateStart, approximateEnd)) {
      errors.approximateEnd = 'The approximate end must be later than the start.'
    }
  }
  if (['approximate', 'unknown'].includes(timingChoice) && !['Early', 'Mid', 'End'].includes(semesterPosition)) {
    errors.semesterPosition = 'Please select your current position in the term.'
  }
  if (!['exact', 'approximate', 'unknown'].includes(timingChoice)) errors.semesterPosition = 'Please select how you will provide your term schedule.'
  return errors
}
