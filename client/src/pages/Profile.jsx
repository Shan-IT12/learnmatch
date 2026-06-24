import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

function Profile() {
  const navigate = useNavigate()
  const userId = localStorage.getItem('userId')
  const token = localStorage.getItem('token')

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

    // Load existing profile if it exists
    const fetchProfile = async () => {
      try {
        const response = await fetch(`http://localhost:5000/api/profile?userId=${userId}`)
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
      const response = await fetch('http://localhost:5000/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, userId }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.message)
        return
      }

      setMessage(data.message)
    } catch {
      setError('Cannot connect to server. Please try again.')
    }
  }

  const personalFactors = [
    { name: 'factor_physical', label: 'Physical / Mobility Condition' },
    { name: 'factor_health', label: 'Health Condition' },
    { name: 'factor_financial', label: 'Financial Constraint' },
    { name: 'factor_family', label: 'Family Obligation' },
    { name: 'factor_distance', label: 'Distance / Commute' },
    { name: 'factor_working_student', label: 'Working Student' },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow px-8 py-4 flex justify-between items-center">
        <h1 className="text-xl font-bold">
          Learn<span className="text-orange-600">Match</span>
        </h1>
        <button
          onClick={() => navigate('/dashboard')}
          className="text-sm text-gray-600 hover:text-orange-600 transition"
        >
          Back to Dashboard
        </button>
      </nav>

      <div className="max-w-2xl mx-auto py-12 px-4">
        <h2 className="text-2xl font-bold mb-8">Personal Information</h2>

        {message && (
          <div className="bg-green-100 text-green-700 px-4 py-2 rounded-lg mb-4 text-sm">
            {message}
          </div>
        )}

        {error && (
          <div className="bg-red-100 text-red-700 px-4 py-2 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Name */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="full_name"
              value={formData.full_name}
              onChange={handleChange}
              placeholder="Enter your name"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-400"
              required
            />
          </div>

          {/* BMI Section */}
          <div>
            <label className="block text-sm font-medium mb-1">
              BMI <span className="text-gray-400 font-normal">(optional — for holistic profiling)</span>
            </label>
            <div className="flex gap-4 mb-2">
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-1">Height (cm)</label>
                <input
                  type="number"
                  name="height_cm"
                  value={formData.height_cm}
                  onChange={handleChange}
                  placeholder="e.g. 165"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-1">Weight (kg)</label>
                <input
                  type="number"
                  name="weight_kg"
                  value={formData.weight_kg}
                  onChange={handleChange}
                  placeholder="e.g. 60"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>
            </div>
            <button
              type="button"
              onClick={computeBmi}
              className="border border-gray-300 text-sm px-4 py-1.5 rounded-lg hover:bg-gray-100 transition"
            >
              Compute BMI
            </button>

            {bmi && (
              <div className="mt-2 bg-gray-100 rounded-lg px-4 py-3 text-sm">
                <p className="font-medium">BMI: {bmi} — {getBmiLabel(parseFloat(bmi))}</p>
                <p className="text-gray-500 text-xs mt-1">Advisory only — will not disqualify any course.</p>
              </div>
            )}
          </div>

          {/* Personal Factors */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Personal Factors <span className="text-gray-400 font-normal">(optional — influences your recommendations)</span>
            </label>
            <div className="border border-gray-200 rounded-lg p-4 space-y-3">
              {personalFactors.map((factor) => (
                <label key={factor.name} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    name={factor.name}
                    checked={formData[factor.name]}
                    onChange={handleChange}
                    className="w-4 h-4 accent-orange-500"
                  />
                  <span className="text-sm">{factor.label}</span>
                </label>
              ))}

              {/* Others */}
              <div>
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
                  <span className="text-sm">Others, please specify</span>
                </label>
                {formData.factor_others !== undefined && (
                  <input
                    type="text"
                    name="factor_others"
                    value={formData.factor_others}
                    onChange={handleChange}
                    placeholder="Please specify..."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                )}
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              This helps LearnMatch suggest courses that are realistic and accessible for your situation. Your information is kept private.
            </p>
          </div>

          <button
            type="submit"
            className="bg-orange-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-orange-700 transition"
          >
            Save Profile
          </button>
        </form>
      </div>
    </div>
  )
}

export default Profile