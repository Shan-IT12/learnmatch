import { COURSE_SOURCE_FIELDS } from '../../../shared/courseSourceFields.js'

const groups = [
  { id: 'details', label: 'Course identity, cluster and complete details', keys: ['course_name', 'course_abbreviation', 'course_code', 'cluster_category', 'description', 'obtainable_skills', 'course_details'] },
  { id: 'duration', label: 'Supported duration and complete year levels', keys: ['program_duration_years', 'year_levels'] },
  { id: 'skills', label: 'Valid skill profile with evidence', keys: ['matching_profiles', 'skill_profile'] },
  { id: 'riasec', label: 'Valid RIASEC profile with evidence', keys: ['matching_profiles', 'riasec_profile'] },
  { id: 'sources', label: 'One to three valid sources with current manual confirmations', matches: key => key === 'sources' || /^source_\d+$/.test(key) },
  { id: 'coverage', label: 'Confirmed source support for all required information', keys: Object.keys(COURSE_SOURCE_FIELDS).map(field => `source_${field}`) },
  { id: 'matching', label: 'Separate matching-profile admin review for this revision', keys: ['matching_review'] },
]

export function publicationFieldLabel(field, sources = []) {
  const source = /^source_(\d+)$/.exec(field)
  if (source) return `Source: ${sources.find(row => Number(row.source_id) === Number(source[1]))?.title || `reference ${source[1]}`}`
  if (field.startsWith('source_') && COURSE_SOURCE_FIELDS[field.slice(7)]) return `Source support: ${COURSE_SOURCE_FIELDS[field.slice(7)]}`
  const labels = { matching_profiles: 'Matching profiles', skill_profile: 'Skill profile', riasec_profile: 'RIASEC profile', matching_review: 'Matching-profile review', sources: 'Sources', program_duration_years: 'Program duration', year_levels: 'Year levels' }
  return labels[field] || field.replaceAll('_', ' ')
}

// Interpret only the server's saved-revision validation; do not duplicate its eligibility rules.
export function publicationChecklist(review) {
  const errors = Object.entries(review.fieldErrors || {})
  const covered = new Set()
  const rows = groups.map(group => {
    const failures = errors.filter(([field]) => group.keys?.includes(field) || group.matches?.(field))
    failures.forEach(([field]) => covered.add(field))
    return { id: group.id, label: group.label, passed: !failures.length }
  })
  if (errors.some(([field]) => !covered.has(field)) || (!review.ready && !errors.length)) rows.push({ id: 'other', label: 'Additional server publication requirements', passed: false })
  return rows
}
