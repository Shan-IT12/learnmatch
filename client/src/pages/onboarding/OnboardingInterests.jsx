import SkeletonContent from '../../components/SkeletonContent'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import OnboardingLayout from '../../components/OnboardingLayout'
import interestGroups, {
  isInterestStateComplete,
  MAX_INTEREST_SELECTIONS,
  NO_INTERESTS_LABEL,
  restoreInterestState,
  timestampInterestSelection,
  toggleNoInterests,
  updateInterestActivity,
} from '../../data/interestList'
import { FieldError, RequiredMark } from '../../components/FormValidation'
import { scrollToFirstInvalidField } from '../../utils/formValidation'
import SuccessConfirmation from '../../components/SuccessConfirmation'
import { waitForSuccessConfirmation } from '../../utils/successConfirmation'
import {
  ASSESSMENT_SESSION_KEYS,
  markAssessmentStepComplete,
  readAssessmentSession,
  writeAssessmentSession,
  assessmentHeaders,
  restoreInterestAttempt,
  saveActiveAttemptDraft,
} from '../../utils/assessmentSession'

function OnboardingInterests() {
  const navigate = useNavigate()

  const [interestState, setInterestState] = useState(() => restoreInterestState(readAssessmentSession(
    typeof sessionStorage === 'undefined' ? null : sessionStorage,
    ASSESSMENT_SESSION_KEYS.interests,
    { selected: [] }
  ), null))
  const { selected, noInterests } = interestState
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [selectionMessage, setSelectionMessage] = useState('')
  const [attemptLoaded, setAttemptLoaded] = useState(false)
  const [restoreFailed, setRestoreFailed] = useState(false)
  const [saveConfirmed, setSaveConfirmed] = useState(false)

  useEffect(() => {
    const storage = typeof sessionStorage === 'undefined' ? null : sessionStorage
    restoreInterestAttempt(import.meta.env.VITE_API_URL, localStorage.getItem('token'), storage)
      .then((attempt) => {
        const local = readAssessmentSession(storage, ASSESSMENT_SESSION_KEYS.interests, {})
        setInterestState(restoreInterestState(local, attempt?.interests))
        setAttemptLoaded(true)
      })
      .catch(() => {
        setRestoreFailed(true)
        setError('Could not restore your saved assessment progress. Please refresh.')
      })
  }, [])

  useEffect(() => {
    writeAssessmentSession(
      typeof sessionStorage === 'undefined' ? null : sessionStorage,
      ASSESSMENT_SESSION_KEYS.interests,
      interestState
    )
  }, [interestState])

  const isComplete = isInterestStateComplete(interestState)

  const saveSelection = (result) => {
    const nextState = timestampInterestSelection(result, interestState)
    setInterestState(nextState)
    writeAssessmentSession(sessionStorage, ASSESSMENT_SESSION_KEYS.interests, nextState)
    // Start saving before Back/step navigation can unmount this screen.
    saveActiveAttemptDraft(import.meta.env.VITE_API_URL, localStorage.getItem('token'), sessionStorage, { interests_json: nextState })
      .catch(() => setError('Your latest answers are saved on this device, but autosave failed. Use Next to retry saving before leaving.'))
    if (isInterestStateComplete(result)) setError('')
  }

  const toggleInterest = (name) => {
    const result = updateInterestActivity(interestState, name)
    setSelectionMessage(
      result.maxReached ? `You can select up to ${MAX_INTEREST_SELECTIONS} interests.` : ''
    )
    saveSelection(result)
  }

  const toggleNone = () => {
    const result = toggleNoInterests(interestState)
    saveSelection(result)
    setSelectionMessage('')
  }

 const handleNext = async () => {
  if (!attemptLoaded || submitting) return
  if (!isComplete) {
    setError('Select at least one activity or check No interests or hobbies.')
    scrollToFirstInvalidField(['interests'])
    return
  }
  setSubmitting(true)
  setError('')
  const token = localStorage.getItem('token')

  try {
    await saveActiveAttemptDraft(import.meta.env.VITE_API_URL, token, sessionStorage, { interests_json: interestState })
    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/interests`, {
      method: 'POST',
      headers: assessmentHeaders(sessionStorage, {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      }),
      body: JSON.stringify({ interests: interestState }),
    })
    const data = await response.json()

    if (!response.ok) {
      setError(data.message || 'Something went wrong saving your interests.')
      setSubmitting(false)
      return
    }

    markAssessmentStepComplete(
      typeof sessionStorage === 'undefined' ? null : sessionStorage,
      2
    )
    setSaveConfirmed(true)
    await waitForSuccessConfirmation()
    navigate('/onboarding/skills')
  } catch (requestError) {
    setError(requestError.message || 'Cannot connect to server. Please try again.')
    setSubmitting(false)
  }
}

  if (saveConfirmed) {
    return <OnboardingLayout currentStep={2} isComplete={false} showFooterNavigation={false}><div className="flex min-h-80 items-center justify-center"><SuccessConfirmation message="Interests Saved" /></div></OnboardingLayout>
  }

  return (
    <OnboardingLayout
      currentStep={2}
      isComplete={attemptLoaded && isComplete && !submitting}
      stickyChrome
      onNext={handleNext}
      nextLabel={submitting ? 'Saving...' : 'Next'}
      navigationStatus={(
        <div role="status" className="text-xs leading-tight">
          <p className="text-gray-500">
            {selected.length} / {MAX_INTEREST_SELECTIONS} activities selected
          </p>
          {selectionMessage && (
            <p className="mt-1 text-amber-700">
              {selectionMessage}
            </p>
          )}
        </div>
      )}
    >
      <SkeletonContent loading={!attemptLoaded && !restoreFailed} label="Loading your interests..."><div className="max-w-3xl mx-auto px-5 sm:px-8 pt-8 sm:pt-12 pb-16">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between mb-8">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-orange-50 px-3 py-1.5 text-xs font-semibold text-orange-700 mb-3">
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
              Tell us what you enjoy
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 mb-2">Interests & Hobbies <RequiredMark /></h2>
            <p className="max-w-xl text-gray-500 text-sm leading-relaxed">
              Choose at least one activity that fits you, or check No interests or hobbies. You can select up to 10 activities. You do not need to select activities in every category.
            </p>
          </div>
          <div className="w-full rounded-2xl border border-orange-100 bg-orange-50/70 px-4 py-3 sm:w-44 sm:shrink-0">
            <div className="mb-2 flex items-center justify-between text-xs font-semibold">
              <span className="text-orange-800">Your picks</span>
              <span className="text-orange-600">{selected.length} / {MAX_INTEREST_SELECTIONS}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-orange-100">
              <div
                className="h-full rounded-full bg-orange-500 transition-all duration-300"
                style={{ width: `${(selected.length / MAX_INTEREST_SELECTIONS) * 100}%` }}
              />
            </div>
          </div>
        </div>

        <div data-validation-field="interests" aria-invalid={error ? 'true' : undefined} aria-describedby={error ? 'interests-error' : undefined} className="space-y-5 mb-10">
          <label className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm font-medium text-gray-900">
            <input
              type="checkbox"
              checked={noInterests}
              onChange={toggleNone}
              disabled={!attemptLoaded || submitting}
              className="h-5 w-5 accent-orange-500"
            />
            {NO_INTERESTS_LABEL}
          </label>
          {interestGroups.map((group, groupIndex) => (
            <section key={group.group} aria-labelledby={`interest-category-${groupIndex}`} className="rounded-3xl border border-gray-100 bg-white p-4 sm:p-6 shadow-[0_16px_40px_-34px_rgba(15,23,42,0.5)]">
              <div className="mb-4 flex items-center gap-3">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${
                  groupIndex % 3 === 0
                    ? 'bg-orange-100 text-orange-700'
                    : groupIndex % 3 === 1
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-emerald-100 text-emerald-700'
                }`}>
                  {String(groupIndex + 1).padStart(2, '0')}
                </span>
                <div>
                  <h3 id={`interest-category-${groupIndex}`} className="text-sm font-bold text-gray-900">{group.group}</h3>
                  <p className="text-xs text-gray-400">Choose any that feel like you</p>
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-2.5">
                {group.items.map((item) => {
                  const isChecked = selected.includes(item.name)
                  return (
                    <button
                      key={item.name}
                      type="button"
                      disabled={!attemptLoaded || submitting || noInterests}
                      onClick={() => toggleInterest(item.name)}
                      aria-pressed={isChecked}
                      className={`group flex min-h-12 items-center gap-3 text-left px-3.5 py-3 rounded-2xl border text-sm font-medium transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
                        isChecked
                          ? 'bg-orange-500 text-white border-orange-500 shadow-md shadow-orange-100 -translate-y-px'
                          : 'bg-gray-50/70 text-gray-700 border-gray-200 hover:border-orange-300 hover:bg-orange-50/50 hover:text-orange-800'
                      }`}
                    >
                      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border transition ${
                        isChecked
                          ? 'border-white/60 bg-white text-orange-600'
                          : 'border-gray-300 bg-white text-transparent group-hover:border-orange-300'
                      }`}>
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </span>
                      <span className="min-w-0 leading-snug">{item.name}</span>
                    </button>
                  )
                })}

              </div>
            </section>
          ))}
          <FieldError id="interests-error">{error}</FieldError>
        </div>

      </div></SkeletonContent>
    </OnboardingLayout>
  )
}

export default OnboardingInterests
