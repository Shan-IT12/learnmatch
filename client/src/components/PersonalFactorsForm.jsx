/* eslint-disable react-refresh/only-export-components */
import { IconActivity, IconBriefcase, IconHeart, IconUsers, IconWallet } from '@tabler/icons-react'
import { FieldError, RequiredMark } from './FormValidation'
import { PERSONAL_FACTOR_KEYS, applyFactorApplicability, shouldShowFactorDetails } from '../utils/profilePersonalFactors'

export const accessibilityAreas = [
  ['seeing', 'Seeing'], ['hearing', 'Hearing'],
  ['walking_climbing', 'Walking or climbing steps'], ['self_care', 'Self-care'],
  ['other', 'Other physical or accessibility difficulty'],
]
export const difficultyLevels = [
  ['some_difficulty', 'Some difficulty'],
  ['a_lot_of_difficulty', 'A lot of difficulty'],
  ['cannot_do', 'Cannot do it at all'],
]
export const impactOptions = [[1, 'No impact'], [2, 'Slight impact'], [3, 'Moderate impact'], [4, 'High impact']]
export const factorCards = [
  { key: 'health', title: 'Health', question: 'Do you currently have health-related needs?', icon: IconHeart },
  { key: 'financial', title: 'Financial', question: 'Do you currently have financial concerns related to your studies?', icon: IconWallet },
  { key: 'family', title: 'Family Responsibilities', question: 'Do you have regular family responsibilities?', icon: IconUsers },
  { key: 'work', title: 'Work Responsibilities', question: 'Are you currently working or do you have regular work responsibilities?', icon: IconBriefcase },
]

export function validatePersonalFactors(formData, applicability) {
  const errors = {}
  for (const factor of PERSONAL_FACTOR_KEYS) {
    if (!applicability[factor]) errors[`applies_${factor}`] = 'Please select Yes or No.'
    else if (applicability[factor] === 'yes' && ![1, 2, 3, 4].includes(Number(formData[`factor_${factor}_impact`]))) errors[`factor_${factor}_impact`] = 'Please select an impact level.'
  }
  if (applicability.physical === 'yes') {
    if (formData.physical_accessibility_areas.length === 0) errors.physical_accessibility_areas = 'Please select at least one area.'
    for (const area of formData.physical_accessibility_areas) if (!formData.physical_accessibility_difficulties[area]) errors[`difficulty_${area}`] = 'Please select a difficulty level.'
  }
  return errors
}

export function ApplicabilityQuestion({ factor, question, value, onChange, error }) {
  const errorId = `${factor}-applicability-error`
  return <fieldset data-validation-field={`applies_${factor}`} aria-invalid={error ? 'true' : undefined} aria-describedby={error ? errorId : undefined}>
    <legend className="text-[15px] font-medium leading-relaxed text-gray-700">{question}</legend>
    <div className={`mt-3 inline-grid w-full max-w-xs grid-cols-2 gap-1 rounded-xl border p-1 ${error ? 'border-red-300 bg-red-50/40' : 'border-gray-200 bg-gray-100/80'}`}>
      {['no', 'yes'].map((answer) => <label key={answer} className="cursor-pointer"><input type="radio" name={`applies_${factor}`} value={answer} checked={value === answer} onChange={() => onChange(answer)} required aria-required="true" className="peer sr-only" /><span className={`flex min-h-10 items-center justify-center rounded-lg px-4 text-sm font-semibold transition-colors peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-orange-400 peer-focus-visible:ring-offset-2 ${value === answer ? 'bg-white text-orange-700 shadow-sm ring-1 ring-orange-200' : 'text-gray-600 hover:bg-white/70 hover:text-gray-900'}`}>{answer === 'yes' ? 'Yes' : 'No'}</span></label>)}
    </div><FieldError id={errorId}>{error}</FieldError>
  </fieldset>
}

export function ImpactOptions({ name, value, onChange, error }) {
  const errorId = `${name}-error`
  return <div data-validation-field={name}><div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4" aria-describedby={error ? errorId : undefined} aria-invalid={error ? 'true' : undefined}>
    {impactOptions.map(([option, label]) => <label key={option} className={`flex min-h-12 cursor-pointer items-center justify-center rounded-xl border px-3 py-2.5 text-center text-sm font-medium transition-colors ${Number(value) === option ? 'border-orange-400 bg-orange-50 font-semibold text-orange-700 shadow-sm ring-1 ring-orange-100' : error ? 'border-red-300 bg-red-50/30 text-gray-600' : 'border-gray-200 bg-white text-gray-600 hover:border-orange-300 hover:bg-orange-50/40 hover:text-gray-900'}`}><input required aria-required="true" type="radio" name={name} value={option} checked={Number(value) === option} onChange={() => onChange(option)} className="peer sr-only" /><span className="rounded peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-orange-400 peer-focus-visible:ring-offset-2">{label}</span></label>)}
  </div><FieldError id={errorId}>{error}</FieldError></div>
}

export default function PersonalFactorsForm({ formData, applicability, fieldErrors, setFormData, setApplicability, clearFieldError }) {
  const update = (profile, nextApplicability = applicability) => { setFormData(profile); setApplicability(nextApplicability) }
  const setApplies = (factor, answer) => { clearFieldError(`applies_${factor}`); if (answer === 'no') { clearFieldError(`factor_${factor}_impact`); if (factor === 'physical') clearFieldError('physical_accessibility_areas') } update(applyFactorApplicability(formData, factor, answer), { ...applicability, [factor]: answer }) }
  const setImpact = (factor, value) => { clearFieldError(`factor_${factor}_impact`); update({ ...formData, [`factor_${factor}_impact`]: value }) }
  const toggleArea = (area) => { const selected = formData.physical_accessibility_areas.includes(area); const areas = selected ? formData.physical_accessibility_areas.filter((item) => item !== area) : [...formData.physical_accessibility_areas, area]; const difficulties = { ...formData.physical_accessibility_difficulties }; if (selected) delete difficulties[area]; clearFieldError('physical_accessibility_areas'); update({ ...formData, physical_accessibility_areas: areas, physical_accessibility_difficulties: difficulties }) }
  const card = (factor, title, question, FactorIcon) => <article key={factor} className={`rounded-2xl border p-4 shadow-sm transition-colors sm:p-5 ${applicability[factor] === 'yes' ? 'border-orange-200 bg-orange-50/30' : 'border-gray-200 bg-gray-50/40'}`}><div className="mb-4 flex items-center gap-3"><span className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${applicability[factor] === 'yes' ? 'bg-orange-100 text-orange-700' : 'bg-white text-gray-500 shadow-sm ring-1 ring-gray-200'}`}><FactorIcon size={19} /></span><h3 className="text-base font-bold text-gray-900">{title} <RequiredMark /></h3></div><ApplicabilityQuestion factor={factor} question={question} value={applicability[factor]} onChange={(answer) => setApplies(factor, answer)} error={fieldErrors[`applies_${factor}`]} />{shouldShowFactorDetails(applicability, factor) && <fieldset className="mt-5 border-t border-orange-200/70 pt-5"><legend className="text-[15px] font-semibold text-gray-700">How much impact does this have on your studies? <RequiredMark /></legend><ImpactOptions name={`factor_${factor}_impact`} value={formData[`factor_${factor}_impact`]} onChange={(value) => setImpact(factor, value)} error={fieldErrors[`factor_${factor}_impact`]} /></fieldset>}</article>

  return <div className="space-y-4">
    <article className={`rounded-2xl border p-4 shadow-sm transition-colors sm:p-5 ${applicability.physical === 'yes' ? 'border-orange-200 bg-orange-50/30' : 'border-gray-200 bg-gray-50/40'}`}>
      <div className="mb-4 flex items-center gap-3"><span className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${applicability.physical === 'yes' ? 'bg-orange-100 text-orange-700' : 'bg-white text-gray-500 shadow-sm ring-1 ring-gray-200'}`}><IconActivity size={19} /></span><h3 className="text-base font-bold text-gray-900">Physical / Accessibility <RequiredMark /></h3></div>
      <ApplicabilityQuestion factor="physical" question="Do you currently have any physical or accessibility difficulty?" value={applicability.physical} onChange={(answer) => setApplies('physical', answer)} error={fieldErrors.applies_physical} />
      {shouldShowFactorDetails(applicability, 'physical') && <div className="mt-5 border-t border-orange-200/70 pt-5"><fieldset data-validation-field="physical_accessibility_areas" aria-invalid={fieldErrors.physical_accessibility_areas ? 'true' : undefined} aria-describedby={fieldErrors.physical_accessibility_areas ? 'physical-areas-error' : undefined}><legend className="text-[15px] font-semibold text-gray-700">Select the area(s) that apply. <RequiredMark /></legend><div className="mt-3 grid gap-2 md:grid-cols-2">{accessibilityAreas.map(([value, label]) => { const selected = formData.physical_accessibility_areas.includes(value); return <label key={value} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-2.5 text-sm font-medium transition-colors ${value === 'other' ? 'md:col-span-2 md:w-[calc(50%-0.25rem)] md:justify-self-center' : ''} ${selected ? 'border-orange-400 bg-white text-orange-800 shadow-sm ring-1 ring-orange-100' : 'border-gray-200 bg-white/80 text-gray-600 hover:border-orange-300 hover:text-gray-900'}`}><input type="checkbox" checked={selected} onChange={() => toggleArea(value)} className="size-4 shrink-0 accent-orange-500 focus-visible:ring-2 focus-visible:ring-orange-400" /><span>{label}</span></label> })}</div><FieldError id="physical-areas-error">{fieldErrors.physical_accessibility_areas}</FieldError></fieldset>
      <div className="mt-4 grid gap-3 md:grid-cols-2">{formData.physical_accessibility_areas.map((area) => { const key = `difficulty_${area}`; return <label key={area} data-validation-field={key} className="block rounded-xl bg-white/70 p-3 text-sm font-medium text-gray-700 ring-1 ring-gray-200/80">Difficulty level — {accessibilityAreas.find(([value]) => value === area)?.[1]} <RequiredMark /><select required aria-required="true" aria-invalid={fieldErrors[key] ? 'true' : undefined} aria-describedby={fieldErrors[key] ? `${key}-error` : undefined} value={formData.physical_accessibility_difficulties[area] || ''} onChange={(event) => { clearFieldError(key); update({ ...formData, physical_accessibility_difficulties: { ...formData.physical_accessibility_difficulties, [area]: event.target.value } }) }} className={`mt-2 w-full rounded-lg border bg-white px-3 py-2.5 text-sm outline-none transition focus:ring-2 focus:ring-orange-200 ${fieldErrors[key] ? 'border-red-400' : 'border-gray-200 focus:border-orange-400'}`}><option value="">Select difficulty level</option>{difficultyLevels.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><FieldError id={`${key}-error`}>{fieldErrors[key]}</FieldError></label> })}</div>
      <fieldset className="mt-5 border-t border-orange-200/70 pt-5"><legend className="text-[15px] font-semibold text-gray-700">How much impact does this have on your studies? <RequiredMark /></legend><ImpactOptions name="factor_physical_impact" value={formData.factor_physical_impact} onChange={(value) => setImpact('physical', value)} error={fieldErrors.factor_physical_impact} /></fieldset></div>}
    </article>
    {factorCards.map(({ key, title, question, icon }) => card(key, title, question, icon))}
  </div>
}
