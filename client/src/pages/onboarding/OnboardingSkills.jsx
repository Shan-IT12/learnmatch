import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import OnboardingLayout from '../../components/OnboardingLayout'

function OnboardingSkills() {
  const navigate = useNavigate()

  const [questions, setQuestions] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [results, setResults] = useState(null)

  // Fetch 30 questions once when the page loads
  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/api/quiz`)
      .then((res) => res.json())
      .then((data) => {
        setQuestions(data.questions || [])
        setLoading(false)
      })
      .catch(() => {
        setError('Could not load quiz questions. Please refresh.')
        setLoading(false)
      })
  }, [])

  const handleSelect = (questionId, choice) => {
    setAnswers((prev) => ({ ...prev, [questionId]: choice }))
  }

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1)
    }
  }

  const handleBack = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
    }
  }

  const handleSubmit = async () => {
  if (Object.keys(answers).length < questions.length) {
    setError('Please answer all questions before submitting.')
    return
  }

  setSubmitting(true)
  setError('')
  const token = localStorage.getItem('token')

  const formattedAnswers = Object.entries(answers).map(([questionId, selectedOption]) => ({
    question_id: Number(questionId),
    selected_option: selectedOption,
  }))

  try {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/quiz`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ answers: formattedAnswers }),
    })
    const data = await response.json()

    if (!response.ok) {
      setError(data.message || 'Something went wrong submitting the quiz.')
      setSubmitting(false)
      return
    }

    console.log('Quiz result:', data)
    setResults(data)
  } catch {
    setError('Cannot connect to server. Please try again.')
    setSubmitting(false)
  }
}
  const handleContinue = () => {
    navigate('/onboarding/personality')
  }

  if (results) {
    const domainNames = Object.keys(results.domainScores)

    return (
      <OnboardingLayout currentStep={3} isComplete={true}>
        <div className="max-w-xl mx-auto px-6 py-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Your Skills Quiz Results</h2>
          <p className="text-gray-500 text-sm mb-8">
            You got {results.totalCorrect} out of {results.totalQuestions} correct.
          </p>

          <div className="space-y-5 mb-10">
            {domainNames.map((domain) => {
              const { correct, total } = results.domainScores[domain]
              const percent = Math.round((correct / total) * 100)
              return (
                <div key={domain}>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="font-medium text-gray-800">{domain}</span>
                    <span className="text-gray-500">{correct}/{total}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2.5">
                    <div
                      className="bg-orange-500 h-2.5 rounded-full transition-all"
                      style={{ width: `${percent}%` }}
                    />
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
            Continue to Personality Assessment →
          </button>
        </div>
      </OnboardingLayout>
    )
  }

  if (loading) {
    return (
      <OnboardingLayout currentStep={3} isComplete={false}>
        <div className="max-w-xl mx-auto px-6 py-12 text-center text-gray-500 text-sm">
          Loading quiz questions...
        </div>
      </OnboardingLayout>
    )
  }

  if (questions.length === 0) {
    return (
      <OnboardingLayout currentStep={3} isComplete={false}>
        <div className="max-w-xl mx-auto px-6 py-12 text-center text-gray-500 text-sm">
          No quiz questions available right now.
        </div>
      </OnboardingLayout>
    )
  }

  const currentQuestion = questions[currentIndex]
  const selectedChoice = answers[currentQuestion.question_id]
  const isLastQuestion = currentIndex === questions.length - 1
  const answeredCount = Object.keys(answers).length

  const choiceLabels = [
    { key: 'A', text: currentQuestion.choice_a },
    { key: 'B', text: currentQuestion.choice_b },
    { key: 'C', text: currentQuestion.choice_c },
    { key: 'D', text: currentQuestion.choice_d },
  ]

  return (
    <OnboardingLayout currentStep={3} isComplete={answeredCount === questions.length}>
      <div className="max-w-xl mx-auto px-6 py-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Academic Skills Quiz</h2>
        <p className="text-gray-500 text-sm mb-6">
          Question {currentIndex + 1} of {questions.length} · {currentQuestion.dimension}
        </p>

        {/* Progress bar */}
        <div className="w-full bg-gray-100 rounded-full h-2 mb-8">
          <div
            className="bg-orange-500 h-2 rounded-full transition-all"
            style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
          />
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm mb-6">
            {error}
          </div>
        )}

        {/* Question figure, if this item has one */}
        {currentQuestion.image_url && (
          <img
            src={currentQuestion.image_url}
            alt="Question figure"
            className="mb-4 max-w-full border border-gray-100 rounded-xl"
          />
        )}

        <p className="text-base font-medium text-gray-900 mb-4">
          {currentQuestion.question_text}
        </p>

        {/* Answer choices */}
        <div className="space-y-3 mb-8">
          {choiceLabels.map((choice) => (
            <button
              key={choice.key}
              type="button"
              onClick={() => handleSelect(currentQuestion.question_id, choice.key)}
              className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition ${
                selectedChoice === choice.key
                  ? 'bg-orange-500 text-white border-orange-500'
                  : 'bg-white text-gray-700 border-gray-200 hover:border-orange-300'
              }`}
            >
              <span className="font-medium mr-2">{choice.key}.</span>
              {choice.text}
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
              disabled={submitting}
              className="px-6 py-2.5 rounded-xl text-sm font-medium bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50 transition"
            >
              {submitting ? 'Submitting...' : 'Submit Quiz'}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleNext}
              disabled={!selectedChoice}
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

export default OnboardingSkills