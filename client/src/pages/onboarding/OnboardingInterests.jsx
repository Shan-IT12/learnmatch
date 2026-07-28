import OnboardingLayout from '../../components/OnboardingLayout'

function OnboardingInterests() {
  return (
    <OnboardingLayout currentStep={2} isComplete={true}>
      <div className="max-w-xl mx-auto px-6 py-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">What are your interests?</h2>
        <p className="text-gray-500 text-sm mb-8">
          Select all that apply — this helps us match you with the right course cluster.
        </p>
        <p className="text-xs text-gray-400">
          Interest checkbox list coming soon — waiting for group finalization.
        </p>
      </div>
    </OnboardingLayout>
  )
}

export default OnboardingInterests