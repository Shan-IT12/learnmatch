import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import OnboardingLayout from '../../components/OnboardingLayout'
import AssessmentQuestionNavigation from '../../components/AssessmentQuestionNavigation'
import PersonalityResult from '../../components/PersonalityResult'
import { getResponseChoices, mbtiQuestions } from '../../data/mbtiQuestions'
import { FieldError, RequiredMark } from '../../components/FormValidation'
import { scrollToFirstInvalidField } from '../../utils/formValidation'
import {
  ASSESSMENT_SESSION_KEYS,
  assessmentHeaders,
  finishAssessmentAttempt,
  boundedQuestionIndex,
  firstUnansweredQuestionIndex,
  markAssessmentStepComplete,
  readAssessmentSession,
  writeAssessmentSession,
  readActiveAttempt,
  saveActiveAttemptDraft,
} from '../../utils/assessmentSession'

function OnboardingPersonality() {
  const navigate = useNavigate()

  const storage = typeof sessionStorage === 'undefined' ? null : sessionStorage
  const initialSession = readAssessmentSession(storage, ASSESSMENT_SESSION_KEYS.personality, {})
  const [currentIndex, setCurrentIndex] = useState(() => boundedQuestionIndex(initialSession.currentIndex, mbtiQuestions.length))
  const [answers, setAnswers] = useState(() => initialSession.answers || {})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [questionError, setQuestionError] = useState('')
  const [checkingResult, setCheckingResult] = useState(true)
  const [resultCheckFailed, setResultCheckFailed] = useState(false)
  const [attemptLoaded, setAttemptLoaded] = useState(false)

  useEffect(() => {
    readActiveAttempt(import.meta.env.VITE_API_URL, localStorage.getItem('token'), storage)
      .then((attempt) => {
        if (attempt?.personalityAnswers && Object.keys(attempt.personalityAnswers).length > 0) setAnswers(attempt.personalityAnswers)
      })
      .catch(() => setError('Could not restore your saved Personality progress. Please refresh.'))
      .finally(() => setAttemptLoaded(true))
  }, [storage])

  const currentQuestion = mbtiQuestions[currentIndex]
  const selectedRating = answers[currentQuestion.id]
  const isLastQuestion = currentIndex === mbtiQuestions.length - 1
  const answeredCount = Object.keys(answers).length
  const responseChoices = getResponseChoices(currentQuestion)

  useEffect(() => {
    writeAssessmentSession(storage, ASSESSMENT_SESSION_KEYS.personality, {
      answers,
      currentIndex,
    })
    if (!attemptLoaded) return
    const timer = setTimeout(() => {
      saveActiveAttemptDraft(import.meta.env.VITE_API_URL, localStorage.getItem('token'), storage, { personality_answers: answers })
        .catch(() => console.warn('Personality draft autosave will retry on the next change.'))
    }, 250)
    return () => clearTimeout(timer)
  }, [answers, attemptLoaded, currentIndex, storage])

  useEffect(() => {
    const token = localStorage.getItem('token')
    fetch(`${import.meta.env.VITE_API_URL}/api/mbti`, {
      headers: assessmentHeaders(storage, { Authorization: `Bearer ${token}` }),
    })
      .then((response) => {
        if (!response.ok) throw new Error('Could not check saved personality results.')
        return response.json()
      })
      .then((savedResult) => {
        if (savedResult.mbtiType) {
          markAssessmentStepComplete(storage, 4)
          setResult(savedResult)
        }
      })
      .catch(() => setResultCheckFailed(true))
      .finally(() => setCheckingResult(false))
  }, [storage])

  const handleSelect = (rating) => {
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: rating }))
    setQuestionError('')
  }

  const handleNext = () => {
    if (!answers[currentQuestion.id]) {
      setQuestionError('Please select a response.')
      scrollToFirstInvalidField(['personalityQuestion'])
      return
    }
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
      const firstMissingIndex = firstUnansweredQuestionIndex(mbtiQuestions, answers, (question) => question.id)
      setCurrentIndex(firstMissingIndex)
      setQuestionError('Please select a response.')
      scrollToFirstInvalidField(['personalityQuestion'])
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
        headers: assessmentHeaders(storage, {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        }),
        body: JSON.stringify({ answers: formattedAnswers }),
      })
      const data = await response.json()

      if (!response.ok) {
        setError(data.message || 'Something went wrong submitting the assessment.')
        setSubmitting(false)
        return
      }

      markAssessmentStepComplete(storage, 4)
      finishAssessmentAttempt(storage)
      setResult(data)
    } catch {
      setError('Cannot connect to server. Please try again.')
      setSubmitting(false)
    }
  }

  const handleContinue = () => {
    navigate('/results')
  }

  if (checkingResult) {
    return (
      <OnboardingLayout currentStep={4} isComplete={false} showFooterNavigation={false}>
        <div className="mx-auto max-w-xl px-6 py-12 text-center text-sm text-gray-500">Loading personality result...</div>
      </OnboardingLayout>
    )
  }

  if (resultCheckFailed) {
    return (
      <OnboardingLayout currentStep={4} isComplete={false} showFooterNavigation={false}>
        <div className="mx-auto max-w-xl px-6 py-12 text-center text-sm text-red-600">Could not confirm your saved personality result. Please refresh.</div>
      </OnboardingLayout>
    )
  }

  // ---------- Results screen ----------
  if (result) {
    return (
      <OnboardingLayout currentStep={4} isComplete={true} showFooterNavigation={false}>
        <PersonalityResult result={result} onContinue={handleContinue} />
      </OnboardingLayout>
    )
  }

  // ---------- Question screen ----------
  return (
    <OnboardingLayout currentStep={4} isComplete={answeredCount === mbtiQuestions.length} showFooterNavigation={false}>
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
            Question <span className="text-orange-600">{currentIndex + 1}</span> of {mbtiQuestions.length}
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

        <div data-validation-field="personalityQuestion" className="rounded-3xl border border-orange-100 bg-gradient-to-br from-orange-50 via-white to-amber-50 p-5 sm:p-8 shadow-[0_18px_45px_-32px_rgba(234,88,12,0.55)] mb-7" aria-invalid={questionError ? 'true' : undefined} aria-describedby={questionError ? 'personality-question-error' : undefined}>
          <div className="flex items-start gap-4 mb-7 sm:mb-9">
            <div className="hidden sm:flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-orange-500 shadow-sm ring-1 ring-orange-100">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 4v-4z" />
              </svg>
            </div>
            <p className="text-lg sm:text-xl font-semibold leading-relaxed text-gray-900">{currentQuestion.text} <RequiredMark /></p>
          </div>
          <FieldError id="personality-question-error">{questionError}</FieldError>

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
                    <span className={selectedRating === choice.value ? 'h-2.5 w-2.5 rounded-full bg-current' : 'h-1.5 w-1.5 rounded-full bg-current'} />
                  </span>
                  <span>{choice.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <AssessmentQuestionNavigation
          currentIndex={currentIndex}
          isLastQuestion={isLastQuestion}
          currentAnswered={Boolean(selectedRating)}
          allAnswered={answeredCount === mbtiQuestions.length}
          submitting={submitting}
          finalLabel="View Results"
          onBack={handleBack}
          onNext={handleNext}
          onSubmit={handleSubmit}
        />
      </div>
    </OnboardingLayout>
  )
}

export default OnboardingPersonality
