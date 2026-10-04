import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import OnboardingLayout from '../../components/OnboardingLayout'
import PersonalFactorsForm, { difficultyLevels, validatePersonalFactors } from '../../components/PersonalFactorsForm'
import { buildProfilePayload, deriveFactorApplicability, PERSONAL_FACTOR_KEYS } from '../../utils/profilePersonalFactors'
import { scrollToFirstInvalidField } from '../../utils/formValidation'
import { assessmentHeaders, beginAssessmentAttempt, getAssessmentAttemptId } from '../../utils/assessmentSession'

const emptyProfile = { username: '', physical_accessibility_areas: [], physical_accessibility_difficulties: {}, factor_physical_impact: '', factor_health_impact: '', factor_financial_impact: '', factor_family_impact: '', factor_work_impact: '' }
const emptyApplicability = Object.fromEntries(PERSONAL_FACTOR_KEYS.map((factor) => [factor, '']))
const parseJson = (value, fallback) => { if (value && typeof value === 'object') return value; try { return JSON.parse(value) } catch { return fallback } }
const impactLabels = { 1: 'No impact', 2: 'Slight impact', 3: 'Moderate impact', 4: 'High impact' }
const factorLabels = { physical: 'Physical / Accessibility', health: 'Health', financial: 'Financial', family: 'Family Responsibilities', work: 'Work Responsibilities' }
const summarizeFactor = (formData, applicability, factor) => {
  if (!applicability[factor]) return 'Incomplete'
  if (factor === 'physical' && applicability.physical === 'no') return 'No'
  return impactLabels[Number(formData[`factor_${factor}_impact`])] || 'Incomplete'
}

function OnboardingProfile() {
  const navigate = useNavigate(); const token = localStorage.getItem('token')
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState(emptyProfile); const [applicability, setApplicability] = useState(emptyApplicability); const [fieldErrors, setFieldErrors] = useState({})
  const [error, setError] = useState(''); const [message, setMessage] = useState('')
  const [hasSavedProfile, setHasSavedProfile] = useState(false); const [isEditing, setIsEditing] = useState(false); const [continuing, setContinuing] = useState(false)

  useEffect(() => {
    if (!token) { navigate('/login', { replace: true }); return }
    // Profile is the canonical Personal Factors source. Retake attempt headers
    // must not change which saved values Step 1 preloads.
    fetch(`${import.meta.env.VITE_API_URL}/api/profile`, { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => {
        if (response.status === 401 || response.status === 403) { navigate('/login', { replace: true }); return null }
        if (response.status === 404 || response.status === 204) return { username: localStorage.getItem('username') || '', profile: null }
        if (!response.ok) throw new Error()
        return response.json()
      })
      .then((data) => {
        if (!data) return
        if (!data.profile) { setFormData((current) => ({ ...current, username: data.username || '' })); setIsEditing(true); return }
        const areas = parseJson(data.profile.physical_accessibility_areas, []).filter((area) => area !== 'none')
        const rawDifficulties = parseJson(data.profile.physical_accessibility_difficulties, {})
        const difficulties = Object.fromEntries(Object.entries(rawDifficulties).filter(([area, level]) => areas.includes(area) && difficultyLevels.some(([value]) => value === level)))
        const loaded = { username: data.username || '', physical_accessibility_areas: areas, physical_accessibility_difficulties: difficulties, factor_physical_impact: data.profile.factor_physical_impact || '', factor_health_impact: data.profile.factor_health_impact || '', factor_financial_impact: data.profile.factor_financial_impact || '', factor_family_impact: data.profile.factor_family_impact || '', factor_work_impact: data.profile.factor_work_impact || '' }
        setFormData(loaded); setApplicability(deriveFactorApplicability(loaded)); setHasSavedProfile(true)
      })
      .catch(() => setError('Could not load your Personal Factors.'))
      .finally(() => setLoading(false))
  }, [navigate, token])

  const clearFieldError = (name) => setFieldErrors((current) => current[name] ? { ...current, [name]: undefined } : current)
  const handleSubmit = async (event) => {
    event.preventDefault(); setError(''); setMessage('')
    const errors = validatePersonalFactors(formData, applicability)
    if (Object.keys(errors).length) { setFieldErrors(errors); scrollToFirstInvalidField(Object.keys(errors)); return }
    setSaving(true)
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/profile`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(buildProfilePayload(formData)) })
      const data = await response.json()
      if (!response.ok) { setError(data.message || 'Could not save Personal Factors.'); return }
      setHasSavedProfile(true); setIsEditing(false); setMessage('Personal Factors updated successfully.')
    } catch { setError('Cannot connect to server. Please try again.') } finally { setSaving(false) }
  }

  const handleContinue = async () => {
    if (!isComplete) return
    setContinuing(true); setError('')
    try {
      const currentAttemptId = getAssessmentAttemptId(sessionStorage)
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/assessment-attempts/recover`, {
        method: 'POST',
        headers: assessmentHeaders(sessionStorage, { Authorization: `Bearer ${token}` }),
      })
      const data = await response.json()
      if (!response.ok || !data.attemptId) { setError('Could not continue the assessment. Please try again.'); return }
      if (data.attemptId !== currentAttemptId) beginAssessmentAttempt(sessionStorage, data.attemptId)
      navigate('/onboarding/interests')
    } catch { setError('Could not continue the assessment. Please try again.') } finally { setContinuing(false) }
  }

  const isComplete = Object.keys(validatePersonalFactors(formData, applicability)).length === 0

  return <OnboardingLayout currentStep={1} isComplete={isComplete} showFooterNavigation={false}><div className="mx-auto max-w-4xl px-5 py-8 sm:px-8 sm:py-12">
    <header className="mb-7"><p className="text-xs font-bold uppercase tracking-[0.16em] text-orange-500">Assessment Step 1</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-950">Personal Factors</h1><p className="mt-2 text-sm leading-6 text-gray-500">Tell us about circumstances that may affect your studies.</p></header>
    {message && <div role="status" className="mb-5 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div>}
    {error && <div role="alert" className="mb-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}
    {loading ? <p className="py-12 text-center text-sm text-gray-500">Loading Personal Factors...</p> : hasSavedProfile && !isEditing ? <div className="space-y-6"><section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm sm:p-7"><div className="mb-4 border-b border-gray-100 pb-4"><h2 className="text-lg font-bold text-gray-900">Saved Personal Factors</h2><p className="mt-1 text-sm text-gray-500">Review the information LearnMatch will use for this assessment.</p></div><dl className="divide-y divide-gray-100">{PERSONAL_FACTOR_KEYS.map((factor) => <div key={factor} className="flex flex-col gap-1 py-3.5 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-6"><dt className="text-sm font-medium text-gray-600">{factorLabels[factor]}</dt><dd className="text-sm font-semibold text-gray-900">{summarizeFactor(formData, applicability, factor)}</dd></div>)}</dl></section><div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button type="button" onClick={() => { setMessage(''); setIsEditing(true) }} className="rounded-xl border border-gray-300 bg-white px-6 py-3 text-sm font-semibold text-gray-700 hover:border-orange-300 hover:text-orange-700">Edit Personal Factors</button><button type="button" onClick={handleContinue} disabled={continuing || !isComplete} className="rounded-xl bg-orange-500 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500">{continuing ? 'Continuing...' : 'Continue to Interests'}</button></div></div> : <form onSubmit={handleSubmit} noValidate><PersonalFactorsForm formData={formData} applicability={applicability} fieldErrors={fieldErrors} setFormData={setFormData} setApplicability={setApplicability} clearFieldError={clearFieldError} /><div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">{!hasSavedProfile && <button type="button" disabled className="rounded-xl bg-gray-200 px-6 py-3 text-sm font-semibold text-gray-500">Continue to Interests</button>}<button type="submit" disabled={saving || !isComplete} className="rounded-xl bg-orange-500 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500">{saving ? 'Saving...' : hasSavedProfile ? 'Save Changes' : 'Save Personal Factors'}</button></div></form>}
  </div></OnboardingLayout>
}
export default OnboardingProfile
