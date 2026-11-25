/* eslint-disable react-refresh/only-export-components */
import { IconActivity, IconBriefcase, IconHeart, IconHeartHandshake, IconShieldLock, IconUsers, IconWallet } from '@tabler/icons-react'
import { FieldError, RequiredMark } from './FormValidation'
import { PERSONAL_FACTOR_KEYS, VALID_APPLICABILITY_ANSWERS, applyFactorApplicability, shouldShowFactorDetails } from '../utils/profilePersonalFactors'

export const accessibilityAreas = [
  ['seeing', 'Seeing (even when wearing glasses)'],
  ['hearing', 'Hearing (even when using a hearing aid)'],
  ['walking_climbing', 'Walking, climbing steps, or mobility'],
  ['self_care', 'Self-care or fine motor tasks'],
  ['other', 'Other physical or accessibility difficulty'],
]

export const healthWellbeingAreas = [
  ['physical_health', 'Ongoing physical health condition (e.g., chronic illness, fatigue, recurring pain)'],
  ['mental_emotional', 'Mental or emotional well-being (e.g., persistent stress, anxiety, burnout)'],
  ['other_health', 'Other health-related need'],
]

export const difficultyLevels = [
  ['some_difficulty', 'Some difficulty'],
  ['a_lot_of_difficulty', 'A lot of difficulty'],
  ['cannot_do', 'Cannot do it at all'],
]

export const impactOptions = [
  [0, 'No impact'],
  [1, 'Slight impact'],
  [2, 'Moderate impact'],
  [3, 'High impact'],
  [4, 'Very high impact'],
]

const APPLICABILITY_CHOICES = [
  ['no', 'No'],
  ['yes', 'Yes'],
  ['prefer_not_to_say', 'Prefer not to say'],
]

const isValidImpact = (raw) => raw !== '' && raw !== null && raw !== undefined && [0, 1, 2, 3, 4].includes(Number(raw))

export const factorCards = [
  {
    key: 'financial',
    title: 'Financial Constraints',
    question: 'Do you currently experience financial constraints related to funding your education (e.g., tuition, school supplies, gadgets, or daily allowance)?',
    helper: 'Focuses on budget and affordability for school expenses, regardless of whether you are working or not.',
    icon: IconWallet,
  },
  {
    key: 'family',
    title: 'Family Responsibilities',
    question: 'Do you have regular, unpaid responsibilities at home (e.g., caregiving for family members, heavy household chores) that take up a significant part of your study time?',
    helper: 'Occasional or normal household chores do not count here—select "Yes" only if these are regular duties that interfere with your study time, attendance, or school activities.',
    icon: IconUsers,
  },
  {
    key: 'work',
    title: 'Work Responsibilities',
    question: 'Are you currently employed, freelancing, or working regular hours in a business (including a family business), regardless of your financial situation?',
    helper: 'Focuses on the time and schedule demands of working, even if you do not have financial constraints.',
    icon: IconBriefcase,
  },
]

export function validatePersonalFactors(formData, applicability) {
  const errors = {}
  for (const factor of PERSONAL_FACTOR_KEYS) {
    if (!VALID_APPLICABILITY_ANSWERS.includes(applicability[factor])) {
      errors[`applies_${factor}`] = 'Please select No, Yes, or Prefer not to say.'
    }
    if (applicability[factor] === 'yes' && !isValidImpact(formData[`factor_${factor}_impact`])) {
      errors[`factor_${factor}_impact`] = 'Please select an impact level.'
    }
  }
  if (applicability.physical === 'yes') {
    const areas = Array.isArray(formData.physical_accessibility_areas) ? formData.physical_accessibility_areas : []
    if (areas.length === 0) errors.physical_accessibility_areas = 'Please select at least one area.'
    for (const area of areas) {
      if (!formData.physical_accessibility_difficulties?.[area]) {
        errors[`difficulty_${area}`] = 'Please select a difficulty level.'
      }
    }
  }
  if (applicability.health === 'yes') {
    const healthAreas = Array.isArray(formData.health_wellbeing_areas) ? formData.health_wellbeing_areas : []
    if (healthAreas.length === 0) {
      errors.health_wellbeing_areas = 'Please select at least one area.'
    }
  }
  return errors
}

export function ApplicabilityQuestion({ factor, question, helper, value, onChange, error }) {
  const errorId = `${factor}-applicability-error`
  return (
    <fieldset data-validation-field={`applies_${factor}`} aria-invalid={error ? 'true' : undefined} aria-describedby={error ? errorId : undefined}>
      <legend className="text-[15px] font-medium leading-relaxed text-gray-800">
        {question} <RequiredMark />
      </legend>
      {helper && <p className="mt-1.5 text-xs leading-5 text-gray-500">{helper}</p>}
      <div className={`mt-3 grid w-full grid-cols-1 gap-1 rounded-xl border p-1 sm:grid-cols-3 ${error ? 'border-red-300 bg-red-50/40' : 'border-gray-200 bg-gray-100/80'}`}>
        {APPLICABILITY_CHOICES.map(([answer, label]) => (
          <label key={answer} className="cursor-pointer">
            <input
              required
              aria-required="true"
              type="radio"
              name={`applies_${factor}`}
              value={answer}
              checked={value === answer}
              onChange={() => onChange(answer)}
              className="peer sr-only"
            />
            <span
              className={`flex min-h-10 items-center justify-center rounded-lg px-3 text-center text-sm font-semibold transition-colors peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-orange-400 peer-focus-visible:ring-offset-2 ${
                value === answer
                  ? 'bg-white text-orange-700 shadow-sm ring-1 ring-orange-200'
                  : 'text-gray-600 hover:bg-white/70 hover:text-gray-900'
              }`}
            >
              {label}
            </span>
          </label>
        ))}
      </div>
      {['unknown', 'legacy_unknown'].includes(value) && (
        <p className="mt-2 text-sm text-gray-600">
          Please select No, Yes, or Prefer not to say to update your previous response before saving or continuing.
        </p>
      )}
      <FieldError id={errorId}>{error}</FieldError>
    </fieldset>
  )
}

export function ImpactOptions({ name, value, onChange, error }) {
  const errorId = `${name}-error`
  const hasSelection = value !== '' && value !== null && value !== undefined
  return (
    <div data-validation-field={name}>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5" aria-describedby={error ? errorId : undefined} aria-invalid={error ? 'true' : undefined}>
        {impactOptions.map(([option, label]) => {
          const checked = hasSelection && Number(value) === option
          return (
            <label
              key={option}
              title={option === 0 ? 'I experience this, but I manage it well and it does not affect my studies.' : undefined}
              className={`flex min-h-12 cursor-pointer items-center justify-center rounded-xl border px-3 py-2.5 text-center text-sm font-medium transition-colors ${
                checked
                  ? 'border-orange-400 bg-orange-50 font-semibold text-orange-700 shadow-sm ring-1 ring-orange-100'
                  : error
                    ? 'border-red-300 bg-red-50/30 text-gray-600'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-orange-300 hover:bg-orange-50/40 hover:text-gray-900'
              }`}
            >
              <input
                required
                aria-required="true"
                type="radio"
                name={name}
                value={option}
                checked={checked}
                onChange={() => onChange(option)}
                className="peer sr-only"
              />
              <span className="rounded peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-orange-400 peer-focus-visible:ring-offset-2">
                {label}
              </span>
            </label>
          )
        })}
      </div>
      <p className="mt-2 text-xs leading-5 text-gray-500">
        <span className="font-semibold text-gray-600">No impact:</span> I experience this, but I manage it well and it does not affect my studies.
      </p>
      <FieldError id={errorId}>{error}</FieldError>
    </div>
  )
}

export default function PersonalFactorsForm({ formData, applicability, fieldErrors, setFormData, setApplicability, clearFieldError }) {
  const update = (profile, nextApplicability = applicability) => {
    setFormData(profile)
    setApplicability(nextApplicability)
  }

  const setApplies = (factor, answer) => {
    clearFieldError(`applies_${factor}`)
    if (answer !== 'yes') {
      clearFieldError(`factor_${factor}_impact`)
      if (factor === 'physical') clearFieldError('physical_accessibility_areas')
      if (factor === 'health') clearFieldError('health_wellbeing_areas')
    }
    update(applyFactorApplicability(formData, factor, answer), { ...applicability, [factor]: answer })
  }

  const setImpact = (factor, value) => {
    clearFieldError(`factor_${factor}_impact`)
    update({ ...formData, [`factor_${factor}_impact`]: value })
  }

  const togglePhysicalArea = (area) => {
    const currentAreas = Array.isArray(formData.physical_accessibility_areas) ? formData.physical_accessibility_areas : []
    const selected = currentAreas.includes(area)
    const areas = selected ? currentAreas.filter((item) => item !== area) : [...currentAreas, area]
    const difficulties = { ...(formData.physical_accessibility_difficulties || {}) }
    if (selected) delete difficulties[area]
    clearFieldError('physical_accessibility_areas')
    update({ ...formData, physical_accessibility_areas: areas, physical_accessibility_difficulties: difficulties })
  }

  const toggleHealthArea = (area) => {
    const currentAreas = Array.isArray(formData.health_wellbeing_areas) ? formData.health_wellbeing_areas : []
    const selected = currentAreas.includes(area)
    const areas = selected ? currentAreas.filter((item) => item !== area) : [...currentAreas, area]
    clearFieldError('health_wellbeing_areas')
    update({ ...formData, health_wellbeing_areas: areas })
  }

  const healthImpact = formData.factor_health_impact
  const showHealthSupportNote = applicability.health === 'yes' && healthImpact !== '' && healthImpact !== null && healthImpact !== undefined && [3, 4].includes(Number(healthImpact))

  const renderStandardCard = ({ key, title, question, helper, icon: FactorIcon }) => (
    <article
      key={key}
      className={`rounded-2xl border p-4 shadow-sm transition-colors sm:p-5 ${
        applicability[key] === 'yes' ? 'border-orange-200 bg-orange-50/30' : 'border-gray-200 bg-gray-50/40'
      }`}
    >
      <div className="mb-4 flex items-center gap-3">
        <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${applicability[key] === 'yes' ? 'bg-orange-100 text-orange-700' : 'bg-white text-gray-500 shadow-sm ring-1 ring-gray-200'}`}>
          <FactorIcon size={19} />
        </span>
        <h3 className="text-base font-bold text-gray-900">{title}</h3>
      </div>
      <ApplicabilityQuestion
        factor={key}
        question={question}
        helper={helper}
        value={applicability[key]}
        onChange={(answer) => setApplies(key, answer)}
        error={fieldErrors[`applies_${key}`]}
      />
      {shouldShowFactorDetails(applicability, key) && (
        <fieldset className="mt-5 border-t border-orange-200/70 pt-5">
          <legend className="text-[15px] font-semibold text-gray-700">
            How much impact does this have on your studies? <RequiredMark />
          </legend>
          <ImpactOptions
            name={`factor_${key}_impact`}
            value={formData[`factor_${key}_impact`]}
            onChange={(value) => setImpact(key, value)}
            error={fieldErrors[`factor_${key}_impact`]}
          />
        </fieldset>
      )}
    </article>
  )

  return (
    <div className="space-y-4">
      <aside className="rounded-2xl border border-amber-200/80 bg-amber-50/60 p-4 sm:p-5" aria-label="Privacy and Purpose Notice">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-800">
            <IconShieldLock size={18} />
          </span>
          <div className="space-y-1.5">
            <h3 className="text-sm font-bold text-gray-900">Privacy &amp; Purpose Notice</h3>
            <p className="text-xs leading-5 text-gray-700 sm:text-[13px] sm:leading-6">
              Your responses in this section are strictly confidential. They are collected only through this assessment, stored securely in our system database, and accessed solely by LearnMatch to personalize your course recommendations and study guidance. This section is <strong className="font-semibold text-gray-900">not</strong> a medical or psychological assessment, and your answers will never be used to label you or automatically exclude you from any course. Please share only what you are comfortable disclosing—you may select <em className="italic">&ldquo;Prefer not to say&rdquo;</em> on any item.
            </p>
          </div>
        </div>
      </aside>

      {/* 1. Physical / Accessibility */}
      <article
        className={`rounded-2xl border p-4 shadow-sm transition-colors sm:p-5 ${
          applicability.physical === 'yes' ? 'border-orange-200 bg-orange-50/30' : 'border-gray-200 bg-gray-50/40'
        }`}
      >
        <div className="mb-4 flex items-center gap-3">
          <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${applicability.physical === 'yes' ? 'bg-orange-100 text-orange-700' : 'bg-white text-gray-500 shadow-sm ring-1 ring-gray-200'}`}>
            <IconActivity size={19} />
          </span>
          <h3 className="text-base font-bold text-gray-900">Physical / Accessibility</h3>
        </div>
        <ApplicabilityQuestion
          factor="physical"
          question="Do you currently have any ongoing physical or accessibility difficulty that affects your daily activities—even when using glasses, hearing aids, or other assistive devices?"
          helper="Focuses on functional difficulties in doing everyday tasks (such as seeing, hearing, moving around, or handling objects)."
          value={applicability.physical}
          onChange={(answer) => setApplies('physical', answer)}
          error={fieldErrors.applies_physical}
        />
        {shouldShowFactorDetails(applicability, 'physical') && (
          <div className="mt-5 border-t border-orange-200/70 pt-5">
            <fieldset
              data-validation-field="physical_accessibility_areas"
              aria-invalid={fieldErrors.physical_accessibility_areas ? 'true' : undefined}
              aria-describedby={fieldErrors.physical_accessibility_areas ? 'physical-areas-error' : undefined}
            >
              <legend className="text-[15px] font-semibold text-gray-700">
                Select all that apply. <RequiredMark />
              </legend>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {accessibilityAreas.map(([value, label]) => {
                  const selected = (formData.physical_accessibility_areas || []).includes(value)
                  return (
                    <label
                      key={value}
                      className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-2.5 text-sm font-medium transition-colors ${
                        value === 'other' ? 'md:col-span-2 md:w-[calc(50%-0.25rem)] md:justify-self-center' : ''
                      } ${
                        selected
                          ? 'border-orange-400 bg-white text-orange-800 shadow-sm ring-1 ring-orange-100'
                          : 'border-gray-200 bg-white/80 text-gray-600 hover:border-orange-300 hover:text-gray-900'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => togglePhysicalArea(value)}
                        className="size-4 shrink-0 accent-orange-500 focus-visible:ring-2 focus-visible:ring-orange-400"
                      />
                      <span>{label}</span>
                    </label>
                  )
                })}
              </div>
              <FieldError id="physical-areas-error">{fieldErrors.physical_accessibility_areas}</FieldError>
            </fieldset>

            {(formData.physical_accessibility_areas || []).length > 0 && (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {formData.physical_accessibility_areas.map((area) => {
                  const key = `difficulty_${area}`
                  return (
                    <label key={area} data-validation-field={key} className="block rounded-xl bg-white/70 p-3 text-sm font-medium text-gray-700 ring-1 ring-gray-200/80">
                      Difficulty level — {accessibilityAreas.find(([value]) => value === area)?.[1]} <RequiredMark />
                      <select
                        required
                        aria-required="true"
                        aria-invalid={fieldErrors[key] ? 'true' : undefined}
                        aria-describedby={fieldErrors[key] ? `${key}-error` : undefined}
                        value={formData.physical_accessibility_difficulties?.[area] || ''}
                        onChange={(event) => {
                          clearFieldError(key)
                          update({
                            ...formData,
                            physical_accessibility_difficulties: {
                              ...(formData.physical_accessibility_difficulties || {}),
                              [area]: event.target.value,
                            },
                          })
                        }}
                        className={`mt-2 w-full rounded-lg border bg-white px-3 py-2.5 text-sm outline-none transition focus:ring-2 focus:ring-orange-200 ${
                          fieldErrors[key] ? 'border-red-400' : 'border-gray-200 focus:border-orange-400'
                        }`}
                      >
                        <option value="">Select difficulty level</option>
                        {difficultyLevels.map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                      <FieldError id={`${key}-error`}>{fieldErrors[key]}</FieldError>
                    </label>
                  )
                })}
              </div>
            )}

            <fieldset className="mt-5 border-t border-orange-200/70 pt-5">
              <legend className="text-[15px] font-semibold text-gray-700">
                How much impact does this have on your studies? <RequiredMark />
              </legend>
              <ImpactOptions
                name="factor_physical_impact"
                value={formData.factor_physical_impact}
                onChange={(value) => setImpact('physical', value)}
                error={fieldErrors.factor_physical_impact}
              />
            </fieldset>
          </div>
        )}
      </article>

      {/* 2. Health & Well-being */}
      <article
        className={`rounded-2xl border p-4 shadow-sm transition-colors sm:p-5 ${
          applicability.health === 'yes' ? 'border-orange-200 bg-orange-50/30' : 'border-gray-200 bg-gray-50/40'
        }`}
      >
        <div className="mb-4 flex items-center gap-3">
          <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${applicability.health === 'yes' ? 'bg-orange-100 text-orange-700' : 'bg-white text-gray-500 shadow-sm ring-1 ring-gray-200'}`}>
            <IconHeart size={19} />
          </span>
          <h3 className="text-base font-bold text-gray-900">Health &amp; Well-being</h3>
        </div>
        <ApplicabilityQuestion
          factor="health"
          question="Do you currently have any ongoing physical health or mental/emotional well-being needs that require regular management?"
          helper="Focuses on ongoing health or emotional needs that require regular care or attention, rather than temporary illnesses like a common cold."
          value={applicability.health}
          onChange={(answer) => setApplies('health', answer)}
          error={fieldErrors.applies_health}
        />
        {shouldShowFactorDetails(applicability, 'health') && (
          <div className="mt-5 border-t border-orange-200/70 pt-5">
            <fieldset
              data-validation-field="health_wellbeing_areas"
              aria-invalid={fieldErrors.health_wellbeing_areas ? 'true' : undefined}
              aria-describedby={fieldErrors.health_wellbeing_areas ? 'health-areas-error' : undefined}
            >
              <legend className="text-[15px] font-semibold text-gray-700">
                Which area(s) apply? (Select all that apply) <RequiredMark />
              </legend>
              <div className="mt-3 space-y-2">
                {healthWellbeingAreas.map(([value, label]) => {
                  const selected = (formData.health_wellbeing_areas || []).includes(value)
                  return (
                    <label
                      key={value}
                      className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-2.5 text-sm font-medium transition-colors ${
                        selected
                          ? 'border-orange-400 bg-white text-orange-800 shadow-sm ring-1 ring-orange-100'
                          : 'border-gray-200 bg-white/80 text-gray-600 hover:border-orange-300 hover:text-gray-900'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleHealthArea(value)}
                        className="size-4 shrink-0 accent-orange-500 focus-visible:ring-2 focus-visible:ring-orange-400"
                      />
                      <span>{label}</span>
                    </label>
                  )
                })}
              </div>
              <FieldError id="health-areas-error">{fieldErrors.health_wellbeing_areas}</FieldError>
            </fieldset>

            <fieldset className="mt-5 border-t border-orange-200/70 pt-5">
              <legend className="text-[15px] font-semibold text-gray-700">
                How much impact does this have on your studies? <RequiredMark />
              </legend>
              <ImpactOptions
                name="factor_health_impact"
                value={formData.factor_health_impact}
                onChange={(value) => setImpact('health', value)}
                error={fieldErrors.factor_health_impact}
              />
            </fieldset>

            {showHealthSupportNote && (
              <div role="note" className="mt-4 flex items-start gap-3 rounded-xl border border-teal-200/80 bg-teal-50/70 p-3.5 text-teal-900">
                <IconHeartHandshake size={19} className="mt-0.5 shrink-0 text-teal-700" />
                <p className="text-xs leading-5 sm:text-[13px]">
                  Thank you for sharing. If these health or emotional challenges feel overwhelming, we encourage you to reach out to your school&apos;s Guidance and Counseling Office, a trusted adult, or a healthcare professional for support.
                </p>
              </div>
            )}
          </div>
        )}
      </article>

      {/* 3. Financial Constraints, 4. Family Responsibilities, 5. Work Responsibilities */}
      {factorCards.map(renderStandardCard)}
    </div>
  )
}
