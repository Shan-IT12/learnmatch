import { useState } from 'react'
import { useNavigate } from "react-router-dom";

const steps = [
    { label: 'Profile', path: '/onboarding/profile' },
    { label: 'Interest', path: '/onboarding/interests' },
    { label: 'Skills', path: '/onboarding/skills' },
    { label: 'Personality', path: '/onboarding/personality' },
];

function OnboardingLayout({ children, currentStep, isComplete }) {
  const navigate = useNavigate()
  const [showExitConfirm, setShowExitConfirm] = useState(false)

  const handleBack = () => {
    if (currentStep === 1) {
      navigate('/dashboard')
    } else {
      navigate(steps[currentStep - 2].path)
    }
  }

  const handleNext = () => {
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
    navigate('/dashboard')
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">

      {/* Exit confirmation modal */}
      {showExitConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-6">
          <div className="max-w-sm w-full bg-white rounded-2xl shadow-lg p-7 text-center">
            <h3 className="text-lg font-bold text-gray-900 mb-1">Leave this assessment?</h3>
            <p className="text-sm text-gray-500 mb-6">
              Your progress on this step hasn't been saved yet. If you leave now, you'll need to redo it.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowExitConfirm(false)}
                className="flex-1 bg-gray-100 text-gray-700 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-200 transition"
              >
                Stay
              </button>
              <button
                onClick={confirmExit}
                className="flex-1 bg-orange-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-orange-600 transition"
              >
                Leave anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top bar */}
      <div className="flex justify-between items-center px-8 py-5 border-b border-gray-100">
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
      <div className="px-8 py-6 border-b border-gray-100">
        <div className="max-w-xl mx-auto">
          <div className="flex items-center justify-between relative">

            {/* Connecting line behind dots */}
            <div className="absolute top-3 left-0 right-0 h-px bg-gray-200 z-0" />
            <div
              className="absolute top-3 left-0 h-px bg-orange-500 z-0 transition-all duration-500"
              style={{
                width: `${((currentStep - 1) / (steps.length - 1)) * 100}%`
              }}
            />

            {steps.map((step, index) => {
              const stepNumber = index + 1
              const isCompleted = stepNumber < currentStep
              const isCurrent = stepNumber === currentStep

              return (
                <div key={step.label} className="flex flex-col items-center z-10">
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
                  <span className={`text-xs mt-2 font-medium ${
                    isCurrent ? 'text-orange-500' : isCompleted ? 'text-gray-500' : 'text-gray-300'
                  }`}>
                    {step.label}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

 {/* Step content */}
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>

      {/* Bottom navigation */}
      <div className="border-t border-gray-100 px-8 py-4 flex justify-between items-center bg-white">
        <button
          onClick={handleBack}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition px-4 py-2 rounded-lg hover:bg-gray-50"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>

        <button
          onClick={handleNext}
          disabled={!isComplete}
          className={`flex items-center gap-2 text-sm px-6 py-2.5 rounded-lg font-medium transition ${
            isComplete
              ? 'bg-orange-500 text-white hover:bg-orange-600'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
        >
          {currentStep === 4 ? 'See Results' : 'Next'}
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

    </div>
  )
}

export default OnboardingLayout