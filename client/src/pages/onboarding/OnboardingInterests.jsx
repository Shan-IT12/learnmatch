import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import OnboardingLayout from '../../components/OnboardingLayout'
import interestGroups, {
  MAX_INTEREST_SELECTIONS,
  MIN_INTEREST_SELECTIONS,
  updateInterestSelection,
} from '../../data/interestList'

function OnboardingInterests() {
  const navigate = useNavigate()

  const [selected, setSelected] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [selectionMessage, setSelectionMessage] = useState('')

  const toggleInterest = (name) => {
    const result = updateInterestSelection(selected, name)
    setSelectionMessage(
      result.maxReached ? `You can select up to ${MAX_INTEREST_SELECTIONS} interests.` : ''
    )
    setSelected(result.selected)
  }

 const handleNext = async () => {
  setSubmitting(true)
  setError('')
  const token = localStorage.getItem('token')

  try {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/interests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ interests: selected }),
    })
    const data = await response.json()

    if (!response.ok) {
      setError(data.message || 'Something went wrong saving your interests.')
      setSubmitting(false)
      return
    }

    navigate('/onboarding/skills')
  } catch {
    setError('Cannot connect to server. Please try again.')
    setSubmitting(false)
  }
}

  return (
    <OnboardingLayout
      currentStep={2}
      isComplete={selected.length >= MIN_INTEREST_SELECTIONS && !submitting}
      stickyChrome
      onNext={handleNext}
      nextLabel={submitting ? 'Saving...' : 'Next'}
      navigationStatus={(
        <div role="status" className="text-xs leading-tight">
          <p className="text-gray-500">
            {selected.length} / {MAX_INTEREST_SELECTIONS} selected
          </p>
          {selectionMessage && (
            <p className="mt-1 text-amber-700">
              {selectionMessage}
            </p>
          )}
        </div>
      )}
    >
      <div className="max-w-xl mx-auto px-6 pt-12 pb-16">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Interests & Hobbies</h2>
        <p className="text-gray-500 text-sm mb-8">
          Choose at least 3 interests that best describe you. Select up to 10.
        </p>

        {error && (
          <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm mb-6">
            {error}
          </div>
        )}

        <div className="space-y-8 mb-10">
          {interestGroups.map((group) => (
            <div key={group.group}>
              <h3 className="text-sm font-semibold text-gray-800 mb-3">{group.group}</h3>
              <div className="grid grid-cols-2 gap-2">
                {group.items.map((item) => {
                  const isChecked = selected.includes(item.name)
                  return (
                    <button
                      key={item.name}
                      type="button"
                      onClick={() => toggleInterest(item.name)}
                      className={`text-left px-4 py-2.5 rounded-xl border text-sm transition ${
                        isChecked
                          ? 'bg-orange-500 text-white border-orange-500'
                          : 'bg-white text-gray-700 border-gray-200 hover:border-orange-300'
                      }`}
                    >
                      {item.name}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

      </div>
    </OnboardingLayout>
  )
}

export default OnboardingInterests
