export const ACADEMIC_CALENDARS = Object.freeze({
  semester: Object.freeze({
    label: 'Semester',
    terms: Object.freeze([
      Object.freeze({ code: 'SEM_1', label: '1st Semester', optional: false }),
      Object.freeze({ code: 'SEM_2', label: '2nd Semester', optional: false }),
      Object.freeze({ code: 'SUMMER_MIDYEAR', label: 'Summer/Midyear', optional: true }),
    ]),
  }),
  trimester: Object.freeze({
    label: 'Trimester',
    terms: Object.freeze([
      Object.freeze({ code: 'TRI_1', label: '1st Trimester', optional: false }),
      Object.freeze({ code: 'TRI_2', label: '2nd Trimester', optional: false }),
      Object.freeze({ code: 'TRI_3', label: '3rd Trimester', optional: false }),
      Object.freeze({ code: 'SUMMER_MIDYEAR', label: 'Summer/Midyear', optional: true }),
    ]),
  }),
})

export function getCalendarTerms(calendarType) {
  return ACADEMIC_CALENDARS[calendarType]?.terms || []
}

export function resolveCalendarTerm({ calendarType, termCode, semester } = {}) {
  const direct = getCalendarTerms(calendarType).find(({ code }) => code === termCode)
  if (direct) return { calendarType, termCode, label: direct.label }
  const legacy = {
    '1st Semester': ['semester', 'SEM_1'],
    '2nd Semester': ['semester', 'SEM_2'],
    Summer: ['semester', 'SUMMER_MIDYEAR'],
    'Summer/Midyear': ['semester', 'SUMMER_MIDYEAR'],
  }[semester]
  if (!legacy) return null
  return { calendarType: legacy[0], termCode: legacy[1], label: semester }
}
