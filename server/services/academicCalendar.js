export const ACADEMIC_CALENDARS = Object.freeze({
  semester: Object.freeze({
    label: 'Semester',
    terms: Object.freeze([
      Object.freeze({ code: 'SEM_1', label: '1st Semester', order: 1, optional: false }),
      Object.freeze({ code: 'SEM_2', label: '2nd Semester', order: 2, optional: false }),
    ]),
  }),
  trimester: Object.freeze({
    label: 'Trimester',
    terms: Object.freeze([
      Object.freeze({ code: 'TRI_1', label: '1st Trimester', order: 1, optional: false }),
      Object.freeze({ code: 'TRI_2', label: '2nd Trimester', order: 2, optional: false }),
      Object.freeze({ code: 'TRI_3', label: '3rd Trimester', order: 3, optional: false }),
    ]),
  }),
})

const LEGACY_TERMS = Object.freeze({
  '1st Semester': { calendarType: 'semester', termCode: 'SEM_1' },
  '2nd Semester': { calendarType: 'semester', termCode: 'SEM_2' },
  Summer: { calendarType: 'semester', termCode: 'SUMMER_MIDYEAR' },
  'Summer/Midyear': { calendarType: 'semester', termCode: 'SUMMER_MIDYEAR' },
  '3rd Semester': { calendarType: 'legacy', termCode: 'LEGACY_3RD_SEMESTER' },
})

export function getTermDefinition(calendarType, termCode) {
  return ACADEMIC_CALENDARS[calendarType]?.terms.find(({ code }) => code === termCode) || null
}

export function resolveCalendarTerm({ calendarType, termCode, semester } = {}) {
  if (calendarType && termCode) {
    const term = getTermDefinition(calendarType, termCode)
    if (term) return { calendarType, termCode, termLabel: term.label, optional: term.optional }
    if (termCode === 'SUMMER_MIDYEAR' && ['semester', 'trimester'].includes(calendarType)) {
      return { calendarType, termCode, termLabel: 'Summer/Midyear', optional: true, legacy: true }
    }
    return null
  }
  const legacy = LEGACY_TERMS[semester]
  if (!legacy) return null
  const term = getTermDefinition(legacy.calendarType, legacy.termCode)
  return { ...legacy, termLabel: term?.label || semester, optional: term?.optional || false }
}

export function resolveActiveCalendarTerm(input = {}) {
  const direct = getTermDefinition(input.calendarType, input.termCode)
  if (direct) {
    return { calendarType: input.calendarType, termCode: input.termCode, termLabel: direct.label, optional: false }
  }
  for (const [calendarType, calendar] of Object.entries(ACADEMIC_CALENDARS)) {
    if (input.calendarType && input.calendarType !== calendarType) continue
    const term = calendar.terms.find(({ label }) => label === input.semester)
    if (term) return { calendarType, termCode: term.code, termLabel: term.label, optional: false }
  }
  return null
}

export function calendarTermOptions(calendarType) {
  return ACADEMIC_CALENDARS[calendarType]?.terms || []
}
