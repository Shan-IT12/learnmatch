export const MAX_CAREER_OPPORTUNITIES = 20
export const enteredCareerOpportunities = rows => rows.filter(row => row.opportunity_id != null || ['job_title', 'salary_range', 'description'].some(key => typeof row[key] === 'string' && row[key].trim()))

export function validateCareerOpportunities(rows) {
  if (!Array.isArray(rows) || rows.length > MAX_CAREER_OPPORTUNITIES) return { error: 'Use at most 20 career opportunities.' }
  const values = [], ids = new Set()
  for (const row of rows) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return { error: 'Correct the career opportunity fields.' }
    const value = {}
    for (const [field, max] of [['job_title', 150], ['salary_range', 100], ['description', 3000]]) {
      if (row[field] != null && typeof row[field] !== 'string') return { error: 'Career opportunity fields must be text.' }
      value[field] = row[field]?.trim() || ''
      if (value[field].length > max) return { error: `Career ${field.replaceAll('_', ' ')} must use at most ${max} characters.` }
    }
    if (!value.job_title) return { error: 'Enter a job title for each career opportunity you include.' }
    if (row.opportunity_id != null) {
      if (!Number.isInteger(row.opportunity_id) || row.opportunity_id < 1 || ids.has(row.opportunity_id)) return { error: 'Invalid or repeated career opportunity ID.' }
      ids.add(row.opportunity_id); value.opportunity_id = row.opportunity_id
    }
    values.push(value)
  }
  return { value: values }
}
