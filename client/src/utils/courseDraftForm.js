import { enteredCareerOpportunities, validateCareerOpportunities } from '../../../shared/courseCareerFields.js'

export const emptyDraftFields = {
  career_opportunities: [],
  course_abbreviation: '',
  program_duration_years: '', year_levels: [], skill_profile: [],
  riasec_profile: ['R', 'I', 'A', 'S', 'E', 'C'].map((riasec_type) => ({ riasec_type, weight: '', evidence: '' })),
}

export function draftFormFromCourse(data) {
  return {
    career_opportunities: (data.careers || []).map(({ opportunity_id, job_title, salary_range, description }) => ({ opportunity_id, job_title, salary_range: salary_range || '', description: description || '' })),
    course_abbreviation: data.course.course_abbreviation || '',
    program_duration_years: data.course.program_duration_years ?? '', year_levels: data.course.year_levels || [],
    skill_profile: data.skillProfile || [],
    riasec_profile: emptyDraftFields.riasec_profile.map((entry) => data.riasecProfile?.find((row) => row.riasec_type === entry.riasec_type) || { ...entry }),
  }
}

export function resizeCourseYears(form, duration) {
  return { ...form, program_duration_years: duration, year_levels: Array.from({ length: Number(duration) }, (_, i) =>
    form.year_levels[i] || { year: i + 1, label: `${i + 1}${['st', 'nd', 'rd'][i] || 'th'} Year`, overview: '' }) }
}

export function buildDraftPayload(form, requireComplete, initialForm = null) {
  const payload = { ...form }
  // These legacy fields are no longer managed by the draft form.
  delete payload.program_type
  delete payload.psced_group
  const errors = {}
  if (!requireComplete || initialForm && JSON.stringify(form.career_opportunities) === JSON.stringify(initialForm.career_opportunities)) delete payload.career_opportunities
  else if (Array.isArray(form.career_opportunities)) {
    const careers = validateCareerOpportunities(enteredCareerOpportunities(form.career_opportunities))
    if (careers.error) errors.career_opportunities = careers.error
    else payload.career_opportunities = careers.value
  }
  const durationUnchanged = initialForm && form.program_duration_years === initialForm.program_duration_years
    && JSON.stringify(form.year_levels) === JSON.stringify(initialForm.year_levels)
  if (durationUnchanged) { delete payload.program_duration_years; delete payload.year_levels }
  else if (form.program_duration_years !== '') {
    payload.program_duration_years = Number(form.program_duration_years)
    if (!Number.isInteger(payload.program_duration_years) || payload.program_duration_years < 1 || payload.program_duration_years > 5
      || form.year_levels.length !== payload.program_duration_years
      || form.year_levels.some((entry, i) => entry.year !== i + 1 || !entry.label.trim() || entry.label.length > 30 || entry.overview.length > 5000)) errors.program_duration_years = 'Select a supported duration and provide its year levels with labels.'
  } else if (requireComplete) errors.program_duration_years = 'Select the program duration.'
  else { delete payload.program_duration_years; delete payload.year_levels }
  const hasProfiles = form.skill_profile.length > 0 || form.riasec_profile.some((row) => row.weight !== '')
  const profilesUnchanged = initialForm && ['skill_profile', 'riasec_profile'].every((key) => JSON.stringify(form[key]) === JSON.stringify(initialForm[key]))
  if (profilesUnchanged) { delete payload.skill_profile; delete payload.riasec_profile }
  else if (requireComplete || hasProfiles) {
    if (!form.skill_profile.length || form.skill_profile.some((row) => row.weight === '' || !Number.isInteger(Number(row.weight)) || Number(row.weight) < 1 || Number(row.weight) > 3)
      || form.riasec_profile.length !== 6 || form.riasec_profile.some((row) => row.weight === '' || !Number.isInteger(Number(row.weight)) || Number(row.weight) < 0 || Number(row.weight) > 3)) {
      errors.matching_profiles = 'Enter at least one skill weight (1–3) and all six RIASEC weights (0–3).'
    }
    for (const key of ['skill_profile', 'riasec_profile']) payload[key] = form[key].map((row) => ({ ...row, weight: row.weight === '' ? null : Number(row.weight) }))
  } else { delete payload.skill_profile; delete payload.riasec_profile }
  return { payload, errors }
}
