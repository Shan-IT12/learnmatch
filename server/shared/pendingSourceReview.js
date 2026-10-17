export function stableReviewJson(value) {
  const canonical = (item) => Array.isArray(item) ? item.map(canonical) : item && typeof item === 'object' ? Object.fromEntries(Object.keys(item).sort().map((key) => [key, canonical(item[key])])) : item ?? null
  return JSON.stringify(canonical(value))
}
const text = (value) => typeof value === 'string' ? value.trim() || null : null
export function draftReviewFields(form) {
  const profiles = (key, dimension) => (form[key] || []).map((entry) => ({ [dimension]: entry[dimension], weight: entry.weight === '' ? null : Number(entry.weight), evidence: entry.evidence ?? null })).sort((a, b) => a[dimension].localeCompare(b[dimension]))
  return {
    course_name: { name: text(form.course_name), abbreviation: text(form.course_abbreviation) },
    description: text(form.description), obtainable_skills: text(form.obtainable_skills),
    duration: { years: form.program_duration_years === '' ? null : Number(form.program_duration_years), year_levels: (form.year_levels || []).map((entry) => ({ year: entry.year, label: text(entry.label), overview: typeof entry.overview === 'string' ? entry.overview.trim() : '' })) },
    matching_profile_evidence: { cluster: form.cluster_category, skills: profiles('skill_profile', 'skill_domain'), riasec: profiles('riasec_profile', 'riasec_type') },
  }
}
export function sourceClaimsBinding(source, fields) {
  const keys = [...new Set(['course_name', ...source.supported_fields])].sort()
  return stableReviewJson({ source: { title: text(source.title), url: text(source.url), supported_fields: [...source.supported_fields].sort(), notes: text(source.notes) }, claims: Object.fromEntries(keys.map((key) => [key, fields[key]])) })
}
export const pendingSourceBinding = (source, form) => sourceClaimsBinding(source, draftReviewFields(form))

// Checking always assesses these course facts, independently of the admin's confirmation selections.
export const sourceAnalysisFields = source => [...new Set(['course_name', 'description', 'obtainable_skills', 'duration', ...(source?.supported_fields || [])])].sort()
export const sourceAnalysisBinding = (source, fields) => stableReviewJson({
  comparison: sourceClaimsBinding({ ...source, supported_fields: sourceAnalysisFields(source) }, fields),
  selected_fields: [...source.supported_fields].sort(),
})
export const pendingSourceAnalysisBinding = (source, form) => sourceAnalysisBinding(source, draftReviewFields(form))
