export default function AssessmentQuestionNavigation({
  currentIndex,
  isLastQuestion,
  currentAnswered,
  allAnswered,
  submitting,
  finalLabel,
  onBack,
  onNext,
  onSubmit,
}) {
  const primaryDisabled = isLastQuestion
    ? !allAnswered || submitting
    : !currentAnswered

  return (
    <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
      {currentIndex > 0 ? (
        <button
          type="button"
          onClick={onBack}
          className="min-h-11 w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-600 transition hover:border-gray-300 hover:bg-gray-50 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 sm:w-auto sm:px-5"
        >
          Back to Previous Question
        </button>
      ) : <span aria-hidden="true" />}

      <button
        type="button"
        onClick={isLastQuestion ? onSubmit : onNext}
        disabled={primaryDisabled}
        className={`min-h-11 w-full rounded-xl px-5 py-2.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2 sm:w-auto sm:px-6 ${
          primaryDisabled
            ? 'cursor-not-allowed bg-gray-100 text-gray-400'
            : 'bg-orange-500 text-white shadow-sm hover:bg-orange-600'
        }`}
      >
        {isLastQuestion
          ? submitting ? 'Submitting...' : finalLabel
          : 'Next Question'}
      </button>
    </div>
  )
}
