import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { IconInfoCircle, IconArrowLeft } from '@tabler/icons-react'

const personalFactors = [
  {
    name: 'factor_physical',
    label: 'Physical / Mobility Condition',
    meaning: 'Physical limitations, disabilities, or conditions that affect mobility, stamina, or your ability to do certain hands-on or physically demanding tasks.',
  },
  {
    name: 'factor_health',
    label: 'Health Condition',
    meaning: 'Chronic illness, mental health conditions, or medical needs that may require ongoing management, treatment, or accommodation.',
  },
  {
    name: 'factor_financial',
    label: 'Financial Constraint',
    meaning: 'Limited financial resources for tuition, school materials, transportation, or other costs related to pursuing this course.',
  },
  {
    name: 'factor_family',
    label: 'Family Obligation',
    meaning: 'Responsibilities like caring for siblings, parents, or other family members that may affect your available time or flexibility.',
  },
  {
    name: 'factor_distance',
    label: 'Distance / Commute',
    meaning: 'Living far from schools that offer your preferred course, which may affect your daily commute or ability to enroll locally.',
  },
  {
    name: 'factor_working_student',
    label: 'Working Student',
    meaning: 'Needing to work, hold a job, or take on income-generating responsibilities alongside school, which may affect your available time and schedule flexibility.',
  },
]

function Profile() {
  const navigate = useNavigate()
  const userId = localStorage.getItem('userId')
  const token = localStorage.getItem('token')
  const location = useLocation()
  const assessmentComplete = location.state?.assessmentComplete
  const [showRetakePrompt, setShowRetakePrompt] = useState(false)

  const [formData, setFormData] = useState({
    full_name: '',
    height_cm: '',
    weight_kg: '',
    factor_physical: false,
    factor_health: false,
    factor_financial: false,
    factor_family: false,
    factor_distance: false,
    factor_working_student: false,
    factor_others: '',
  })

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
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/profile?userId=${userId}`)
        const data = await response.json()

        if (data.profile) {
          setFormData({
            full_name: data.profile.full_name || '',
            height_cm: data.profile.height_cm || '',
            weight_kg: data.profile.weight_kg || '',
            factor_physical: !!data.profile.factor_physical,
            factor_health: !!data.profile.factor_health,
            factor_financial: !!data.profile.factor_financial,
            factor_family: !!data.profile.factor_family,
            factor_distance: !!data.profile.factor_distance,
            factor_working_student: !!data.profile.factor_working_student,
            factor_others: data.profile.factor_others || '',
          })
        }
      } catch {
        console.error('Could not load profile')
      }
    }

    fetchProfile()
  }, [navigate, token, userId])

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value,
    })
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

  const handleSubmit = async (e) => {
    e.preventDefault()
    setMessage('')
    setError('')

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, userId }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.message)
        return
      }

      if (assessmentComplete) {
        // User already finished their assessment — don't auto-navigate away.
        // Show a recommendation to retake instead, since their info just changed.
        setMessage(data.message)
        setShowRetakePrompt(true)
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

  return (
    <div className="min-h-screen bg-white">
      <nav className="bg-white border-b border-gray-100 px-14 py-[18px] flex justify-between items-center">
        <button
          onClick={() => navigate('/dashboard')}
          className="text-lg font-bold text-gray-900 hover:opacity-80 transition"
        >
          Learn<span className="text-orange-500">Match</span>
        </button>
        <button
          onClick={() => navigate('/dashboard')}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition"
        >
          <IconArrowLeft size={16} stroke={2} /> Back to Dashboard
        </button>
      </nav>

      <div className="max-w-[900px] mx-auto px-14 py-11">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Personal Information</h1>
        <p className="text-sm text-gray-500 mb-8">
          This helps LearnMatch personalize your course recommendations.
        </p>

        {message && (
          <div className="bg-green-50 text-green-700 px-4 py-3 rounded-xl text-sm mb-6">
            {message}
          </div>
        )}

        {error && (
          <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm mb-6">
            {error}
          </div>
        )}

        {/* Retake-assessment recommendation, shown only after editing a
            profile that already has a completed assessment */}
        {showRetakePrompt && (
          <div className="bg-orange-50 border border-orange-100 rounded-2xl px-5 py-4 mb-6">
            <p className="text-sm font-semibold text-gray-900 mb-1">
              Your profile has changed
            </p>
            <p className="text-xs text-gray-500 mb-4">
              Since you've already completed your assessment, we recommend retaking it so your
              course recommendations reflect your updated information.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                className="flex-1 bg-white border border-gray-200 text-gray-700 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition"
              >
                Not now
              </button>
              <button
                type="button"
                onClick={() => navigate('/onboarding/profile')}
                className="flex-1 bg-orange-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-orange-600 transition"
              >
                Retake Assessment
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Name */}
          <div
            className="rounded-[20px] px-7 py-6 border border-gray-100 shadow-sm"
          >
            <label className="block text-sm font-semibold text-gray-900 mb-3">
              Name <span className="text-orange-500">*</span>
            </label>
            <input
              type="text"
              name="full_name"
              value={formData.full_name}
              onChange={handleChange}
              placeholder="Enter your full name"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              required
            />
          </div>

          {/* BMI Section */}
          <div className="rounded-[20px] px-7 py-6 border border-gray-100 shadow-sm">
            <label className="block text-sm font-semibold text-gray-900 mb-1">
              BMI <span className="text-gray-400 font-normal text-xs">(optional — for holistic profiling)</span>
            </label>
            <div className="flex gap-4 mb-3 mt-3">
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-1.5">Height (cm)</label>
                <input
                  type="number"
                  name="height_cm"
                  value={formData.height_cm}
                  onChange={handleChange}
                  placeholder="e.g. 165"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-1.5">Weight (kg)</label>
                <input
                  type="number"
                  name="weight_kg"
                  value={formData.weight_kg}
                  onChange={handleChange}
                  placeholder="e.g. 60"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>
            </div>
            <button
              type="button"
              onClick={computeBmi}
              className="border border-gray-200 text-sm font-medium px-4 py-2 rounded-xl hover:bg-gray-50 transition"
            >
              Compute BMI
            </button>

            {bmi && (
              <div className="mt-4 bg-orange-50 rounded-xl px-4 py-3 text-sm">
                <p className="font-semibold text-gray-900">BMI: {bmi} — {getBmiLabel(parseFloat(bmi))}</p>
                <p className="text-gray-500 text-xs mt-1">Advisory only — will not disqualify any course.</p>
              </div>
            )}
          </div>

          {/* Personal Factors */}
          <div className="rounded-[20px] px-7 py-6 border border-gray-100 shadow-sm">
            <label className="block text-sm font-semibold text-gray-900 mb-1">
              Personal Factors <span className="text-gray-400 font-normal text-xs">(optional — influences your recommendations)</span>
            </label>
            <p className="text-xs text-gray-400 mb-4">
              Hover the <IconInfoCircle size={12} stroke={2} className="inline -mt-0.5" /> icon on any factor to see what it covers.
            </p>

            <div className="space-y-1">
              {personalFactors.map((factor) => (
                <label
                  key={factor.name}
                  className="flex items-center gap-3 cursor-pointer px-3 py-2.5 rounded-xl hover:bg-gray-50 transition"
                >
                  <input
                    type="checkbox"
                    name={factor.name}
                    checked={formData[factor.name]}
                    onChange={handleChange}
                    className="w-4 h-4 accent-orange-500 shrink-0"
                  />
                  <span className="text-sm text-gray-700">{factor.label}</span>

                  {/* Info icon + hover tooltip */}
                  <span className="relative group ml-auto shrink-0">
                    <IconInfoCircle size={16} stroke={1.75} className="text-gray-300 hover:text-orange-500 transition" />
                    <span className="pointer-events-none absolute right-0 top-6 z-10 w-64 rounded-xl bg-gray-900 text-white text-xs leading-relaxed p-3 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
                      {factor.meaning}
                    </span>
                  </span>
                </label>
              ))}

              {/* Others */}
              <div className="px-3 py-2.5">
                <label className="flex items-center gap-3 cursor-pointer mb-2">
                  <input
                    type="checkbox"
                    checked={formData.factor_others !== ''}
                    onChange={(e) => {
                      if (!e.target.checked) {
                        setFormData({ ...formData, factor_others: '' })
                      }
                    }}
                    className="w-4 h-4 accent-orange-500"
                  />
                  <span className="text-sm text-gray-700">Others, please specify</span>
                </label>
                {formData.factor_others !== undefined && (
                  <input
                    type="text"
                    name="factor_others"
                    value={formData.factor_others}
                    onChange={handleChange}
                    placeholder="Please specify..."
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                )}
              </div>
            </div>

            <p className="text-xs text-gray-400 mt-4">
              This helps LearnMatch suggest courses that are realistic and accessible for your situation. Your information is kept private.
            </p>
          </div>

          <button
            type="submit"
            className="bg-orange-500 text-white px-6 py-3 rounded-xl font-medium hover:bg-orange-600 hover:-translate-y-0.5 hover:shadow-lg transition-all duration-200 text-sm"
          >
            Save Profile
          </button>
        </form>
      </div>
    </div>
  )
}

export default Profile