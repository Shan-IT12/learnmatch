import OnboardingLayout from '../../components/OnboardingLayout'

function OnboardingSkills() {
  return (
    <OnboardingLayout currentStep={3} isComplete={true}>
      <div className="max-w-xl mx-auto px-6 py-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Academic Skills Quiz</h2>
        <p className="text-gray-500 text-sm mb-8">
          30 questions across 6 skill domains. Take your time.
        </p>
        <p className="text-xs text-gray-400">
          Quiz questions being seeded — coming next session.
        </p>
      </div>
    </OnboardingLayout>
  )
}

export default OnboardingSkills