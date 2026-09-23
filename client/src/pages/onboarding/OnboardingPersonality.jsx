import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import OnboardingLayout from '../../components/OnboardingLayout'
import { getResponseChoices, mbtiQuestions } from '../../data/mbtiQuestions'

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
  const responseChoices = getResponseChoices(currentQuestion)

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
    navigate('/results')
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
            See Your Results →
          </button>
        </div>
      </OnboardingLayout>
    )
  }

  // ---------- Question screen ----------
  return (
    <OnboardingLayout currentStep={4} isComplete={answeredCount === mbtiQuestions.length}>
      <div className="max-w-3xl mx-auto px-5 sm:px-8 py-8 sm:py-12">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-6">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-orange-50 px-3 py-1.5 text-xs font-semibold text-orange-700 mb-3">
              <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
              Personal reflection
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 mb-2">Personality Assessment</h2>
            <p className="text-gray-500 text-sm">
              Choose the response that feels most natural to you. There are no right or wrong answers.
            </p>
          </div>
          <p className="shrink-0 text-sm font-semibold text-gray-500">
            <span className="text-orange-600">{currentIndex + 1}</span> / {mbtiQuestions.length}
          </p>
        </div>

        <div className="w-full bg-gray-100 rounded-full h-1.5 mb-7 overflow-hidden">
          <div
            className="bg-gradient-to-r from-orange-400 to-orange-600 h-full rounded-full transition-all duration-300"
            style={{ width: `${((currentIndex + 1) / mbtiQuestions.length) * 100}%` }}
          />
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm mb-6">
            {error}
          </div>
        )}

        <div className="rounded-3xl border border-orange-100 bg-gradient-to-br from-orange-50 via-white to-amber-50 p-5 sm:p-8 shadow-[0_18px_45px_-32px_rgba(234,88,12,0.55)] mb-7">
          <div className="flex items-start gap-4 mb-7 sm:mb-9">
            <div className="hidden sm:flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-orange-500 shadow-sm ring-1 ring-orange-100">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 4v-4z" />
              </svg>
            </div>
            <p className="text-lg sm:text-xl font-semibold leading-relaxed text-gray-900">{currentQuestion.text}</p>
          </div>

          {/* Likert scale choices */}
          <div className="sm:px-2">
            <div className="hidden sm:flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-3 px-1">
              <span>Disagree</span>
              <span>Agree</span>
            </div>
            <div className="grid gap-2.5 sm:grid-cols-5 sm:gap-3" role="group" aria-label="Choose how strongly you agree">
              {responseChoices.map((choice, index) => (
                <button
                  key={choice.value}
                  type="button"
                  onClick={() => handleSelect(choice.value)}
                  aria-pressed={selectedRating === choice.value}
                  className={`group flex min-h-12 items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm font-medium leading-snug transition-all sm:min-h-28 sm:flex-col sm:justify-center sm:px-2 sm:text-center sm:text-xs ${
                    selectedRating === choice.value
                      ? 'border-orange-500 bg-orange-500 text-white shadow-lg shadow-orange-200 -translate-y-0.5'
                      : 'border-white bg-white/90 text-gray-600 shadow-sm hover:-translate-y-0.5 hover:border-orange-200 hover:text-orange-700 hover:shadow-md'
                  }`}
                >
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition sm:h-9 sm:w-9 ${
                    selectedRating === choice.value
                      ? 'border-white bg-white text-orange-600'
                      : index === 2
                        ? 'border-gray-300 bg-gray-50 text-gray-400 group-hover:border-orange-300'
                        : 'border-orange-200 bg-orange-50 text-orange-500 group-hover:border-orange-400'
                  }`}>
                    {selectedRating === choice.value ? (
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                    )}
                  </span>
                  <span>{choice.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex justify-between items-center gap-3">
          <button
            type="button"
            onClick={handleBack}
            disabled={currentIndex === 0}
            className="px-3 sm:px-5 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:text-gray-900 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition"
          >
            ← Back
          </button>

          {isLastQuestion ? (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || !selectedRating}
              className="px-4 sm:px-6 py-3 rounded-xl text-sm font-medium bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50 transition shadow-sm shadow-orange-200"
            >
              {submitting ? 'Submitting...' : 'Submit Assessment'}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleNext}
              disabled={!selectedRating}
              className="px-5 sm:px-7 py-3 rounded-xl text-sm font-medium bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50 transition shadow-sm shadow-orange-200"
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
