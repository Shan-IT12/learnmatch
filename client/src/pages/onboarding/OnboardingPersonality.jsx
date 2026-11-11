import { readStudentQuestionPosition, saveStudentQuestionPosition } from '../../utils/studentPosition'
import SkeletonContent from '../../components/SkeletonContent'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import OnboardingLayout from '../../components/OnboardingLayout'
import useAssessmentDraftSave from '../../hooks/useAssessmentDraftSave'
import AssessmentQuestionNavigation from '../../components/AssessmentQuestionNavigation'
import useAssessmentQuestionFocus from '../../hooks/useAssessmentQuestionFocus'
import PersonalityResult from '../../components/PersonalityResult'
import { getResponseChoices, mbtiQuestions } from '../../data/mbtiQuestions'
import { FieldError, RequiredMark } from '../../components/FormValidation'
import { scrollToFirstInvalidField } from '../../utils/formValidation'
import SuccessConfirmation from '../../components/SuccessConfirmation'
import { waitForSuccessConfirmation } from '../../utils/successConfirmation'
import {
  ASSESSMENT_SESSION_KEYS,
  getAssessmentAttemptId,
  assessmentHeaders,
  finishAssessmentAttempt,
  boundedQuestionIndex,
  firstUnansweredQuestionIndex,
  markAssessmentStepComplete,
  readAssessmentSession,
  writeAssessmentSession,
  readActiveAttempt,
} from '../../utils/assessmentSession'

function OnboardingPersonality() {
  const navigate = useNavigate()

  const storage = typeof sessionStorage === 'undefined' ? null : sessionStorage
  const saveProgress = useAssessmentDraftSave(storage, ASSESSMENT_SESSION_KEYS.personality)
  const saveDraft = saveProgress.save
  const initialSession = readAssessmentSession(storage, ASSESSMENT_SESSION_KEYS.personality, {})
  const [currentIndex, setCurrentIndex] = useState(() => boundedQuestionIndex(initialSession.currentIndex, mbtiQuestions.length))
  const questionRef = useAssessmentQuestionFocus(currentIndex)
  const [answers, setAnswers] = useState(() => initialSession.answers || {})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [questionError, setQuestionError] = useState('')
  const [checkingResult, setCheckingResult] = useState(true)
  const [resultCheckFailed, setResultCheckFailed] = useState(false)
  const [attemptLoaded, setAttemptLoaded] = useState(false)
  const [submitConfirmed, setSubmitConfirmed] = useState(false)

  useEffect(() => {
    let active = true
    readActiveAttempt(import.meta.env.VITE_API_URL, localStorage.getItem('token'), storage)
      .then((attempt) => {
        if (!active) return
        if (!attempt) { setAnswers({}); return }
        const local = readAssessmentSession(storage, ASSESSMENT_SESSION_KEYS.personality, {})
        const savedIndex = readStudentQuestionPosition(localStorage, localStorage.getItem('userId'), 'personality', attempt.attemptId)
        const resumeIndex = Number.isInteger(local.currentIndex) ? local.currentIndex : savedIndex
        const restored = (local.pending ? local.answers : attempt.personalityAnswers) || {}
        setAnswers(restored)
        const firstMissing = firstUnansweredQuestionIndex(mbtiQuestions, restored, question => question.id)
        setCurrentIndex(Number.isInteger(resumeIndex) ? boundedQuestionIndex(resumeIndex, mbtiQuestions.length)
          : firstMissing < 0 ? mbtiQuestions.length - 1 : firstMissing)
        if (local.pending) saveDraft({ personality_answers: restored }).catch(() => {})
      })
      .catch(() => { if (active) { setError('Could not restore your saved Personality progress. Please refresh.'); setResultCheckFailed(true) } })
      .finally(() => { if (active) setAttemptLoaded(true) })
    return () => { active = false }
  }, [storage, saveDraft])

  const currentQuestion = mbtiQuestions[currentIndex]
  const selectedRating = answers[currentQuestion.id]
  const isLastQuestion = currentIndex === mbtiQuestions.length - 1
  const answeredCount = Object.keys(answers).length
  const responseChoices = getResponseChoices(currentQuestion)

  useEffect(() => {
    if (!attemptLoaded || submitting || result) return
    saveStudentQuestionPosition(localStorage, localStorage.getItem('userId'), 'personality', getAssessmentAttemptId(storage), currentIndex)
    writeAssessmentSession(storage, ASSESSMENT_SESSION_KEYS.personality, {
      answers,
      currentIndex,
    })
  }, [answers, attemptLoaded, currentIndex, storage, submitting, result])

  useEffect(() => {
    if (!attemptLoaded) return
    let active = true
    const token = localStorage.getItem('token')
    fetch(`${import.meta.env.VITE_API_URL}/api/mbti`, {
      headers: assessmentHeaders(storage, { Authorization: `Bearer ${token}` }),
    }).then(response => {
      if (!response.ok) throw new Error('Could not check saved personality results.')
      return response.json()
    }).then(savedResult => {
      if (active && savedResult.mbtiType) {
        markAssessmentStepComplete(storage, 4)
        setResult(savedResult)
      }
    }).catch(() => { if (active) setResultCheckFailed(true) })
      .finally(() => { if (active) setCheckingResult(false) })
    return () => { active = false }
  }, [attemptLoaded, storage])

  const handleSelect = (rating) => {
    const nextAnswers = { ...answers, [currentQuestion.id]: rating }
    setAnswers(nextAnswers)
    writeAssessmentSession(storage, ASSESSMENT_SESSION_KEYS.personality, { answers: nextAnswers, currentIndex })
    saveDraft({ personality_answers: nextAnswers }).catch(() => {})
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
      // Final submission drains older
      // writes and persist this complete snapshot before server validation.
      await saveProgress.flush()
      await saveDraft({ personality_answers: answers })
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
      setSubmitConfirmed(true)
      await waitForSuccessConfirmation()
      setSubmitConfirmed(false)
      setResult(data)
    } catch {
      setError('Cannot connect to server. Please try again.')
      setSubmitting(false)
    }
  }

  const handleContinue = () => {
    navigate('/results')
  }

  if (submitConfirmed) {
    return <OnboardingLayout currentStep={4} isComplete={false} showFooterNavigation={false}><div className="flex min-h-80 items-center justify-center"><SuccessConfirmation message="Assessment Completed" /></div></OnboardingLayout>
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
      <OnboardingLayout currentStep={4} stickyChrome isComplete={true} onNext={handleContinue} nextLabel="Next" navigationStatus={<p className="text-xs text-gray-500">Next: Recommendations</p>}>
        <PersonalityResult result={result} />
      </OnboardingLayout>
    )
  }

  // ---------- Question screen ----------
  return (
    <OnboardingLayout currentStep={4} stickyChrome isComplete={false} onNext={handleContinue} nextLabel="Next" navigationBusy={submitting}
      saveProgress={saveProgress} navigationStatus={<p className="text-xs leading-5 text-gray-500">Complete and submit Personality to continue.</p>}>
      <SkeletonContent loading={checkingResult || !attemptLoaded} label="Loading personality result..."><div className="max-w-3xl mx-auto px-5 sm:px-8 py-8 sm:py-12">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-6">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-orange-50 px-3 py-1.5 text-xs font-semibold text-orange-700 mb-3">
              <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
              Personal reflection
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 mb-2">Personality Assessment</h1>
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

        <div ref={questionRef} tabIndex={-1} role="group" aria-labelledby="personality-question-text" data-validation-field="personalityQuestion" className="assessment-question rounded-3xl border border-orange-100 bg-gradient-to-br from-orange-50 via-white to-amber-50 p-5 sm:p-8 shadow-[0_18px_45px_-32px_rgba(234,88,12,0.55)] mb-7" aria-invalid={questionError ? 'true' : undefined} aria-describedby={questionError ? 'personality-question-error' : undefined}>
          <div key={currentQuestion.id} className="assessment-question-content">
          <div className="flex items-start gap-4 mb-7 sm:mb-9">
            <div className="hidden sm:flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-orange-500 shadow-sm ring-1 ring-orange-100">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 4v-4z" />
              </svg>
            </div>
            <p id="personality-question-text" className="text-lg sm:text-xl font-semibold leading-relaxed text-gray-900">{currentQuestion.text} <RequiredMark /></p>
          </div>
          <FieldError id="personality-question-error">{questionError}</FieldError>

          {/* Likert scale choices */}
          <div className="sm:px-2">
            <div className="hidden sm:flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-gray-600 mb-3 px-1">
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
                  className={`assessment-choice group flex min-h-12 items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm font-medium leading-snug sm:min-h-28 sm:flex-col sm:justify-center sm:px-2 sm:text-center sm:text-xs ${
                    selectedRating === choice.value
                      ? 'border-orange-500 bg-orange-500 text-white shadow-lg shadow-orange-200 -translate-y-0.5'
                      : 'border-white bg-white/90 text-gray-600 shadow-sm hover:-translate-y-0.5 hover:border-orange-200 hover:text-orange-700 hover:shadow-md'
                  }`}
                >
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition sm:h-9 sm:w-9 ${
                    selectedRating === choice.value
                      ? 'border-white bg-white text-orange-600'
                      : index === 2
                        ? 'border-gray-300 bg-gray-50 text-gray-600 group-hover:border-orange-300'
                        : 'border-orange-200 bg-orange-50 text-orange-500 group-hover:border-orange-400'
                  }`}>
                    <span className={`assessment-choice-dot rounded-full bg-current ${selectedRating === choice.value ? 'h-2.5 w-2.5' : 'h-1.5 w-1.5'}`} />
                  </span>
                  <span>{choice.label}</span>
                </button>
              ))}
            </div>
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
      </div></SkeletonContent>
    </OnboardingLayout>
  )
}

export default OnboardingPersonality
