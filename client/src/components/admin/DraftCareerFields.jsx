import DraftDisclosure, { DraftGuidance } from './DraftDisclosure'
import { RequiredMark, FieldError } from '../FormValidation'
import { MAX_CAREER_OPPORTUNITIES } from '../../../../shared/courseCareerFields'

const DEFAULT_SALARY_YEAR = '2025-2026'

function splitSalaryReference(value) {
  const raw = String(value || '')
  const match = raw.match(/^(.*?)\s*\(Est\.\s*([^)]+)\)\s*$/i)
  if (match) {
    return { amount: match[1].trim(), year: match[2].trim() || DEFAULT_SALARY_YEAR }
  }
  return { amount: raw, year: DEFAULT_SALARY_YEAR }
}

function combineSalaryReference(amount, year) {
  const cleanAmount = String(amount || '').trim()
  if (!cleanAmount) return ''
  const cleanYear = String(year || '').trim()
  const combined = cleanYear ? `${cleanAmount} (Est. ${cleanYear})` : cleanAmount
  return combined.slice(0, 100)
}

export default function DraftCareerFields({ form, setForm, error }) {
  const rows = form.career_opportunities || []
  const update = (index, field, value) => setForm(current => ({ ...current, career_opportunities: current.career_opportunities.map((row, i) => i === index ? { ...row, [field]: value } : row) }))
  return <div data-validation-field="career_opportunities"><DraftDisclosure title="Career Opportunities" hasError={Boolean(error)}>
    <p className="mb-2 text-sm text-gray-600">Optional. Add source-supported career paths for this course. Leave unsupported salary information blank.</p>
    <DraftGuidance><p>Enter a job title, an optional description and optional salary reference text. Do not guess salaries or claim professional eligibility without supporting evidence. These entries do not create matching weights or publish the course.</p></DraftGuidance>
    <FieldError>{error}</FieldError>
    {rows.map((row, index) => {
      const { amount, year } = splitSalaryReference(row.salary_range)
      return <div key={row.opportunity_id || row.client_id || index} className="mt-4 grid min-w-0 grid-cols-1 gap-4 border-t border-gray-100 pt-4 md:grid-cols-2">
        <label className="text-sm">Job title <RequiredMark /><input value={row.job_title} maxLength={150} aria-invalid={Boolean(error && !row.job_title.trim())} onChange={event => update(index, 'job_title', event.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2" placeholder="Ex. A role documented by your reference" /></label>
        <div className="grid grid-cols-[1fr_7.5rem] gap-2">
          <label className="text-sm">Salary reference (optional)<input value={amount} maxLength={80} onChange={event => update(index, 'salary_range', combineSalaryReference(event.target.value, year))} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2" placeholder="e.g. PHP 25,000 - 45,000/mo" /></label>
          <label className="text-sm">Est. Year<input value={year} maxLength={15} onChange={event => update(index, 'salary_range', combineSalaryReference(amount, event.target.value))} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2" placeholder="2025-2026" /></label>
        </div>
        <label className="text-sm md:col-span-2">Description / supporting reference (optional)<textarea value={row.description} maxLength={3000} onChange={event => update(index, 'description', event.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2" placeholder="Describe the role and cite its supporting reference." /></label>
        <button type="button" className="justify-self-start text-sm text-red-600 underline" onClick={() => setForm(current => ({ ...current, career_opportunities: current.career_opportunities.filter((_, i) => i !== index) }))}>Remove career</button>
      </div>
    })}
    {rows.length < MAX_CAREER_OPPORTUNITIES && <button type="button" className="mt-4 rounded-lg border border-orange-200 px-3 py-2 text-sm" onClick={() => setForm(current => ({ ...current, career_opportunities: [...(current.career_opportunities || []), { client_id: crypto.randomUUID(), job_title: '', salary_range: '', description: '' }] }))}>Add Career Opportunity</button>}
  </DraftDisclosure></div>
}
