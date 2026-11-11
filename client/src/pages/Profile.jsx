import HeaderBrand from '../components/HeaderBrand'
import SkeletonContent from '../components/SkeletonContent'
import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { IconArrowLeft, IconEdit, IconUser } from '@tabler/icons-react'
import { isPersonalFactorsComplete } from '../utils/profilePersonalFactors'
import { getProfileReturnDestination } from '../utils/profileNavigation'
import PersonalFactorsSummary from '../components/PersonalFactorsSummary'

export { ApplicabilityQuestion, ImpactOptions } from '../components/PersonalFactorsForm'
export { UsernameField } from './ProfileEdit'

const parseJsonValue = (value, fallback) => { if (value && typeof value === 'object') return value; if (typeof value !== 'string') return fallback; try { return JSON.parse(value) } catch { return fallback } }

export default function Profile() {
  const navigate = useNavigate(); const location = useLocation(); const token = localStorage.getItem('token')
  const returnDestination = getProfileReturnDestination(location.search, location.state)
  const profileSearch = returnDestination.search
  const [personalFactorsReadOnly, setPersonalFactorsReadOnly] = useState(false)
  const [loading, setLoading] = useState(true); const [username, setUsername] = useState(''); const [profile, setProfile] = useState(null); const [error, setError] = useState('')

  useEffect(() => {
    if (!token) { navigate('/login', { replace: true }); return }
    fetch(`${import.meta.env.VITE_API_URL}/api/profile`, { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => { if (response.status === 401 || response.status === 403) { navigate('/login', { replace: true }); return null }; if (response.status === 404 || response.status === 204) { navigate(`/profile/edit${profileSearch}`, { replace: true }); return null }; if (!response.ok) throw new Error(); return response.json() })
      .then((data) => {
        if (!data) return
        setPersonalFactorsReadOnly(data.personalFactorsReadOnly === true)
        setUsername(data.username || localStorage.getItem('username') || '')
        if (!data.profile && !data.personalFactorsReadOnly) { navigate(`/profile/edit${profileSearch}`, { replace: true }); return }
        const rawAreas = parseJsonValue(data.profile?.physical_accessibility_areas, [])
        const areas = Array.isArray(rawAreas) ? rawAreas.filter((area) => area !== 'none') : []
        const rawDifficulties = parseJsonValue(data.profile?.physical_accessibility_difficulties, {})
        const loaded = { ...data.profile, physical_accessibility_areas: areas, physical_accessibility_difficulties: rawDifficulties && typeof rawDifficulties === 'object' ? rawDifficulties : {} }
        if (!data.personalFactorsReadOnly && !isPersonalFactorsComplete(loaded)) { navigate(`/profile/edit${profileSearch}`, { replace: true }); return }
        setProfile(loaded)
      })
      .catch(() => setError('Could not load your profile.'))
      .finally(() => setLoading(false))
  }, [navigate, token, profileSearch])

  return <div className="min-h-screen bg-[#fcfbf9] text-gray-900">
    <nav className="lm-site-header flex items-center justify-between border-b border-gray-200/80 bg-white/90 px-4 py-4 backdrop-blur sm:px-8 lg:px-14"><button onClick={() => navigate(returnDestination.path)} className="text-lg font-bold tracking-tight"><HeaderBrand /></button><button onClick={() => navigate(returnDestination.path)} className="lm-action"><IconArrowLeft size={16} /> {returnDestination.label}</button></nav>
    <SkeletonContent loading={loading} label="Loading Profile..."><main className="mx-auto max-w-4xl px-4 py-8 sm:px-8 sm:py-10">
      <header className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-orange-500">Account profile</p><h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Your profile</h1><p className="mt-2 text-sm text-gray-500">Review your account and saved Personal Factors.</p></div><button type="button" onClick={() => navigate(`/profile/edit${profileSearch}`)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-orange-600"><IconEdit size={17} /> {personalFactorsReadOnly ? 'Edit Username' : 'Edit Profile'}</button></header>
      {location.state?.message && <div role="status" className="mb-5 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{location.state.message}</div>}
      {error && <div role="alert" className="mb-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}
      <div className="space-y-6">
        <section className="rounded-2xl border border-gray-200/80 bg-white p-5 shadow-sm sm:p-6"><div className="flex items-center gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-600"><IconUser size={20} /></span><div><p className="text-xs font-semibold uppercase tracking-wide text-gray-600">Account Username</p><p className="mt-1 font-semibold text-gray-900">{username || 'Not provided'}</p></div></div></section>
        <section className="rounded-3xl border border-gray-200/80 bg-white p-5 shadow-sm sm:p-7"><div className="mb-5 border-b border-gray-100 pb-5"><p className="text-xs font-bold uppercase tracking-[0.14em] text-orange-500">Saved answers</p><h2 className="mt-1.5 text-xl font-bold">Personal Factors</h2>{personalFactorsReadOnly && <p className="mt-2 text-sm text-gray-500">These saved assessment answers are read-only in your College Phase profile.</p>}</div><PersonalFactorsSummary profile={profile} /></section>
      </div>
    </main></SkeletonContent>
  </div>
}
