import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import OnboardingLayout from '../../components/OnboardingLayout'

function OnboardingProfile() {
  const navigate = useNavigate()
  const token = localStorage.getItem('token')
  const [fullName, setFullName] = useState('')

  useEffect(() => {
    if (!token) navigate('/login')
  }, [token, navigate])

  return (
    <OnboardingLayout currentStep={1} isComplete={fullName.trim().length > 0}>
      <div className="max-w-xl mx-auto px-6 py-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Let's set up your profile</h2>
        <p className="text-gray-500 text-sm mb-8">
          This helps us personalize your recommendations.
        </p>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Enter your full name"
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
        </div>

        <p className="text-xs text-gray-400 mt-8">
          You'll fill in more details like height, weight, and personal factors on this page.
          This is a placeholder — full profile form coming next.
        </p>
      </div>
    </OnboardingLayout>
  )
}

export default OnboardingProfile