export const ACADEMIC_CALENDARS = Object.freeze({
  semester: Object.freeze({
    label: 'Semester',
    terms: Object.freeze([
      Object.freeze({ code: 'SEM_1', label: '1st Semester', order: 1, optional: false }),
      Object.freeze({ code: 'SEM_2', label: '2nd Semester', order: 2, optional: false }),
      Object.freeze({ code: 'SUMMER_MIDYEAR', label: 'Summer/Midyear', order: 3, optional: true }),
    ]),
  }),
  trimester: Object.freeze({
    label: 'Trimester',
    terms: Object.freeze([
      Object.freeze({ code: 'TRI_1', label: '1st Trimester', order: 1, optional: false }),
      Object.freeze({ code: 'TRI_2', label: '2nd Trimester', order: 2, optional: false }),
      Object.freeze({ code: 'TRI_3', label: '3rd Trimester', order: 3, optional: false }),
      Object.freeze({ code: 'SUMMER_MIDYEAR', label: 'Summer/Midyear', order: 4, optional: true }),
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
    if (!term) return null
    return { calendarType, termCode, termLabel: term.label, optional: term.optional }
  }
  const legacy = LEGACY_TERMS[semester]
  if (!legacy) return null
  const term = getTermDefinition(legacy.calendarType, legacy.termCode)
  return { ...legacy, termLabel: term?.label || semester, optional: term?.optional || false }
}

export function calendarTermOptions(calendarType) {
  return ACADEMIC_CALENDARS[calendarType]?.terms || []
}
