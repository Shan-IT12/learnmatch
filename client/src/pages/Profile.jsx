import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  personalFactorsChanged,
  shouldOfferRetake,
  shouldWarnForPersonalFactorAttempt,
} from '../utils/profilePersonalFactors'
import {
  IconActivity,
  IconArrowLeft,
  IconArrowRight,
  IconBriefcase,
  IconCheck,
  IconHeart,
  IconInfoCircle,
  IconMessageCircle,
  IconPencil,
  IconRefresh,
  IconUser,
  IconUsers,
  IconWallet,
} from '@tabler/icons-react'

const personalFactors = [
  {
    name: 'factor_physical',
    icon: IconActivity,
    iconClass: 'bg-orange-50 text-orange-600',
    label: 'I have physical or mobility needs that may affect my options.',
    meaning: 'Physical limitations, disabilities, or conditions that affect mobility, stamina, or your ability to do certain hands-on or physically demanding tasks.',
  },
  {
    name: 'factor_health',
    icon: IconHeart,
    iconClass: 'bg-rose-50 text-rose-500',
    label: 'I have health needs that may affect my studies.',
    meaning: 'Chronic illness, mental health conditions, or medical needs that may require ongoing management, treatment, or accommodation.',
  },
  {
    name: 'factor_financial',
    icon: IconWallet,
    iconClass: 'bg-emerald-50 text-emerald-600',
    label: 'Financial situation may affect my course choices.',
    meaning: 'Limited financial resources for tuition, school materials, transportation, or other costs related to pursuing this course.',
  },
  {
    name: 'factor_family',
    icon: IconUsers,
    iconClass: 'bg-indigo-50 text-indigo-500',
    label: 'I have family responsibilities that may affect my studies.',
    meaning: 'Responsibilities like caring for siblings, parents, or other family members that may affect your available time or flexibility.',
  },
  {
    name: 'factor_working_student',
    icon: IconBriefcase,
    iconClass: 'bg-amber-50 text-amber-600',
    label: 'I work or plan to work while studying.',
    meaning: 'Needing to work, hold a job, or take on income-generating responsibilities alongside school, which may affect your available time and schedule flexibility.',
  },
]

const emptyProfile = {
  full_name: '',
  height_cm: '',
  weight_kg: '',
  factor_physical: false,
  factor_health: false,
  factor_financial: false,
  factor_family: false,
  factor_working_student: false,
  factor_others: '',
}

function Profile() {
  const navigate = useNavigate()
  const token = localStorage.getItem('token')
  const location = useLocation()
  const entryContext = location.state?.entryContext === 'assessment' ? 'assessment' : 'dashboard'
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [hasExistingProfile, setHasExistingProfile] = useState(false)
  const [hasExistingRecommendation, setHasExistingRecommendation] = useState(false)
  const [isEditing, setIsEditing] = useState(true)
  const [showRetakePrompt, setShowRetakePrompt] = useState(false)
  const [showFactorWarning, setShowFactorWarning] = useState(false)
  const [pendingFactorChange, setPendingFactorChange] = useState(null)
  const [factorEditingApproved, setFactorEditingApproved] = useState(false)
  const [openFactorTooltip, setOpenFactorTooltip] = useState(null)
  const [pinnedFactorTooltip, setPinnedFactorTooltip] = useState(null)
  const [othersSelected, setOthersSelected] = useState(false)
  const [savedOthersSelected, setSavedOthersSelected] = useState(false)
  const [formData, setFormData] = useState(emptyProfile)
  const [savedFormData, setSavedFormData] = useState(emptyProfile)

  const [bmi, setBmi] = useState(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) {
      navigate('/login')
      return
    }

    const fetchProfile = async () => {
      try {
        const headers = { Authorization: `Bearer ${token}` }
        const [response, recommendationResponse] = await Promise.all([
          fetch(`${import.meta.env.VITE_API_URL}/api/profile`, { headers }),
          fetch(`${import.meta.env.VITE_API_URL}/api/recommendations/latest`, { headers }),
        ])

        if ([response.status, recommendationResponse.status].some((status) => status === 401 || status === 403)) {
          navigate('/login', { replace: true })
          return
        }

        const data = await response.json()
        if (recommendationResponse.ok) {
          const recommendationData = await recommendationResponse.json()
          setHasExistingRecommendation(Boolean(recommendationData.recommendation))
        }

        if (data.profile) {
          const loadedProfile = {
            full_name: data.profile.full_name || '',
            height_cm: data.profile.height_cm || '',
            weight_kg: data.profile.weight_kg || '',
            factor_physical: !!data.profile.factor_physical,
            factor_health: !!data.profile.factor_health,
            factor_financial: !!data.profile.factor_financial,
            factor_family: !!data.profile.factor_family,
            factor_working_student: !!data.profile.factor_working_student,
            factor_others: data.profile.factor_others || '',
          }
          setFormData(loadedProfile)
          setSavedFormData(loadedProfile)
          setOthersSelected(Boolean(loadedProfile.factor_others))
          setSavedOthersSelected(Boolean(loadedProfile.factor_others))
          setHasExistingProfile(true)
          setIsEditing(false)
        }
      } catch {
        console.error('Could not load profile')
      } finally {
        setLoadingProfile(false)
      }
    }

    fetchProfile()
  }, [navigate, token])

  useEffect(() => {
    const closePinnedTooltip = (event) => {
      if (event.target.closest('[data-factor-tooltip]')) return
      setPinnedFactorTooltip(null)
      setOpenFactorTooltip(null)
    }

    document.addEventListener('pointerdown', closePinnedTooltip)
    return () => document.removeEventListener('pointerdown', closePinnedTooltip)
  }, [])

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value,
    })
  }

  const applyFactorChange = (change) => {
    if (change.kind === 'others-toggle') {
      setOthersSelected(change.checked)
      if (!change.checked) {
        setFormData((current) => ({ ...current, factor_others: '' }))
      }
      return
    }

    setFormData((current) => ({ ...current, [change.name]: change.value }))
  }

  const requestFactorChange = (change) => {
    const nextOthersSelected = change.kind === 'others-toggle' ? change.checked : othersSelected
    const nextProfile = change.kind === 'others-toggle'
      ? (change.checked ? formData : { ...formData, factor_others: '' })
      : { ...formData, [change.name]: change.value }

    if (shouldWarnForPersonalFactorAttempt({
      hasRecommendation: hasExistingRecommendation,
      confirmationGranted: factorEditingApproved,
      nextProfile,
      savedProfile: savedFormData,
      nextOthersSelected,
      savedOthersSelected,
    })) {
      setPendingFactorChange(change)
      setShowFactorWarning(true)
      return
    }
    applyFactorChange(change)
  }

  const continueFactorEditing = () => {
    setFactorEditingApproved(true)
    if (pendingFactorChange) applyFactorChange(pendingFactorChange)
    setPendingFactorChange(null)
    setShowFactorWarning(false)
  }

  const cancelEditing = () => {
    setFormData(savedFormData)
    setOthersSelected(savedOthersSelected)
    setBmi(null)
    setError('')
    setMessage('')
    setShowRetakePrompt(false)
    setFactorEditingApproved(false)
    setIsEditing(false)
  }

  const computeBmi = () => {
    const height = parseFloat(formData.height_cm)
    const weight = parseFloat(formData.weight_kg)

    if (!height || !weight) {
      setError('Please enter both height and weight to compute BMI.')
      return
    }

    const heightInMeters = height / 100
    const computed = (weight / (heightInMeters * heightInMeters)).toFixed(1)
    setBmi(computed)
    setError('')
  }

  const getBmiLabel = (bmi) => {
    if (bmi < 18.5) return 'Underweight'
    if (bmi < 25) return 'Normal'
    if (bmi < 30) return 'Overweight'
    return 'Obese'
  }

  const profileBmi = formData.height_cm && formData.weight_kg
    ? (Number(formData.weight_kg) / ((Number(formData.height_cm) / 100) ** 2)).toFixed(1)
    : null

  const selectedFactors = personalFactors.filter((factor) => formData[factor.name])

    const handleSubmit = async (e) => {
    e.preventDefault()
    setMessage('')
    setError('')

    const factorsWereChanged = hasExistingProfile && personalFactorsChanged(
      formData,
      savedFormData,
      othersSelected,
      savedOthersSelected
    )

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (response.status === 401 || response.status === 403) {
        navigate('/login', { replace: true })
        return
      }

      if (!response.ok) {
        setError(data.message)
        return
      }

      if (hasExistingProfile) {
        setSavedFormData(formData)
        setSavedOthersSelected(othersSelected)
        setHasExistingProfile(true)
        setIsEditing(false)
        setFactorEditingApproved(false)
        setMessage('Profile updated successfully')
        setShowRetakePrompt(shouldOfferRetake({
          hasRecommendation: hasExistingRecommendation,
          factorsChanged: factorsWereChanged,
        }))
      } else if (entryContext === 'assessment') {
        setMessage(data.message)
        setTimeout(() => {
          navigate('/onboarding/interests')
        }, 800)
      } else {
        setMessage(data.message)
        setTimeout(() => {
          navigate('/dashboard', { state: { profileUpdated: true } })
        }, 800)
      }
    } catch {
      setError('Cannot connect to server. Please try again.')
    }
  }

  if (loadingProfile) {
    return (
      <div className="min-h-screen bg-[#fcfbf9] flex items-center justify-center">
        <p className="text-sm text-gray-500">Loading your profile...</p>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#fcfbf9] text-gray-900">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(251,146,60,0.08),transparent_30%),radial-gradient(circle_at_100%_30%,rgba(196,181,253,0.08),transparent_28%)]" />
      <nav className="relative z-10 flex items-center justify-between gap-3 border-b border-white/80 bg-white/85 px-4 py-4 shadow-[0_1px_12px_rgba(15,23,42,0.03)] backdrop-blur-md sm:px-8 lg:px-14">
        <button
          onClick={() => navigate('/dashboard')}
          className="text-lg font-bold tracking-tight text-gray-900 transition hover:opacity-75"
        >
          Learn<span className="text-orange-500">Match</span>
        </button>
        <button
          onClick={() => navigate('/dashboard')}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-gray-500 transition hover:bg-gray-50 hover:text-gray-900 sm:text-sm"
        >
          <IconArrowLeft size={16} stroke={2} /> Back to Dashboard
        </button>
      </nav>

      <main className="relative z-0 mx-auto max-w-5xl px-4 py-6 sm:px-8 sm:py-8 lg:px-10 lg:py-9">
        <header className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-orange-500">
              {hasExistingProfile ? (isEditing ? 'Edit profile' : 'View profile') : 'Setup profile'}
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-gray-950 sm:text-3xl">Personal Information</h1>
            <p className="mt-2 text-sm leading-relaxed text-gray-500 sm:text-base">This helps LearnMatch personalize your course recommendations.</p>
          </div>
          {hasExistingProfile && !isEditing && (
            <button
              type="button"
              onClick={() => {
                setMessage('')
                setShowRetakePrompt(false)
                setIsEditing(true)
              }}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-orange-200 bg-white px-4 py-2.5 text-sm font-semibold text-orange-700 shadow-sm transition hover:bg-orange-50 focus:outline-none focus:ring-4 focus:ring-orange-100 sm:w-auto"
            >
              <IconPencil size={16} stroke={2} /> Edit Profile
            </button>
          )}
        </header>

        {message && (
          <div role="status" className="mb-6 rounded-2xl border border-emerald-100 bg-emerald-50/90 px-4 py-3 text-sm text-emerald-700 shadow-sm">
            {message}
          </div>
        )}

        {error && (
          <div role="alert" className="mb-6 rounded-2xl border border-red-100 bg-red-50/90 px-4 py-3 text-sm text-red-600 shadow-sm">
            {error}
          </div>
        )}

        {/* Optional retake action after saved Personal Factor changes. */}
        {showRetakePrompt && (
          <div className="mb-6 rounded-2xl border border-orange-100 bg-orange-50/90 px-5 py-4 shadow-sm">
            <p className="text-sm font-semibold text-gray-900 mb-1">
              Personal Factors updated
            </p>
            <p className="text-xs text-gray-500 mb-4">
              Your existing recommendations have not changed. Retake the assessment whenever you want recommendations based on your updated situation.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => setShowRetakePrompt(false)}
                className="flex-1 bg-white border border-gray-200 text-gray-700 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition"
              >
                Not now
              </button>
              <button
                type="button"
                onClick={() => navigate('/onboarding/profile')}
                className="flex-1 bg-orange-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-orange-600 transition"
              >
                <span className="inline-flex items-center gap-2"><IconRefresh size={16} stroke={2} /> Retake Assessment</span>
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Name */}
          <section className="rounded-2xl border border-white/80 bg-white/85 p-5 shadow-[0_8px_30px_rgba(15,23,42,0.05)] backdrop-blur-md sm:p-7">
            <div className="mb-5 flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-600"><IconUser size={20} stroke={1.8} /></span>
              <div>
                <h2 className="text-base font-semibold text-gray-950">Name</h2>
                <p className="mt-0.5 text-sm text-gray-500">Enter your full name as you would like it to appear.</p>
              </div>
            </div>
            {isEditing ? (
              <input
                id="full_name"
                aria-label="Full name"
                type="text"
                name="full_name"
                value={formData.full_name}
                onChange={handleChange}
                placeholder="Enter your full name"
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-gray-400 focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
                required
              />
            ) : (
              <p className="rounded-xl bg-gray-50 px-4 py-3 text-sm font-medium text-gray-800">{formData.full_name}</p>
            )}
          </section>

          {/* BMI Section */}
          <section className="rounded-2xl border border-white/80 bg-white/85 p-5 shadow-[0_8px_30px_rgba(15,23,42,0.05)] backdrop-blur-md sm:p-7">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
              <div>
                <div className="mb-5 flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-600"><IconActivity size={20} stroke={1.8} /></span>
                  <div>
                    <h2 className="text-base font-semibold text-gray-950">BMI <span className="font-normal text-gray-400">(optional)</span></h2>
                    <p className="mt-0.5 text-sm text-gray-500">For general health reference only.</p>
                  </div>
                </div>
                {isEditing ? (
                  <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="height_cm" className="mb-1.5 block text-xs font-semibold text-gray-700">Height (cm)</label>
                <input
                  id="height_cm"
                  type="number"
                  name="height_cm"
                  value={formData.height_cm}
                  onChange={handleChange}
                  placeholder="e.g. 165"
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-gray-400 focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
                />
                  </div>
                  <div>
                    <label htmlFor="weight_kg" className="mb-1.5 block text-xs font-semibold text-gray-700">Weight (kg)</label>
                <input
                  id="weight_kg"
                  type="number"
                  name="weight_kg"
                  value={formData.weight_kg}
                  onChange={handleChange}
                  placeholder="e.g. 60"
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-gray-400 focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
                />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={computeBmi}
                  className="mt-4 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:border-orange-200 hover:bg-orange-50 hover:text-orange-700 focus:outline-none focus:ring-4 focus:ring-orange-100"
                >
                  Compute BMI
                </button>

                {bmi && (
                  <div className="mt-4 rounded-xl border border-orange-100 bg-orange-50/80 px-4 py-3 text-sm">
                    <p className="font-semibold text-gray-900">BMI: {bmi} — {getBmiLabel(parseFloat(bmi))}</p>
                    <p className="mt-1 text-xs text-gray-500">Advisory only — will not disqualify any course.</p>
                  </div>
                )}
                  </>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl bg-gray-50 px-4 py-3">
                      <p className="text-xs text-gray-400">Height</p>
                      <p className="mt-1 text-sm font-semibold text-gray-800">{formData.height_cm ? `${formData.height_cm} cm` : 'Not provided'}</p>
                    </div>
                    <div className="rounded-xl bg-gray-50 px-4 py-3">
                      <p className="text-xs text-gray-400">Weight</p>
                      <p className="mt-1 text-sm font-semibold text-gray-800">{formData.weight_kg ? `${formData.weight_kg} kg` : 'Not provided'}</p>
                    </div>
                    <div className="rounded-xl bg-orange-50/70 px-4 py-3">
                      <p className="text-xs text-orange-500">BMI</p>
                      <p className="mt-1 text-sm font-semibold text-gray-800">{profileBmi ? `${profileBmi} — ${getBmiLabel(Number(profileBmi))}` : 'Not available'}</p>
                    </div>
                  </div>
                )}
              </div>
              <aside className="rounded-2xl border border-violet-100 bg-violet-50/60 p-4 sm:p-5">
                <div className="flex items-center gap-2 text-violet-700"><IconInfoCircle size={18} stroke={1.8} /><h3 className="text-sm font-semibold">Why is this optional?</h3></div>
                <p className="mt-2 text-xs leading-relaxed text-gray-600">BMI is only a general indicator and does not affect your course recommendations.</p>
              </aside>
            </div>
          </section>

          {/* Personal Factors */}
          <section className="rounded-2xl border border-white/80 bg-white/85 p-5 shadow-[0_8px_30px_rgba(15,23,42,0.05)] backdrop-blur-md sm:p-7">
            <div className="mb-5">
            <h2 className="max-w-2xl text-base font-semibold leading-snug text-gray-950 sm:text-lg">
              Is there anything LearnMatch should consider when recommending courses?
            </h2>
            <p className="mt-1.5 text-sm text-gray-500">{isEditing ? 'Select all that apply.' : 'Saved considerations for your recommendations.'}</p>
            </div>

            {isEditing ? (
            <div className="grid gap-3 md:grid-cols-2">
              {personalFactors.map((factor) => {
                const FactorIcon = factor.icon
                const selected = formData[factor.name]
                return (
                <div
                  key={factor.name}
                  className={`relative min-h-24 rounded-2xl border transition focus-within:ring-4 focus-within:ring-orange-100 ${selected ? 'border-orange-300 bg-orange-50/70 shadow-sm' : 'border-gray-200 bg-white hover:border-orange-200 hover:bg-orange-50/30'}`}
                >
                  <label className="flex min-h-24 cursor-pointer items-start gap-3 p-4">
                    <input
                      type="checkbox"
                      name={factor.name}
                      checked={selected}
                      onChange={(e) => requestFactorChange({
                        kind: 'factor',
                        name: factor.name,
                        value: e.target.checked,
                      })}
                      className="sr-only"
                    />
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${factor.iconClass}`}><FactorIcon size={18} stroke={1.8} /></span>
                    <span className="pr-6 text-sm font-medium leading-relaxed text-gray-700">{factor.label}</span>
                    <span className={`absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full border transition ${selected ? 'border-orange-500 bg-orange-500 text-white' : 'border-gray-300 bg-white text-transparent'}`}><IconCheck size={13} stroke={2.5} /></span>
                  </label>
                  <button
                    type="button"
                    data-factor-tooltip
                    aria-label={`More information about: ${factor.label}`}
                    aria-expanded={openFactorTooltip === factor.name}
                    onPointerEnter={() => setOpenFactorTooltip(factor.name)}
                    onPointerLeave={() => {
                      if (pinnedFactorTooltip !== factor.name) setOpenFactorTooltip(null)
                    }}
                    onFocus={() => setOpenFactorTooltip(factor.name)}
                    onBlur={() => {
                      if (pinnedFactorTooltip !== factor.name) setOpenFactorTooltip(null)
                    }}
                    onClick={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      const shouldPin = pinnedFactorTooltip !== factor.name
                      setPinnedFactorTooltip(shouldPin ? factor.name : null)
                      setOpenFactorTooltip(shouldPin ? factor.name : null)
                    }}
                    className="absolute bottom-2.5 right-2.5 z-10 rounded-full p-1 text-gray-300 transition hover:bg-orange-50 hover:text-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
                  >
                    <IconInfoCircle size={15} stroke={1.7} />
                    <span className={`pointer-events-none absolute bottom-7 right-0 z-20 w-[min(16rem,calc(100vw-3rem))] rounded-xl bg-gray-900 p-3 text-left text-xs font-normal leading-relaxed text-white shadow-lg transition-opacity ${openFactorTooltip === factor.name ? 'opacity-100' : 'opacity-0'}`}>
                      {factor.meaning}
                    </span>
                  </button>
                </div>
                )
              })}

              {/* Others */}
              <div className={`group relative rounded-2xl border p-4 transition focus-within:ring-4 focus-within:ring-orange-100 ${othersSelected ? 'border-orange-300 bg-orange-50/60 shadow-sm' : 'border-gray-200 bg-white hover:border-orange-200 hover:bg-orange-50/30'}`}>
                <label className="flex cursor-pointer items-start gap-3 pr-6">
                  <input
                    type="checkbox"
                    checked={othersSelected}
                    onChange={(e) => requestFactorChange({ kind: 'others-toggle', checked: e.target.checked })}
                    className="sr-only"
                  />
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600"><IconMessageCircle size={18} stroke={1.8} /></span>
                  <span className="pt-2 text-sm font-medium text-gray-700">Something else I’d like LearnMatch to consider:</span>
                  <span className={`absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full border transition ${othersSelected ? 'border-orange-500 bg-orange-500 text-white' : 'border-gray-300 bg-white text-transparent'}`}>
                    <IconCheck size={13} stroke={2.5} />
                  </span>
                </label>
                {othersSelected && (
                  <div className="mt-4">
                    <input
                      type="text"
                      name="factor_others"
                      value={formData.factor_others}
                      onChange={(e) => requestFactorChange({
                        kind: 'factor',
                        name: 'factor_others',
                        value: e.target.value,
                      })}
                      placeholder="Please specify..."
                      maxLength={500}
                      className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-gray-400 focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
                    />
                    <div className="mt-1.5 flex flex-col gap-1 text-xs text-gray-400 sm:flex-row sm:justify-between">
                      <p>You may describe more than one situation in the same paragraph.</p>
                      <p className="shrink-0 text-right">{formData.factor_others.length}/500 characters</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {selectedFactors.map((factor) => {
                  const FactorIcon = factor.icon
                  return (
                    <div key={factor.name} className="flex min-h-20 items-center gap-3 rounded-2xl border border-orange-100 bg-orange-50/50 p-4">
                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${factor.iconClass}`}><FactorIcon size={18} stroke={1.8} /></span>
                      <span className="text-sm font-medium leading-relaxed text-gray-700">{factor.label}</span>
                    </div>
                  )
                })}
                {formData.factor_others && (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600"><IconMessageCircle size={18} stroke={1.8} /></span>
                      <span className="text-sm font-medium text-gray-700">Something else I’d like LearnMatch to consider:</span>
                    </div>
                    <p className="mt-3 rounded-xl bg-white px-3 py-2.5 text-sm leading-relaxed text-gray-600">{formData.factor_others}</p>
                  </div>
                )}
                {selectedFactors.length === 0 && !formData.factor_others && (
                  <p className="md:col-span-2 rounded-2xl bg-gray-50 px-4 py-5 text-sm text-gray-500">No Personal Factors selected.</p>
                )}
              </div>
            )}

            <p className="mt-5 border-t border-gray-100 pt-4 text-xs leading-relaxed text-gray-400">
              This helps LearnMatch suggest courses that are realistic and accessible for your situation. Your information is kept private.
            </p>
          </section>

          {isEditing && (
            <div className="flex flex-col-reverse justify-end gap-3 pt-1 sm:flex-row">
              {hasExistingProfile && (
                <button
                  type="button"
                  onClick={cancelEditing}
                  className="inline-flex w-full items-center justify-center rounded-xl border border-gray-200 bg-white px-6 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 focus:outline-none focus:ring-4 focus:ring-gray-100 sm:w-auto"
                >
                  Cancel
                </button>
              )}
              <button type="submit" className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-6 py-3 text-sm font-semibold text-white shadow-sm shadow-orange-200 transition hover:-translate-y-0.5 hover:bg-orange-600 hover:shadow-md focus:outline-none focus:ring-4 focus:ring-orange-200 sm:w-auto">
                {hasExistingProfile ? 'Save Changes' : 'Save Profile'} <IconArrowRight size={17} stroke={2} />
              </button>
            </div>
          )}
        </form>
      </main>

      {showFactorWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/35 px-4 py-8 backdrop-blur-sm" role="presentation">
          <div role="dialog" aria-modal="true" aria-labelledby="factor-warning-title" className="w-full max-w-md rounded-2xl border border-white/80 bg-white p-6 shadow-2xl sm:p-7">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-50 text-orange-600"><IconInfoCircle size={22} stroke={1.8} /></div>
            <h2 id="factor-warning-title" className="mt-4 text-lg font-bold text-gray-950">Update Personal Factors?</h2>
            <p className="mt-2 text-sm leading-relaxed text-gray-600">
              Changes to your Personal Factors will not update your existing course recommendations. If your situation has changed, you can retake the assessment to generate new recommendations.
            </p>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  setPendingFactorChange(null)
                  setShowFactorWarning(false)
                }}
                className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={continueFactorEditing}
                className="rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-600 focus:outline-none focus:ring-4 focus:ring-orange-100"
              >
                Continue Editing
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Profile
