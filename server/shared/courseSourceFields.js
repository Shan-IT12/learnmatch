// The keys are persisted; labels are shared by admin validation and the editor.
export const COURSE_SOURCE_FIELDS = Object.freeze({
  course_name: 'Course name',
  description: 'Description',
  obtainable_skills: 'Obtainable skills',
  duration: 'Duration',
  matching_profile_evidence: 'Matching-profile evidence',
})

export function validateCourseSource(input) {
  const errors = {}
  const text = (key, max, required = false) => {
    if (typeof input?.[key] !== 'string' && !(key === 'notes' && input?.[key] == null)) {
      errors[key] = 'Enter text for this field.'
      return ''
    }
    const value = (input?.[key] || '').trim()
    if ((required && !value) || value.length > max) errors[key] = required && !value ? 'This field is required.' : `Use at most ${max} characters.`
    return value
  }
  const title = text('title', 255, true)
  const url = text('url', 2048, true)
  const notes = text('notes', 5000)
  try {
    const parsed = new URL(url)
    if (!/^https?:\/\//i.test(url) || !['https:', 'http:'].includes(parsed.protocol) || !parsed.hostname || parsed.username || parsed.password || /[\u0000-\u0020\u007f]/u.test(url)) throw new Error()
  } catch { errors.url = 'Enter a full HTTP or HTTPS URL without credentials or spaces.' }
  const fields = input?.supported_fields
  if (!Array.isArray(fields) || !fields.length || fields.length > 5 || fields.some((key) => !Object.hasOwn(COURSE_SOURCE_FIELDS, key)) || new Set(fields).size !== fields.length) errors.supported_fields = 'Select one or more supported information types without duplicates.'
  return { errors, value: { title, url, notes: notes || null, supported_fields: Array.isArray(fields) ? [...fields].sort() : [] } }
}
