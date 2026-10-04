import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { IconArrowLeft, IconEdit, IconUser } from '@tabler/icons-react'
import { deriveFactorApplicability } from '../utils/profilePersonalFactors'

export { ApplicabilityQuestion, ImpactOptions } from '../components/PersonalFactorsForm'
export { UsernameField } from './ProfileEdit'

const impactLabels = { 1: 'No impact', 2: 'Slight impact', 3: 'Moderate impact', 4: 'High impact' }
const factorRows = [
  ['physical', 'Physical / Accessibility'],
  ['health', 'Health'],
  ['financial', 'Financial'],
  ['family', 'Family Responsibilities'],
  ['work', 'Work Responsibilities'],
]
const parseJsonValue = (value, fallback) => { if (value && typeof value === 'object') return value; if (typeof value !== 'string') return fallback; try { return JSON.parse(value) } catch { return fallback } }

function summarizeFactor(profile, applicability, factor) {
  if (!profile || !applicability[factor]) return 'Not provided'
  if (factor === 'physical' && applicability.physical === 'no') return 'No'
  return impactLabels[Number(profile[`factor_${factor}_impact`])] || 'Not provided'
}

export default function Profile() {
  const navigate = useNavigate(); const location = useLocation(); const token = localStorage.getItem('token')
  const [loading, setLoading] = useState(true); const [username, setUsername] = useState(''); const [profile, setProfile] = useState(null); const [error, setError] = useState('')

  useEffect(() => {
    if (!token) { navigate('/login', { replace: true }); return }
    fetch(`${import.meta.env.VITE_API_URL}/api/profile`, { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => { if (response.status === 401 || response.status === 403) { navigate('/login', { replace: true }); return null }; if (!response.ok) throw new Error(); return response.json() })
      .then((data) => {
        if (!data) return
        setUsername(data.username || localStorage.getItem('username') || '')
        if (!data.profile) return
        const rawAreas = parseJsonValue(data.profile.physical_accessibility_areas, [])
        const areas = Array.isArray(rawAreas) ? rawAreas.filter((area) => area !== 'none') : []
        const rawDifficulties = parseJsonValue(data.profile.physical_accessibility_difficulties, {})
        setProfile({ ...data.profile, physical_accessibility_areas: areas, physical_accessibility_difficulties: rawDifficulties && typeof rawDifficulties === 'object' ? rawDifficulties : {} })
      })
      .catch(() => setError('Could not load your profile.'))
      .finally(() => setLoading(false))
  }, [navigate, token])

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-[#fcfbf9]"><p className="text-sm text-gray-500">Loading your profile...</p></div>
  const applicability = deriveFactorApplicability(profile || {})

  return <div className="min-h-screen bg-[#fcfbf9] text-gray-900">
    <nav className="flex items-center justify-between border-b border-gray-200/80 bg-white/90 px-4 py-4 backdrop-blur sm:px-8 lg:px-14"><button onClick={() => navigate('/dashboard')} className="text-lg font-bold tracking-tight">Learn<span className="text-orange-500">Match</span></button><button onClick={() => navigate('/dashboard')} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-800"><IconArrowLeft size={16} /> Back to Dashboard</button></nav>
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-8 sm:py-10">
      <header className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-orange-500">Account profile</p><h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Your profile</h1><p className="mt-2 text-sm text-gray-500">Review your account and saved Personal Factors.</p></div><button type="button" onClick={() => navigate('/profile/edit')} className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-orange-600"><IconEdit size={17} /> Edit Profile</button></header>
      {location.state?.message && <div role="status" className="mb-5 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{location.state.message}</div>}
      {error && <div role="alert" className="mb-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}
      <div className="space-y-6">
        <section className="rounded-2xl border border-gray-200/80 bg-white p-5 shadow-sm sm:p-6"><div className="flex items-center gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-600"><IconUser size={20} /></span><div><p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Account Username</p><p className="mt-1 font-semibold text-gray-900">{username || 'Not provided'}</p></div></div></section>
        <section className="rounded-3xl border border-gray-200/80 bg-white p-5 shadow-sm sm:p-7"><div className="mb-5 border-b border-gray-100 pb-5"><p className="text-xs font-bold uppercase tracking-[0.14em] text-orange-500">Saved answers</p><h2 className="mt-1.5 text-xl font-bold">Personal Factors</h2></div><dl className="divide-y divide-gray-100">{factorRows.map(([factor, label]) => <div key={factor} className="grid gap-1 py-4 first:pt-0 last:pb-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-6"><dt className="text-sm font-medium text-gray-600">{label}</dt><dd className="text-sm font-semibold text-gray-900">{summarizeFactor(profile, applicability, factor)}</dd></div>)}</dl></section>
      </div>
    </main>
  </div>
}
