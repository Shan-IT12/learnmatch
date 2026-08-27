import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import OnboardingLayout from '../../components/OnboardingLayout'

function OnboardingProfile() {
  const navigate = useNavigate()
  const token = localStorage.getItem('token')
  const userId = localStorage.getItem('userId')
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    if (!token) {
      navigate('/login')
      return
    }

    const checkProfile = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/profile?userId=${userId}`)
        const data = await res.json()

        if (data.profile && data.profile.full_name) {
          navigate('/onboarding/interests', { replace: true })
        } else {
          setChecking(false)
        }
      } catch {
        setChecking(false)
      }
    }

    checkProfile()
  }, [token, userId, navigate])

  if (checking) {
    return (
      <OnboardingLayout currentStep={1} isComplete={false}>
        <div className="max-w-xl mx-auto px-6 py-12 text-center text-gray-500 text-sm">
          Checking your profile...
        </div>
      </OnboardingLayout>
    )
  }

  return (
    <OnboardingLayout currentStep={1} isComplete={false}>
      <div className="max-w-xl mx-auto px-6 py-12 text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Let's set up your profile first</h2>
        <p className="text-gray-500 text-sm mb-8">
          We need a few basic details before starting your assessment.
        </p>
        <button
          type="button"
          onClick={() => navigate('/profile', { state: { fromOnboarding: true } })}
          className="bg-orange-500 text-white px-6 py-3 rounded-xl font-medium hover:bg-orange-600 transition text-sm"
        >
          Set Up Profile →
        </button>
      </div>
    </OnboardingLayout>
  )
}

export default OnboardingProfile