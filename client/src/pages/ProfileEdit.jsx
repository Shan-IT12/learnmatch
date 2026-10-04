import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconArrowLeft, IconArrowRight, IconUser } from '@tabler/icons-react'
import { FieldError, RequiredMark } from '../components/FormValidation'
import PersonalFactorsForm, { ApplicabilityQuestion, ImpactOptions, difficultyLevels, validatePersonalFactors } from '../components/PersonalFactorsForm'
import { PERSONAL_FACTOR_KEYS, buildProfilePayload, deriveFactorApplicability } from '../utils/profilePersonalFactors'
import { scrollToFirstInvalidField } from '../utils/formValidation'
import { USERNAME_MAX_LENGTH, USERNAME_MIN_LENGTH, validateUsername } from '../utils/usernameValidation'

export { ApplicabilityQuestion, ImpactOptions }

const emptyProfile = { username: '', physical_accessibility_areas: [], physical_accessibility_difficulties: {}, factor_physical_impact: '', factor_health_impact: '', factor_financial_impact: '', factor_family_impact: '', factor_work_impact: '' }
const emptyApplicability = Object.fromEntries(PERSONAL_FACTOR_KEYS.map((factor) => [factor, '']))
const parseJsonValue = (value, fallback) => { if (value && typeof value === 'object') return value; if (typeof value !== 'string') return fallback; try { return JSON.parse(value) } catch { return fallback } }

export function UsernameField({ value, onChange, error }) {
  return <label data-validation-field="username" className="block flex-1 text-sm font-medium text-gray-700">Username <RequiredMark /><input required aria-required="true" aria-invalid={error ? 'true' : undefined} aria-describedby={error ? 'username-error' : undefined} value={value} onChange={(event) => onChange(event.target.value)} minLength={USERNAME_MIN_LENGTH} maxLength={USERNAME_MAX_LENGTH} className={`mt-1.5 w-full rounded-xl border bg-gray-50/60 px-4 py-2.5 text-gray-900 outline-none transition focus:bg-white focus:ring-2 focus:ring-orange-200 ${error ? 'border-red-400' : 'border-gray-200 focus:border-orange-400'}`} /><FieldError id="username-error">{error}</FieldError></label>
}

export default function ProfileEdit() {
  const navigate = useNavigate(); const token = localStorage.getItem('token')
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState(emptyProfile); const [applicability, setApplicability] = useState(emptyApplicability); const [fieldErrors, setFieldErrors] = useState({}); const [error, setError] = useState('')

  useEffect(() => {
    if (!token) { navigate('/login', { replace: true }); return }
    fetch(`${import.meta.env.VITE_API_URL}/api/profile`, { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => { if (response.status === 401 || response.status === 403) { navigate('/login', { replace: true }); return null }; if (!response.ok) throw new Error('Could not load profile.'); return response.json() })
      .then((data) => {
        if (!data) return
        if (!data.profile) { setFormData((current) => ({ ...current, username: data.username || '' })); return }
        const rawAreas = parseJsonValue(data.profile.physical_accessibility_areas, [])
        const areas = Array.isArray(rawAreas) ? rawAreas.filter((area) => area !== 'none') : []
        const rawDifficulties = parseJsonValue(data.profile.physical_accessibility_difficulties, {})
        const difficulties = Object.fromEntries(Object.entries(rawDifficulties).filter(([area, level]) => areas.includes(area) && difficultyLevels.some(([value]) => value === level)))
        const loaded = { username: data.username || localStorage.getItem('username') || '', physical_accessibility_areas: areas, physical_accessibility_difficulties: difficulties, factor_physical_impact: data.profile.factor_physical_impact || '', factor_health_impact: data.profile.factor_health_impact || '', factor_financial_impact: data.profile.factor_financial_impact || '', factor_family_impact: data.profile.factor_family_impact || '', factor_work_impact: data.profile.factor_work_impact || '' }
        setFormData(loaded); setApplicability(deriveFactorApplicability(loaded))
      })
      .catch(() => setError('Could not load your profile.'))
      .finally(() => setLoading(false))
  }, [navigate, token])

  const clearFieldError = (name) => setFieldErrors((current) => current[name] ? { ...current, [name]: undefined } : current)
  const handleSubmit = async (event) => {
    event.preventDefault(); setError('')
    const errors = validatePersonalFactors(formData, applicability); const usernameError = validateUsername(formData.username)
    if (usernameError) errors.username = usernameError
    if (Object.keys(errors).length) { setFieldErrors(errors); scrollToFirstInvalidField(Object.keys(errors)); return }
    setSaving(true)
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/profile`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(buildProfilePayload(formData)) })
      const data = await response.json()
      if (response.status === 401 || response.status === 403) { navigate('/login', { replace: true }); return }
      if (!response.ok) { if (data.field === 'username') { setFieldErrors((current) => ({ ...current, username: data.message || 'Username is already taken.' })); scrollToFirstInvalidField(['username']); return }; setError(data.message || 'Could not save your profile.'); return }
      localStorage.setItem('username', data.username || formData.username)
      navigate('/profile', { replace: true, state: { message: 'Profile updated successfully.' } })
    } catch { setError('Cannot connect to server. Please try again.') } finally { setSaving(false) }
  }

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-[#fcfbf9]"><p className="text-sm text-gray-500">Loading your profile...</p></div>
  return <div className="min-h-screen bg-[#fcfbf9] text-gray-900"><nav className="flex items-center justify-between border-b border-gray-200/80 bg-white/90 px-4 py-4 backdrop-blur sm:px-8 lg:px-14"><button onClick={() => navigate('/dashboard')} className="text-lg font-bold tracking-tight">Learn<span className="text-orange-500">Match</span></button><button onClick={() => navigate('/profile')} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-800"><IconArrowLeft size={16} /> Back to Profile</button></nav><main className="mx-auto max-w-5xl px-4 py-8 sm:px-8 sm:py-10"><header className="mb-8"><p className="text-xs font-bold uppercase tracking-[0.16em] text-orange-500">Account profile</p><h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Edit profile</h1></header>{error && <div role="alert" className="mb-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}<form onSubmit={handleSubmit} noValidate className="space-y-6"><section className="rounded-2xl border border-gray-200/80 bg-white p-4 shadow-sm sm:p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-start"><div className="flex min-w-44 items-center gap-3 sm:pt-1"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-600"><IconUser size={20} /></span><div><h2 className="font-semibold">Account username</h2><p className="mt-0.5 text-sm text-gray-500">Used across LearnMatch</p></div></div><UsernameField value={formData.username} error={fieldErrors.username} onChange={(username) => { clearFieldError('username'); setFormData({ ...formData, username }) }} /></div></section><section className="rounded-3xl border border-gray-200/80 bg-white p-4 shadow-sm sm:p-7"><div className="mb-6 border-b border-gray-100 pb-5"><p className="text-xs font-bold uppercase tracking-[0.14em] text-orange-500">About your circumstances</p><h2 className="mt-1.5 text-xl font-bold">Personal Factors</h2><p className="mt-1.5 text-sm leading-6 text-gray-500">Tell us about personal circumstances that may affect your studies.</p></div><PersonalFactorsForm formData={formData} applicability={applicability} fieldErrors={fieldErrors} setFormData={setFormData} setApplicability={setApplicability} clearFieldError={clearFieldError} /></section><div className="flex justify-end"><button type="submit" disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500">{saving ? 'Saving...' : 'Save Changes'} <IconArrowRight size={17} /></button></div></form></main></div>
}
