import OnboardingLayout from '../../components/OnboardingLayout'

function OnboardingPersonality() {
  return (
    <OnboardingLayout currentStep={4} isComplete={true}>
      <div className="max-w-xl mx-auto px-6 py-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Personality Assessment</h2>
        <p className="text-gray-500 text-sm mb-8">
          Answer honestly — there are no right or wrong answers.
        </p>
        <p className="text-xs text-gray-400">
          MBTI questions pending adviser decision.
        </p>
      </div>
    </OnboardingLayout>
  )
}

export default OnboardingPersonality