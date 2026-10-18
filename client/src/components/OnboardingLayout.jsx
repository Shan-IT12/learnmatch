import { IconCheck } from '@tabler/icons-react'
import ActionConfirmationModal from './ActionConfirmationModal'
import HeaderBrand from '../components/HeaderBrand'
import { useState } from 'react'
import { useNavigate } from "react-router-dom";
import { readCompletedAssessmentSteps } from '../utils/assessmentSession'
import useActiveCollegePhase from '../hooks/useActiveCollegePhase'
import { getAssessmentCancelDestination } from '../utils/assessmentReturnDestination'

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
  const cancelDestination = getAssessmentCancelDestination(hasActiveCollegePhase)

  const handleBack = () => {
    if (currentStep === 1) {
      if (hasActiveCollegePhase === null) return
      navigate(cancelDestination.path)
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
    navigate(cancelDestination.path)
  }

  return (
    <div className={`${stickyChrome ? 'h-dvh overflow-hidden' : 'min-h-screen'} bg-white flex flex-col`}>

      <ActionConfirmationModal
        action={showExitConfirm ? 'leaveAssessment' : null}
        onCancel={() => setShowExitConfirm(false)}
        onConfirm={confirmExit}
        confirmDisabled={hasActiveCollegePhase === null}
      />

      <div className={stickyChrome ? 'sticky top-0 z-40 shrink-0 bg-white' : ''}>
      {/* Top bar */}
      <div className="lm-site-header flex justify-between items-center px-4 sm:px-8 py-5 border-b border-gray-100">
        <button
          onClick={handleLogoClick}
          className="text-lg font-bold tracking-tight text-gray-900 hover:opacity-80 transition"
        >
          <HeaderBrand />
        </button>
        <span className="text-sm text-gray-400">
          Step {currentStep} of {steps.length}
        </span>
      </div>

      {/* Assessment progress */}
      <nav aria-label="Assessment progress" className="border-b border-gray-100 bg-gradient-to-b from-white to-gray-50/40 px-3 py-5 sm:px-8 sm:py-6">
        <div className="relative mx-auto max-w-3xl">
          <div aria-hidden="true" className="absolute left-[12.5%] right-[12.5%] top-5 h-0.5 overflow-hidden rounded-full bg-gray-200 sm:top-[22px]">
            <div className="h-full rounded-full bg-gradient-to-r from-orange-400 to-orange-500 transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${((furthestReachedStep - 1) / (steps.length - 1)) * 100}%` }} />
          </div>
          <ol className="relative grid grid-cols-4 gap-1 sm:gap-3">
            {steps.map((step, index) => {
              const stepNumber = index + 1
              const isCurrent = stepNumber === currentStep
              const isCompleted = !isCurrent && (stepNumber < currentStep || completedSteps.includes(stepNumber))
              return <li key={step.label} className="min-w-0">
                <button
                  type="button"
                  onClick={() => isCompleted && navigate(step.path)}
                  disabled={!isCompleted}
                  aria-current={isCurrent ? 'step' : undefined}
                  aria-label={`${step.label}: ${isCompleted ? 'completed, return to this step' : isCurrent ? 'current step' : 'not yet available'}`}
                  className={`group relative flex w-full flex-col items-center rounded-xl px-1 outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-4 ${isCompleted ? 'cursor-pointer' : 'cursor-default'}`}
                >
                  <span aria-hidden="true" className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border text-sm font-bold ring-4 transition duration-200 motion-reduce:transition-none sm:h-11 sm:w-11 sm:text-base ${isCompleted ? 'border-orange-500 bg-orange-500 text-white ring-white group-hover:border-orange-600 group-hover:bg-orange-600 group-hover:shadow-md group-hover:shadow-orange-200/60' : isCurrent ? 'border-orange-300 bg-orange-50 text-orange-700 ring-orange-100/70 shadow-sm shadow-orange-100' : 'border-gray-200 bg-gray-50 text-gray-400 ring-white'}`}>
                    {isCompleted ? <IconCheck size={20} stroke={2.6} /> : String(stepNumber).padStart(2, '0')}
                    {isCurrent && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-orange-500" />}
                  </span>
                  <span className={`mt-3 flex min-h-8 items-start justify-center text-center text-xs font-semibold leading-4 sm:min-h-5 sm:text-sm sm:leading-5 ${isCurrent ? 'text-orange-700' : isCompleted ? 'text-gray-800 group-hover:text-orange-600' : 'text-gray-500'}`}>{step.label}</span>
                  <span className={`mt-1 text-[10px] font-medium leading-4 sm:text-[11px] ${isCurrent ? 'rounded-full bg-orange-100 px-2 text-orange-700' : 'text-gray-400'}`}>{isCompleted ? 'Completed' : isCurrent ? 'In progress' : 'Upcoming'}</span>
                </button>
              </li>
            })}
          </ol>
        </div>
      </nav>
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
          className="lm-action disabled:cursor-wait disabled:opacity-50"
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
