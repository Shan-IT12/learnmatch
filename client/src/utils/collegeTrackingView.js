export const CHECKIN_PHASES = ['Early', 'Mid', 'End']

export function parseYearNumber(yearLevel) {
  const match = String(yearLevel || '').match(/\d+/)
  return match ? Number(match[0]) : null
}

export function getCurrentSemesterRecords(history = [], collegeInfo = {}) {
  const recordsByPhase = new Map()

  for (const record of history) {
    const belongsToCurrentSemester = collegeInfo.termId
      ? record.termId === collegeInfo.termId
      : record.courseCode === collegeInfo.courseCode &&
        record.yearLevel === collegeInfo.yearLevel &&
        record.semester === collegeInfo.semester

    if (
      belongsToCurrentSemester &&
      CHECKIN_PHASES.includes(record.phase) &&
      !recordsByPhase.has(record.phase)
    ) {
      recordsByPhase.set(record.phase, record)
    }
  }

  return CHECKIN_PHASES
    .map((phase) => recordsByPhase.get(phase))
    .filter(Boolean)
}

export function getPreviousSemesterRecords(history = [], collegeInfo = {}) {
  return history.filter((record) => collegeInfo.termId
    ? record.termId !== collegeInfo.termId
    : !(
      record.courseCode === collegeInfo.courseCode &&
      record.yearLevel === collegeInfo.yearLevel &&
      record.semester === collegeInfo.semester
    ))
}

export function getAlignmentTrend(records = []) {
  if (records.length < 2) return { direction: 'insufficient', delta: null }

  const previous = Number(records.at(-2).alignmentPercent)
  const latest = Number(records.at(-1).alignmentPercent)
  const delta = latest - previous

  if (delta > 0) return { direction: 'improving', delta }
  if (delta < 0) return { direction: 'declining', delta }
  return { direction: 'stable', delta: 0 }
}

export function getNextCheckinPhase(checkinStatus) {
  if (checkinStatus?.state === 'pending') return checkinStatus.phase || checkinStatus.currentPhase || null
  if (checkinStatus?.state === 'due') return checkinStatus.nextExpectedPhase || checkinStatus.nextPhase || null
  if (checkinStatus?.state === 'not_due') return checkinStatus.nextExpectedPhase || checkinStatus.nextPhase || null
  return null
}

export function isSemesterComplete(records = []) {
  return CHECKIN_PHASES.every((phase) => records.some((record) => record.phase === phase))
}

export function getNextAcademicStage(yearLevel, semester, programDurationYears, semesterComplete) {
  if (!semesterComplete) return null

  const currentYear = parseYearNumber(yearLevel)
  const duration = Number(programDurationYears)
  if (!currentYear || !Number.isInteger(duration) || currentYear > duration) return null

  if (semester === '1st Semester') {
    return {
      programCompleted: false,
      yearLevel,
      semester: '2nd Semester',
    }
  }
  if (semester === '2nd Semester' && currentYear === duration) {
    return { programCompleted: true, yearLevel: null, semester: null }
  }
  if (semester === '2nd Semester') {
    const nextYear = currentYear + 1
    const ordinal = nextYear === 1 ? 'st' : nextYear === 2 ? 'nd' : nextYear === 3 ? 'rd' : 'th'
    return {
      programCompleted: false,
      yearLevel: `${nextYear}${ordinal} Year`,
      semester: '1st Semester',
    }
  }
  return null
}

export function summarizeRoadmapOverview(overview, maximumLength = 220) {
  const text = String(overview || '').trim()
  if (text.length <= maximumLength) return text
  const shortened = text.slice(0, maximumLength + 1)
  const lastSpace = shortened.lastIndexOf(' ')
  return `${shortened.slice(0, lastSpace > 0 ? lastSpace : maximumLength).trim()}…`
}
