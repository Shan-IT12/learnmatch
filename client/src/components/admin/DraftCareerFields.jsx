import DraftDisclosure, { DraftGuidance } from './DraftDisclosure'
import { RequiredMark, FieldError } from '../FormValidation'
import { MAX_CAREER_OPPORTUNITIES } from '../../../../shared/courseCareerFields'

export default function DraftCareerFields({ form, setForm, error }) {
  const rows = form.career_opportunities || []
  const update = (index, field, value) => setForm(current => ({ ...current, career_opportunities: current.career_opportunities.map((row, i) => i === index ? { ...row, [field]: value } : row) }))
  return <div data-validation-field="career_opportunities"><DraftDisclosure title="Career Opportunities" hasError={Boolean(error)}>
    <p className="mb-2 text-sm text-gray-600">Optional. Add source-supported career paths for this course. Leave unsupported salary information blank.</p>
    <DraftGuidance><p>Enter a job title, an optional description and optional salary reference text. Do not guess salaries or claim professional eligibility without supporting evidence. These entries do not create matching weights or publish the course.</p></DraftGuidance>
    <FieldError>{error}</FieldError>
    {rows.map((row, index) => <div key={row.opportunity_id || row.client_id || index} className="mt-4 grid min-w-0 grid-cols-1 gap-4 border-t border-gray-100 pt-4 md:grid-cols-2">
      <label className="text-sm">Job title <RequiredMark /><input value={row.job_title} maxLength={150} aria-invalid={Boolean(error && !row.job_title.trim())} onChange={event => update(index, 'job_title', event.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2" placeholder="Ex. A role documented by your reference" /></label>
      <label className="text-sm">Salary reference (optional)<input value={row.salary_range} maxLength={100} onChange={event => update(index, 'salary_range', event.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2" placeholder="Leave blank if not supported" /></label>
      <label className="text-sm md:col-span-2">Description / supporting reference (optional)<textarea value={row.description} maxLength={3000} onChange={event => update(index, 'description', event.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2" placeholder="Describe the role and cite its supporting reference." /></label>
      <button type="button" className="justify-self-start text-sm text-red-600 underline" onClick={() => setForm(current => ({ ...current, career_opportunities: current.career_opportunities.filter((_, i) => i !== index) }))}>Remove career</button>
    </div>)}
    {rows.length < MAX_CAREER_OPPORTUNITIES && <button type="button" className="mt-4 rounded-lg border border-orange-200 px-3 py-2 text-sm" onClick={() => setForm(current => ({ ...current, career_opportunities: [...(current.career_opportunities || []), { client_id: crypto.randomUUID(), job_title: '', salary_range: '', description: '' }] }))}>Add Career Opportunity</button>}
  </DraftDisclosure></div>
}
