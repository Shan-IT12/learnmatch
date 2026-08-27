import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import OnboardingLayout from '../../components/OnboardingLayout'
import { mbtiQuestions, likertScale } from '../../data/mbtiQuestions'

function OnboardingPersonality() {
  const navigate = useNavigate()

  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  const currentQuestion = mbtiQuestions[currentIndex]
  const selectedRating = answers[currentQuestion.id]
  const isLastQuestion = currentIndex === mbtiQuestions.length - 1
  const answeredCount = Object.keys(answers).length

  const handleSelect = (rating) => {
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: rating }))
  }

  const handleNext = () => {
    if (currentIndex < mbtiQuestions.length - 1) {
      setCurrentIndex(currentIndex + 1)
    }
  }

  const handleBack = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
    }
  }

  const handleSubmit = async () => {
    if (Object.keys(answers).length < mbtiQuestions.length) {
      setError('Please answer all questions before submitting.')
      return
    }

    setSubmitting(true)
    setError('')
    const token = localStorage.getItem('token')

    const formattedAnswers = mbtiQuestions.map((q) => ({
      dimension: q.dimension,
      pole: q.pole,
      rating: answers[q.id],
    }))

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/mbti`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ answers: formattedAnswers }),
      })
      const data = await response.json()

      if (!response.ok) {
        setError(data.message || 'Something went wrong submitting the assessment.')
        setSubmitting(false)
        return
      }

      setResult(data)
    } catch {
      setError('Cannot connect to server. Please try again.')
      setSubmitting(false)
    }
  }

  const handleContinue = () => {
    navigate('/dashboard/summary')
  }

  // ---------- Results screen ----------
  if (result) {
    const dimensionLabels = {
      EI: ['Extraversion (E)', 'Introversion (I)'],
      NS: ['Intuition (N)', 'Sensing (S)'],
      TF: ['Thinking (T)', 'Feeling (F)'],
      JP: ['Judging (J)', 'Perceiving (P)'],
    }

    return (
      <OnboardingLayout currentStep={4} isComplete={true}>
        <div className="max-w-xl mx-auto px-6 py-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Your Personality Type</h2>
          <p className="text-gray-500 text-sm mb-1">Based on your answers, you're likely:</p>
          <p className="text-4xl font-bold text-orange-500 mb-8">{result.mbtiType}</p>

          <div className="space-y-5 mb-10">
            {Object.entries(dimensionLabels).map(([key, [firstLabel, secondLabel]]) => {
              const percent = Math.round(result.scores[key])
              return (
                <div key={key}>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="font-medium text-gray-800">{firstLabel}</span>
                    <span className="font-medium text-gray-800">{secondLabel}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2.5 relative">
                    <div
                      className="bg-orange-500 h-2.5 rounded-full transition-all"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>{percent}%</span>
                    <span>{100 - percent}%</span>
                  </div>
                </div>
              )
            })}
          </div>

          <button
            type="button"
            onClick={handleContinue}
            className="w-full bg-orange-500 text-white py-3 rounded-xl font-medium hover:bg-orange-600 transition text-sm"
          >
            See Your Recommendations →
          </button>
        </div>
      </OnboardingLayout>
    )
  }

  // ---------- Question screen ----------
  return (
    <OnboardingLayout currentStep={4} isComplete={answeredCount === mbtiQuestions.length}>
      <div className="max-w-xl mx-auto px-6 py-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Personality Assessment</h2>
        <p className="text-gray-500 text-sm mb-6">
          Question {currentIndex + 1} of {mbtiQuestions.length} · Answer honestly — there are no
          right or wrong answers.
        </p>

        {/* Progress bar */}
        <div className="w-full bg-gray-100 rounded-full h-2 mb-8">
          <div
            className="bg-orange-500 h-2 rounded-full transition-all"
            style={{ width: `${((currentIndex + 1) / mbtiQuestions.length) * 100}%` }}
          />
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm mb-6">
            {error}
          </div>
        )}

        <p className="text-base font-medium text-gray-900 mb-6">{currentQuestion.text}</p>

        {/* Likert scale choices */}
        <div className="space-y-3 mb-8">
          {likertScale.map((choice) => (
            <button
              key={choice.value}
              type="button"
              onClick={() => handleSelect(choice.value)}
              className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition ${
                selectedRating === choice.value
                  ? 'bg-orange-500 text-white border-orange-500'
                  : 'bg-white text-gray-700 border-gray-200 hover:border-orange-300'
              }`}
            >
              <span className="font-medium mr-2">{choice.value}.</span>
              {choice.label}
            </button>
          ))}
        </div>

        {/* Navigation */}
        <div className="flex justify-between items-center">
          <button
            type="button"
            onClick={handleBack}
            disabled={currentIndex === 0}
            className="px-5 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed transition"
          >
            ← Back
          </button>

          {isLastQuestion ? (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || !selectedRating}
              className="px-6 py-2.5 rounded-xl text-sm font-medium bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50 transition"
            >
              {submitting ? 'Submitting...' : 'Submit Assessment'}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleNext}
              disabled={!selectedRating}
              className="px-6 py-2.5 rounded-xl text-sm font-medium bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50 transition"
            >
              Next →
            </button>
          )}
        </div>
      </div>
    </OnboardingLayout>
  )
}

export default OnboardingPersonality