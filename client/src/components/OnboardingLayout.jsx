import { useState } from 'react'
import { useNavigate } from "react-router-dom";
import { readCompletedAssessmentSteps } from '../utils/assessmentSession'
import useActiveCollegePhase from '../hooks/useActiveCollegePhase'

const steps = [
    { label: 'Personal Factors', path: '/onboarding/profile' },
    { label: 'Interests', path: '/onboarding/interests' },
    { label: 'Academic Skills', path: '/onboarding/skills' },
    { label: 'Personality', path: '/onboarding/personality' },
];

function OnboardingLayout({
  children,
  currentStep,
  isComplete,
  stickyChrome = false,
  navigationStatus = null,
  nextLabel,
  onNext,
  showFooterNavigation = true,
}) {
  const navigate = useNavigate()
  const hasActiveCollegePhase = useActiveCollegePhase()
  const [showExitConfirm, setShowExitConfirm] = useState(false)
  const completedSteps = readCompletedAssessmentSteps(
    typeof sessionStorage === 'undefined' ? null : sessionStorage
  )
  const furthestReachedStep = Math.max(currentStep, ...completedSteps)

  const handleBack = () => {
    if (currentStep === 1) {
      if (hasActiveCollegePhase === null) return
      navigate(hasActiveCollegePhase ? '/college' : '/dashboard/summary')
    } else {
      navigate(steps[currentStep - 2].path)
    }
  }

  const handleNext = () => {
    if (onNext) {
      onNext()
      return
    }

    if (currentStep === 4) {
      navigate('/results')
    } else {
      navigate(steps[currentStep].path)
    }
  }

  const handleLogoClick = () => {
    setShowExitConfirm(true)
  }

  const confirmExit = () => {
    if (hasActiveCollegePhase === null) return
    navigate(hasActiveCollegePhase ? '/college' : '/dashboard/summary')
  }

  return (
    <div className={`${stickyChrome ? 'h-dvh overflow-hidden' : 'min-h-screen'} bg-white flex flex-col`}>

      {/* Exit confirmation modal */}
      {showExitConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 sm:px-6 overflow-y-auto">
          <div className="max-w-sm w-full max-h-[calc(100dvh-2rem)] overflow-y-auto bg-white rounded-2xl shadow-lg p-5 sm:p-7 text-center">
            <h3 className="text-lg font-bold text-gray-900 mb-1">Leave this assessment?</h3>
            <p className="text-sm text-gray-500 mb-6">
              Your answers are saved for this assessment session, so you can return without starting over.
            </p>
            <div className="flex flex-col-reverse gap-3 sm:flex-row">
              <button
                onClick={() => setShowExitConfirm(false)}
                className="flex-1 bg-gray-100 text-gray-700 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-200 transition"
              >
                Stay
              </button>
              <button
                onClick={confirmExit}
                disabled={hasActiveCollegePhase === null}
                className="flex-1 bg-orange-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-orange-600 transition disabled:cursor-wait disabled:bg-gray-200 disabled:text-gray-500"
              >
                {hasActiveCollegePhase === null ? 'Checking destination...' : 'Cancel Assessment'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={stickyChrome ? 'sticky top-0 z-40 shrink-0 bg-white' : ''}>
      {/* Top bar */}
      <div className="flex justify-between items-center px-4 sm:px-8 py-5 border-b border-gray-100">
        <button
          onClick={handleLogoClick}
          className="text-lg font-bold tracking-tight text-gray-900 hover:opacity-80 transition"
        >
          Learn<span className="text-orange-500">Match</span>
        </button>
        <span className="text-sm text-gray-400">
          Step {currentStep} of {steps.length}
        </span>
      </div>

      {/* Progress bar */}
      <div className="px-4 sm:px-8 py-6 border-b border-gray-100">
        <div className="max-w-xl mx-auto">
          <div className="flex items-center justify-between relative">

            {/* Connecting line behind dots */}
            <div className="absolute top-3 left-0 right-0 h-px bg-gray-200 z-0" />
            <div
              className="absolute top-3 left-0 h-px bg-orange-500 z-0 transition-all duration-500"
              style={{
                width: `${((furthestReachedStep - 1) / (steps.length - 1)) * 100}%`
              }}
            />

            {steps.map((step, index) => {
              const stepNumber = index + 1
              const isCurrent = stepNumber === currentStep
              const isCompleted = !isCurrent && (
                stepNumber < currentStep || completedSteps.includes(stepNumber)
              )

              return (
                <button
                  key={step.label}
                  type="button"
                  onClick={() => isCompleted && navigate(step.path)}
                  disabled={!isCompleted}
                  aria-current={isCurrent ? 'step' : undefined}
                  aria-label={`${step.label}: ${isCompleted ? 'completed' : isCurrent ? 'current step' : 'not yet available'}`}
                  className={`z-10 flex flex-col items-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-4 ${isCompleted ? 'cursor-pointer' : 'cursor-default'}`}
                >
                  {/* Dot */}
                  <div
                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                      isCompleted
                        ? 'bg-orange-500 border-orange-500'
                        : isCurrent
                        ? 'bg-white border-orange-500'
                        : 'bg-white border-gray-300'
                    }`}
                  >
                    {isCompleted && (
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                    {isCurrent && (
                      <div className="w-2 h-2 rounded-full bg-orange-500" />
                    )}
                  </div>
                  {/* Label */}
                  <span className={`text-[10px] sm:text-xs mt-2 font-medium ${
                    isCurrent ? 'text-orange-500' : isCompleted ? 'text-gray-500' : 'text-gray-300'
                  }`}>
                    {step.label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
      </div>

 {/* Step content */}
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>

      {/* Bottom navigation */}
      {showFooterNavigation && (
      <div className={`${stickyChrome ? 'sticky bottom-0 z-40 shrink-0 shadow-[0_-4px_12px_rgba(0,0,0,0.04)]' : ''} border-t border-gray-100 px-3 sm:px-8 py-3 sm:py-4 grid grid-cols-[auto_minmax(0,1fr)_auto] gap-1 sm:gap-4 items-center bg-white`}>
        <button
          onClick={handleBack}
          disabled={currentStep === 1 && hasActiveCollegePhase === null}
          className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm text-gray-500 hover:text-gray-900 transition px-2 sm:px-4 py-2 rounded-lg hover:bg-gray-50 disabled:cursor-wait disabled:opacity-50"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>

        <div className="min-w-0 text-center">
          {navigationStatus}
        </div>

        <button
          onClick={handleNext}
          disabled={!isComplete}
          className={`flex items-center gap-1 sm:gap-2 whitespace-nowrap text-xs sm:text-sm px-3 sm:px-6 py-2.5 rounded-lg font-medium transition ${
            isComplete
              ? 'bg-orange-500 text-white hover:bg-orange-600'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
        >
          {nextLabel || (currentStep === 4 ? 'See Results' : 'Next')}
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
      )}

    </div>
  )
}

export default OnboardingLayout
