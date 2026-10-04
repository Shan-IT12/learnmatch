import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  IconActivity,
  IconArrowLeft,
  IconArrowRight,
  IconBriefcase,
  IconHeart,
  IconInfoCircle,
  IconPencil,
  IconRefresh,
  IconUser,
  IconUsers,
  IconWallet,
} from '@tabler/icons-react'
import { FieldError, RequiredMark } from '../components/FormValidation'
import {
  PERSONAL_FACTOR_KEYS,
  applyFactorApplicability,
  buildProfilePayload,
  deriveFactorApplicability,
  personalFactorsChanged,
  shouldOfferRetake,
  shouldShowFactorDetails,
  shouldWarnForPersonalFactorAttempt,
} from '../utils/profilePersonalFactors'
import { scrollToFirstInvalidField } from '../utils/formValidation'
import {
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  validateUsername,
} from '../utils/usernameValidation'

const accessibilityAreas = [
  ['seeing', 'Seeing'],
  ['hearing', 'Hearing'],
  ['walking_climbing', 'Walking or climbing steps'],
  ['self_care', 'Self-care'],
  ['other', 'Other physical or accessibility difficulty'],
]

const difficultyLevels = [
  ['some_difficulty', 'Some difficulty'],
  ['a_lot_of_difficulty', 'A lot of difficulty'],
  ['cannot_do', 'Cannot do it at all'],
]

const impactOptions = [
  [1, 'No impact'],
  [2, 'Slight impact'],
  [3, 'Moderate impact'],
  [4, 'High impact'],
]

const factorCards = [
  {
    key: 'health',
    title: 'Health',
    question: 'Do you currently have health-related needs?',
    icon: IconHeart,
  },
  {
    key: 'financial',
    title: 'Financial',
    question: 'Do you currently have financial concerns related to your studies?',
    icon: IconWallet,
  },
  {
    key: 'family',
    title: 'Family Responsibilities',
    question: 'Do you have regular family responsibilities?',
    icon: IconUsers,
  },
  {
    key: 'work',
    title: 'Work Responsibilities',
    question: 'Are you currently working or do you have regular work responsibilities?',
    icon: IconBriefcase,
  },
]

const emptyProfile = {
  username: '',
  physical_accessibility_areas: [],
  physical_accessibility_difficulties: {},
  factor_physical_impact: '',
  factor_health_impact: '',
  factor_financial_impact: '',
  factor_family_impact: '',
  factor_work_impact: '',
}

const emptyApplicability = Object.fromEntries(PERSONAL_FACTOR_KEYS.map((factor) => [factor, '']))
const parseJsonValue = (value, fallback) => {
  if (value && typeof value === 'object') return value
  if (typeof value !== 'string') return fallback
  try { return JSON.parse(value) } catch { return fallback }
}

export function UsernameField({ value, onChange, error }) {
  return (
    <label data-validation-field="username" className="block flex-1 text-sm font-medium text-gray-700">
      Username <RequiredMark />
      <input
        required
        aria-required="true"
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? 'username-error' : undefined}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        minLength={USERNAME_MIN_LENGTH}
        maxLength={USERNAME_MAX_LENGTH}
        className={`mt-1.5 w-full rounded-xl border bg-gray-50/60 px-4 py-2.5 text-gray-900 outline-none transition focus:bg-white focus:ring-2 focus:ring-orange-200 ${error ? 'border-red-400' : 'border-gray-200 focus:border-orange-400'}`}
      />
      <FieldError id="username-error">{error}</FieldError>
    </label>
  )
}

export function ApplicabilityQuestion({ factor, question, value, onChange, error }) {
  const errorId = `${factor}-applicability-error`
  return (
    <fieldset
      data-validation-field={`applies_${factor}`}
      aria-invalid={error ? 'true' : undefined}
      aria-describedby={error ? errorId : undefined}
    >
      <legend className="text-[15px] font-medium leading-relaxed text-gray-700">
        {question}
      </legend>
      <div className={`mt-3 inline-grid w-full max-w-xs grid-cols-2 gap-1 rounded-xl border p-1 ${error ? 'border-red-300 bg-red-50/40' : 'border-gray-200 bg-gray-100/80'}`}>
        {['no', 'yes'].map((answer) => (
          <label
            key={answer}
            className="cursor-pointer"
          >
            <input
              type="radio"
              name={`applies_${factor}`}
              value={answer}
              checked={value === answer}
              onChange={() => onChange(answer)}
              required
              aria-required="true"
              className="peer sr-only"
            />
            <span className={`flex min-h-10 items-center justify-center rounded-lg px-4 text-sm font-semibold transition-colors peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-orange-400 peer-focus-visible:ring-offset-2 ${
              value === answer
                ? 'bg-white text-orange-700 shadow-sm ring-1 ring-orange-200'
                : 'text-gray-600 hover:bg-white/70 hover:text-gray-900'
            }`}>
              {answer === 'yes' ? 'Yes' : 'No'}
            </span>
          </label>
        ))}
      </div>
      <FieldError id={errorId}>{error}</FieldError>
    </fieldset>
  )
}

export function ImpactOptions({ name, value, onChange, error }) {
  const errorId = `${name}-error`
  return (
    <div data-validation-field={name}>
      <div
        className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4"
        aria-describedby={error ? errorId : undefined}
        aria-invalid={error ? 'true' : undefined}
      >
        {impactOptions.map(([option, label]) => (
          <label
            key={option}
            className={`flex min-h-12 cursor-pointer items-center justify-center rounded-xl border px-3 py-2.5 text-center text-sm font-medium transition-colors ${
              Number(value) === option
                ? 'border-orange-400 bg-orange-50 font-semibold text-orange-700 shadow-sm ring-1 ring-orange-100'
                : error ? 'border-red-300 bg-red-50/30 text-gray-600' : 'border-gray-200 bg-white text-gray-600 hover:border-orange-300 hover:bg-orange-50/40 hover:text-gray-900'
            }`}
          >
            <input
              required
              aria-required="true"
              type="radio"
              name={name}
              value={option}
              checked={Number(value) === option}
              onChange={() => onChange(option)}
              className="peer sr-only"
            />
            <span className="rounded peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-orange-400 peer-focus-visible:ring-offset-2">{label}</span>
          </label>
        ))}
      </div>
      <FieldError id={errorId}>{error}</FieldError>
    </div>
  )
}

function Profile() {
  const navigate = useNavigate()
  const location = useLocation()
  const token = localStorage.getItem('token')
  const entryContext = location.state?.entryContext === 'assessment' ? 'assessment' : 'dashboard'
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [hasExistingProfile, setHasExistingProfile] = useState(false)
  const [hasExistingRecommendation, setHasExistingRecommendation] = useState(false)
  const [isEditing, setIsEditing] = useState(true)
  const [showRetakePrompt, setShowRetakePrompt] = useState(false)
  const [showFactorWarning, setShowFactorWarning] = useState(false)
  const [pendingChange, setPendingChange] = useState(null)
  const [factorEditingApproved, setFactorEditingApproved] = useState(false)
  const [formData, setFormData] = useState(emptyProfile)
  const [savedFormData, setSavedFormData] = useState(emptyProfile)
  const [applicability, setApplicability] = useState(emptyApplicability)
  const [savedApplicability, setSavedApplicability] = useState(emptyApplicability)
  const [fieldErrors, setFieldErrors] = useState({})
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) { navigate('/login'); return }
    const fetchProfile = async () => {
      try {
        const headers = { Authorization: `Bearer ${token}` }
        const [profileResponse, recommendationResponse] = await Promise.all([
          fetch(`${import.meta.env.VITE_API_URL}/api/profile`, { headers }),
          fetch(`${import.meta.env.VITE_API_URL}/api/recommendations/latest`, { headers }),
        ])
        if ([profileResponse.status, recommendationResponse.status].some((status) => status === 401 || status === 403)) {
          navigate('/login', { replace: true })
          return
        }
        const data = await profileResponse.json()
        const accountUsername = data.username || localStorage.getItem('username') || ''
        if (recommendationResponse.ok) {
          const recommendationData = await recommendationResponse.json()
          setHasExistingRecommendation(Boolean(recommendationData.recommendation))
        }
        if (data.profile) {
          const rawAreas = parseJsonValue(data.profile.physical_accessibility_areas, [])
          const rawDifficulties = parseJsonValue(data.profile.physical_accessibility_difficulties, {})
          const areas = Array.isArray(rawAreas) ? rawAreas.filter((area) => area !== 'none') : []
          const difficulties = Object.fromEntries(
            Object.entries(rawDifficulties).filter(([area, level]) => (
              areas.includes(area) && difficultyLevels.some(([value]) => value === level)
            ))
          )
          const loaded = {
            username: accountUsername,
            physical_accessibility_areas: areas,
            physical_accessibility_difficulties: difficulties,
            factor_physical_impact: data.profile.factor_physical_impact || '',
            factor_health_impact: data.profile.factor_health_impact || '',
            factor_financial_impact: data.profile.factor_financial_impact || '',
            factor_family_impact: data.profile.factor_family_impact || '',
            factor_work_impact: data.profile.factor_work_impact || '',
          }
          const loadedApplicability = deriveFactorApplicability(loaded)
          setFormData(loaded)
          setSavedFormData(loaded)
          setApplicability(loadedApplicability)
          setSavedApplicability(loadedApplicability)
          setHasExistingProfile(true)
          setIsEditing(false)
        } else {
          setFormData((current) => ({ ...current, username: accountUsername }))
        }
      } catch {
        setError('Could not load your profile.')
      } finally {
        setLoadingProfile(false)
      }
    }
    fetchProfile()
  }, [navigate, token])

  const clearFieldError = (name) => {
    setFieldErrors((current) => current[name] ? { ...current, [name]: undefined } : current)
  }

  const requestFactorChange = (nextProfile, nextApplicability = applicability) => {
    const shouldWarn = shouldWarnForPersonalFactorAttempt({
      hasRecommendation: hasExistingRecommendation,
      confirmationGranted: factorEditingApproved,
      nextProfile,
      savedProfile: savedFormData,
    })
    if (shouldWarn) {
      setPendingChange({ profile: nextProfile, applicability: nextApplicability })
      setShowFactorWarning(true)
      return
    }
    setFormData(nextProfile)
    setApplicability(nextApplicability)
  }

  const setImpact = (factor, value) => {
    const field = `factor_${factor}_impact`
    clearFieldError(field)
    requestFactorChange({ ...formData, [field]: value })
  }

  const setFactorApplies = (factor, answer) => {
    clearFieldError(`applies_${factor}`)
    if (answer === 'no') {
      clearFieldError(`factor_${factor}_impact`)
      if (factor === 'physical') clearFieldError('physical_accessibility_areas')
    }
    const nextApplicability = { ...applicability, [factor]: answer }
    const nextProfile = applyFactorApplicability(formData, factor, answer)
    requestFactorChange(nextProfile, nextApplicability)
  }

  const toggleAccessibilityArea = (area) => {
    const selected = formData.physical_accessibility_areas.includes(area)
    const areas = selected
      ? formData.physical_accessibility_areas.filter((item) => item !== area)
      : [...formData.physical_accessibility_areas, area]
    const difficulties = { ...formData.physical_accessibility_difficulties }
    if (selected) delete difficulties[area]
    clearFieldError('physical_accessibility_areas')
    requestFactorChange({
      ...formData,
      physical_accessibility_areas: areas,
      physical_accessibility_difficulties: difficulties,
    })
  }

  const validateForm = () => {
    const nextErrors = {}
    const usernameError = validateUsername(formData.username)
    if (usernameError) nextErrors.username = usernameError
    for (const factor of PERSONAL_FACTOR_KEYS) {
      if (!applicability[factor]) {
        nextErrors[`applies_${factor}`] = 'Please select Yes or No.'
        continue
      }
      if (applicability[factor] === 'yes') {
        const impactField = `factor_${factor}_impact`
        if (![1, 2, 3, 4].includes(Number(formData[impactField]))) {
          nextErrors[impactField] = 'Please select an impact level.'
        }
      }
    }
    if (applicability.physical === 'yes') {
      if (formData.physical_accessibility_areas.length === 0) {
        nextErrors.physical_accessibility_areas = 'Please select at least one area.'
      }
      for (const area of formData.physical_accessibility_areas) {
        if (!formData.physical_accessibility_difficulties[area]) {
          nextErrors[`difficulty_${area}`] = 'Please select a difficulty level.'
        }
      }
    }
    return nextErrors
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setMessage('')
    setError('')
    const nextErrors = validateForm()
    if (Object.keys(nextErrors).length) {
      setFieldErrors(nextErrors)
      scrollToFirstInvalidField(Object.keys(nextErrors))
      return
    }
    setFieldErrors({})
    const factorsChanged = hasExistingProfile && personalFactorsChanged(formData, savedFormData)
    const payload = buildProfilePayload(formData)
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      })
      const data = await response.json()
      if (response.status === 401 || response.status === 403) {
        navigate('/login', { replace: true })
        return
      }
      if (!response.ok) {
        if (data.field === 'username') {
          setFieldErrors((current) => ({ ...current, username: data.message || 'Username is already taken.' }))
          scrollToFirstInvalidField(['username'])
          return
        }
        setError(data.message)
        return
      }
      const savedUsername = data.username || payload.username
      localStorage.setItem('username', savedUsername)
      if (hasExistingProfile) {
        const savedProfile = { ...formData, username: savedUsername }
        setFormData(savedProfile)
        setSavedFormData(savedProfile)
        setSavedApplicability(applicability)
        setIsEditing(false)
        setFactorEditingApproved(false)
        setMessage('Profile updated successfully')
        setShowRetakePrompt(shouldOfferRetake({ hasRecommendation: hasExistingRecommendation, factorsChanged }))
      } else {
        setMessage(data.message)
        setTimeout(() => navigate(
          entryContext === 'assessment' ? '/onboarding/interests' : '/dashboard',
          entryContext === 'assessment' ? undefined : { state: { profileUpdated: true } }
        ), 800)
      }
    } catch {
      setError('Cannot connect to server. Please try again.')
    }
  }

  if (loadingProfile) {
    return <div className="flex min-h-screen items-center justify-center bg-[#fcfbf9]"><p className="text-sm text-gray-500">Loading your profile...</p></div>
  }

  const factorSummary = (factor) => {
    if (!applicability[factor]) return 'Not answered'
    if (applicability[factor] === 'no') return 'Does not currently apply'
    return impactOptions.find(([value]) => value === Number(formData[`factor_${factor}_impact`]))?.[1] || 'Impact not answered'
  }

  return (
    <div className="min-h-screen bg-[#fcfbf9] text-gray-900">
      <nav className="flex items-center justify-between border-b border-gray-200/80 bg-white/90 px-4 py-4 backdrop-blur sm:px-8 lg:px-14">
        <button onClick={() => navigate('/dashboard')} className="text-lg font-bold tracking-tight">Learn<span className="text-orange-500">Match</span></button>
        <button onClick={() => navigate('/dashboard')} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"><IconArrowLeft size={16} /> Back to Dashboard</button>
      </nav>
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-8 sm:py-10">
        <header className="mb-8 flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-orange-500">{hasExistingProfile ? (isEditing ? 'Edit profile' : 'View profile') : 'Setup profile'}</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Your profile</h1>
          </div>
          {hasExistingProfile && !isEditing && (
            <button type="button" onClick={() => { setIsEditing(true); setMessage('') }} className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-orange-200 bg-white px-4 py-2.5 text-sm font-semibold text-orange-700 shadow-sm transition-colors hover:bg-orange-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"><IconPencil size={16} /> Edit Profile</button>
          )}
        </header>

        {message && <div role="status" className="mb-5 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div>}
        {error && <div role="alert" className="mb-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}
        {showRetakePrompt && (
          <div className="mb-5 rounded-2xl border border-orange-100 bg-orange-50 p-4">
            <p className="font-semibold">Personal Factors updated</p>
            <p className="mt-1 text-sm text-gray-600">Existing saved recommendations have not changed. Retake the assessment for recommendations based on the new responses.</p>
            <button type="button" onClick={() => navigate('/onboarding/profile')} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white"><IconRefresh size={16} /> Retake Assessment</button>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="space-y-6">
          <section className="rounded-2xl border border-gray-200/80 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <div className="flex min-w-44 items-center gap-3 sm:pt-1">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-600"><IconUser size={20} /></span>
                <div>
                  <h2 className="font-semibold text-gray-900">Account username</h2>
                  <p className="mt-0.5 text-sm text-gray-500">Used across LearnMatch</p>
                </div>
              </div>
              {isEditing ? (
                <UsernameField value={formData.username} error={fieldErrors.username} onChange={(username) => { clearFieldError('username'); setFormData({ ...formData, username }) }} />
              ) : <p className="flex-1 self-center text-base font-semibold text-gray-800">{formData.username}</p>}
            </div>
          </section>

          <section className="rounded-3xl border border-gray-200/80 bg-white p-4 shadow-sm sm:p-7">
            <div className="mb-6 border-b border-gray-100 pb-5">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-orange-500">About your circumstances</p>
              <h2 className="mt-1.5 text-xl font-bold tracking-tight text-gray-900">Personal Factors</h2>
              <p className="mt-1.5 text-sm leading-6 text-gray-500">Tell us about personal circumstances that may affect your studies.</p>
            </div>

            {isEditing ? (
              <div className="space-y-4">
                <article className={`rounded-2xl border p-4 shadow-sm transition-colors sm:p-5 ${applicability.physical === 'yes' ? 'border-orange-200 bg-orange-50/30' : 'border-gray-200 bg-gray-50/40'}`}>
                  <div className="mb-4 flex items-center gap-3">
                    <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${applicability.physical === 'yes' ? 'bg-orange-100 text-orange-700' : 'bg-white text-gray-500 shadow-sm ring-1 ring-gray-200'}`}><IconActivity size={19} /></span>
                    <h3 className="text-base font-bold text-gray-900">Physical / Accessibility <RequiredMark /></h3>
                  </div>
                  <ApplicabilityQuestion factor="physical" question="Do you currently have any physical or accessibility difficulty?" value={applicability.physical} onChange={(answer) => setFactorApplies('physical', answer)} error={fieldErrors.applies_physical} />
                  {shouldShowFactorDetails(applicability, 'physical') && (
                    <div className="mt-5 border-t border-orange-200/70 pt-5">
                      <fieldset data-validation-field="physical_accessibility_areas" aria-invalid={fieldErrors.physical_accessibility_areas ? 'true' : undefined} aria-describedby={fieldErrors.physical_accessibility_areas ? 'physical-areas-error' : undefined}>
                        <legend className="text-[15px] font-semibold text-gray-700">Select the area(s) that apply. <RequiredMark /></legend>
                        <div className="mt-3 grid gap-2 md:grid-cols-2">
                          {accessibilityAreas.map(([value, label]) => {
                            const selected = formData.physical_accessibility_areas.includes(value)
                            return (
                              <label key={value} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-2.5 text-sm font-medium transition-colors ${value === 'other' ? 'md:col-span-2 md:w-[calc(50%-0.25rem)] md:justify-self-center' : ''} ${selected ? 'border-orange-400 bg-white text-orange-800 shadow-sm ring-1 ring-orange-100' : 'border-gray-200 bg-white/80 text-gray-600 hover:border-orange-300 hover:text-gray-900'}`}>
                                <input type="checkbox" checked={selected} onChange={() => toggleAccessibilityArea(value)} className="size-4 shrink-0 accent-orange-500 focus-visible:ring-2 focus-visible:ring-orange-400" />
                                <span>{label}</span>
                              </label>
                            )
                          })}
                        </div>
                        <FieldError id="physical-areas-error">{fieldErrors.physical_accessibility_areas}</FieldError>
                      </fieldset>

                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                      {formData.physical_accessibility_areas.map((area) => {
                        const errorKey = `difficulty_${area}`
                        const errorId = `${errorKey}-error`
                        return (
                          <label key={area} data-validation-field={errorKey} className="block rounded-xl bg-white/70 p-3 text-sm font-medium text-gray-700 ring-1 ring-gray-200/80">
                            Difficulty level — {accessibilityAreas.find(([value]) => value === area)?.[1]} <RequiredMark />
                            <select required aria-required="true" aria-invalid={fieldErrors[errorKey] ? 'true' : undefined} aria-describedby={fieldErrors[errorKey] ? errorId : undefined} value={formData.physical_accessibility_difficulties[area] || ''} onChange={(event) => { clearFieldError(errorKey); requestFactorChange({ ...formData, physical_accessibility_difficulties: { ...formData.physical_accessibility_difficulties, [area]: event.target.value } }) }} className={`mt-2 w-full rounded-lg border bg-white px-3 py-2.5 text-sm outline-none transition focus:ring-2 focus:ring-orange-200 ${fieldErrors[errorKey] ? 'border-red-400' : 'border-gray-200 focus:border-orange-400'}`}>
                              <option value="">Select difficulty level</option>
                              {difficultyLevels.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                            </select>
                            <FieldError id={errorId}>{fieldErrors[errorKey]}</FieldError>
                          </label>
                        )
                      })}
                      </div>

                      <fieldset className="mt-5 border-t border-orange-200/70 pt-5">
                        <legend className="text-[15px] font-semibold text-gray-700">How much impact does this have on your studies? <RequiredMark /></legend>
                        <ImpactOptions name="factor_physical_impact" value={formData.factor_physical_impact} onChange={(value) => setImpact('physical', value)} error={fieldErrors.factor_physical_impact} />
                      </fieldset>
                    </div>
                  )}
                </article>

                {factorCards.map(({ key, title, question, icon: FactorIcon }) => (
                  <article key={key} className={`rounded-2xl border p-4 shadow-sm transition-colors sm:p-5 ${applicability[key] === 'yes' ? 'border-orange-200 bg-orange-50/30' : 'border-gray-200 bg-gray-50/40'}`}>
                    <div className="mb-4 flex items-center gap-3">
                      <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${applicability[key] === 'yes' ? 'bg-orange-100 text-orange-700' : 'bg-white text-gray-500 shadow-sm ring-1 ring-gray-200'}`}><FactorIcon size={19} /></span>
                      <h3 className="text-base font-bold text-gray-900">{title} <RequiredMark /></h3>
                    </div>
                    <ApplicabilityQuestion factor={key} question={question} value={applicability[key]} onChange={(answer) => setFactorApplies(key, answer)} error={fieldErrors[`applies_${key}`]} />
                    {shouldShowFactorDetails(applicability, key) && (
                      <fieldset className="mt-5 border-t border-orange-200/70 pt-5">
                        <legend className="text-[15px] font-semibold text-gray-700">How much impact does this have on your studies? <RequiredMark /></legend>
                        <ImpactOptions name={`factor_${key}_impact`} value={formData[`factor_${key}_impact`]} onChange={(value) => setImpact(key, value)} error={fieldErrors[`factor_${key}_impact`]} />
                      </fieldset>
                    )}
                  </article>
                ))}
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-orange-200 bg-orange-50/60 p-4 shadow-sm sm:col-span-2">
                  <p className="font-semibold">Physical / Accessibility</p>
                  <p className="mt-1 text-sm text-gray-600">{factorSummary('physical')}</p>
                  {applicability.physical === 'yes' && formData.physical_accessibility_areas.length > 0 && (
                    <p className="mt-1 text-xs text-gray-500">{formData.physical_accessibility_areas.map((area) => accessibilityAreas.find(([value]) => value === area)?.[1]).join(', ')}</p>
                  )}
                </div>
                {factorCards.map(({ key, title }) => (
                  <div key={key} className="flex justify-between gap-4 rounded-xl border border-gray-200 bg-gray-50/50 p-4 text-sm">
                    <span className="font-medium">{title}</span>
                    <span className="text-right text-gray-500">{factorSummary(key)}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {isEditing && (
            <div className="flex flex-col-reverse justify-end gap-3 pt-1 sm:flex-row">
              {hasExistingProfile && (
                <button type="button" onClick={() => { setFormData(savedFormData); setApplicability(savedApplicability); setFieldErrors({}); setIsEditing(false); setFactorEditingApproved(false) }} className="rounded-xl border border-gray-200 bg-white px-6 py-3 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400">Cancel</button>
              )}
              <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2">{hasExistingProfile ? 'Save Changes' : 'Save Profile'} <IconArrowRight size={17} /></button>
            </div>
          )}
        </form>
      </main>

      {showFactorWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/35 px-4">
          <div role="dialog" aria-modal="true" className="max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <IconInfoCircle className="text-orange-500" />
            <h2 className="mt-3 text-lg font-bold">Update Personal Factors?</h2>
            <p className="mt-2 text-sm text-gray-600">Changes will not update an existing saved recommendation. Retake the assessment to generate a new snapshot.</p>
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" onClick={() => { setPendingChange(null); setShowFactorWarning(false) }} className="rounded-xl border px-4 py-2 text-sm">Cancel</button>
              <button type="button" onClick={() => { setFactorEditingApproved(true); if (pendingChange) { setFormData(pendingChange.profile); setApplicability(pendingChange.applicability) } setPendingChange(null); setShowFactorWarning(false) }} className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white">Continue Editing</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Profile
