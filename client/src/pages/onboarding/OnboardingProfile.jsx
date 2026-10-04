import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import OnboardingLayout from '../../components/OnboardingLayout'
import PersonalFactorsForm, { difficultyLevels, validatePersonalFactors } from '../../components/PersonalFactorsForm'
import { buildProfilePayload, deriveFactorApplicability, PERSONAL_FACTOR_KEYS } from '../../utils/profilePersonalFactors'
import { scrollToFirstInvalidField } from '../../utils/formValidation'
import { assessmentHeaders, getAssessmentAttemptId } from '../../utils/assessmentSession'

const emptyProfile = { username: '', physical_accessibility_areas: [], physical_accessibility_difficulties: {}, factor_physical_impact: '', factor_health_impact: '', factor_financial_impact: '', factor_family_impact: '', factor_work_impact: '' }
const emptyApplicability = Object.fromEntries(PERSONAL_FACTOR_KEYS.map((factor) => [factor, '']))
const parseJson = (value, fallback) => { if (value && typeof value === 'object') return value; try { return JSON.parse(value) } catch { return fallback } }

function OnboardingProfile() {
  const navigate = useNavigate(); const token = localStorage.getItem('token')
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [hasSavedProfile, setHasSavedProfile] = useState(false)
  const [formData, setFormData] = useState(emptyProfile); const [applicability, setApplicability] = useState(emptyApplicability); const [fieldErrors, setFieldErrors] = useState({})
  const [message, setMessage] = useState(''); const [error, setError] = useState(''); const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  useEffect(() => {
    if (!token) { navigate('/login', { replace: true }); return }
    fetch(`${import.meta.env.VITE_API_URL}/api/profile`, { headers: assessmentHeaders(sessionStorage, { Authorization: `Bearer ${token}` }) })
      .then((response) => {
        if (response.status === 401 || response.status === 403) { navigate('/login', { replace: true }); return null }
        if (!response.ok) throw new Error()
        return response.json()
      })
      .then((data) => {
        if (!data) return
        if (!data.profile) { setFormData((current) => ({ ...current, username: data.username || '' })); return }
        const areas = parseJson(data.profile.physical_accessibility_areas, []).filter((area) => area !== 'none')
        const rawDifficulties = parseJson(data.profile.physical_accessibility_difficulties, {})
        const difficulties = Object.fromEntries(Object.entries(rawDifficulties).filter(([area, level]) => areas.includes(area) && difficultyLevels.some(([value]) => value === level)))
        const loaded = { username: data.username || '', physical_accessibility_areas: areas, physical_accessibility_difficulties: difficulties, factor_physical_impact: data.profile.factor_physical_impact || '', factor_health_impact: data.profile.factor_health_impact || '', factor_financial_impact: data.profile.factor_financial_impact || '', factor_family_impact: data.profile.factor_family_impact || '', factor_work_impact: data.profile.factor_work_impact || '' }
        setFormData(loaded); setApplicability(deriveFactorApplicability(loaded)); setHasSavedProfile(true)
      })
      .catch(() => setError('Could not load your Personal Factors.'))
      .finally(() => setLoading(false))
  }, [navigate, token])

  const updateFormData = (value) => { setFormData(value); setHasUnsavedChanges(true) }
  const updateApplicability = (value) => { setApplicability(value); setHasUnsavedChanges(true) }
  const clearFieldError = (name) => { setMessage(''); setFieldErrors((current) => current[name] ? { ...current, [name]: undefined } : current) }
  const handleSubmit = async (event) => {
    event.preventDefault(); setMessage(''); setError('')
    const errors = validatePersonalFactors(formData, applicability)
    if (Object.keys(errors).length) { setFieldErrors(errors); scrollToFirstInvalidField(Object.keys(errors)); return }
    const isRetake = Boolean(getAssessmentAttemptId(sessionStorage))
    if (isRetake && hasSavedProfile && !hasUnsavedChanges) { navigate('/onboarding/interests'); return }
    setSaving(true)
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/profile`, { method: 'POST', headers: assessmentHeaders(sessionStorage, { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }), body: JSON.stringify(buildProfilePayload(formData)) })
      const data = await response.json()
      if (!response.ok) { setError(data.message || 'Could not save Personal Factors.'); return }
      if (isRetake) { navigate('/onboarding/interests'); return }
      if (!hasSavedProfile) { navigate('/onboarding/interests'); return }
      setHasUnsavedChanges(false)
      setMessage('Personal Factors updated successfully.')
    } catch { setError('Cannot connect to server. Please try again.') } finally { setSaving(false) }
  }

  const isRetake = Boolean(getAssessmentAttemptId(sessionStorage))
  const isComplete = Object.keys(validatePersonalFactors(formData, applicability)).length === 0

  return <OnboardingLayout currentStep={1} isComplete={isComplete} showFooterNavigation={false}><div className="mx-auto max-w-4xl px-5 py-8 sm:px-8 sm:py-12">
    <header className="mb-7"><p className="text-xs font-bold uppercase tracking-[0.16em] text-orange-500">Assessment Step 1</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-950">Personal Factors</h1><p className="mt-2 text-sm leading-6 text-gray-500">Tell us about circumstances that may affect your studies.</p></header>
    {message && <div role="status" className="mb-5 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div>}{error && <div role="alert" className="mb-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}
    {loading ? <p className="py-12 text-center text-sm text-gray-500">Loading Personal Factors...</p> : <form onSubmit={handleSubmit} noValidate><PersonalFactorsForm formData={formData} applicability={applicability} fieldErrors={fieldErrors} setFormData={updateFormData} setApplicability={updateApplicability} clearFieldError={clearFieldError} /><div className="mt-6 flex justify-end">{isRetake ? <button type="submit" disabled={saving || !isComplete} className="rounded-xl bg-orange-500 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500">{saving ? 'Saving...' : hasUnsavedChanges || !hasSavedProfile ? 'Save & Continue to Interests' : 'Continue to Interests'}</button> : hasSavedProfile && !hasUnsavedChanges ? <button type="button" onClick={() => navigate('/profile')} className="rounded-xl bg-orange-500 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-orange-600">View Profile</button> : <button type="submit" disabled={saving || !isComplete} className="rounded-xl bg-orange-500 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500">{saving ? 'Saving...' : hasSavedProfile ? 'Save Changes' : 'Save & Continue to Interests'}</button>}</div></form>}
  </div></OnboardingLayout>
}
export default OnboardingProfile
