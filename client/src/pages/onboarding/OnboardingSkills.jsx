import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import OnboardingLayout from '../../components/OnboardingLayout'

function getQuestionGuide(question) {
  const text = question.question_text
  const lower = text.toLowerCase()

  if (lower.includes('analogy')) {
    const analogy = text.replace(/choose the word that best completes the analogy:\s*/i, '').replace(/complete the analogy:\s*/i, '')
    return `An analogy compares two relationships. In “${analogy},” first describe how the first pair is connected, then choose the option that creates the same relationship for the second pair.`
  }
  if (lower.includes('closest in meaning')) {
    const word = text.match(/"([^"]+)"/)?.[1]
    return `This is asking for a synonym${word ? ` of “${word}”` : ''}—a word with the closest meaning, not merely a word associated with it. Compare each option by placing it in a simple sentence.`
  }
  if (lower.includes('what does') && lower.includes('mean')) {
    const word = text.match(/"([^"]+)"/)?.[1]
    return `Use the surrounding sentence to infer what ${word ? `“${word}”` : 'the highlighted word'} means. Notice the result or situation described after it, then choose the meaning that keeps the whole sentence logical.`
  }
  if (lower.includes('does not belong') || lower.includes('odd one out')) {
    return 'Compare all choices and find the rule shared by most of them—such as meaning, category, number pattern, or number of sides. The answer is the one that breaks that shared rule.'
  }
  if (lower.includes('number comes next') || lower.includes('number completes the pattern')) {
    const series = text.match(/(?:series\?|pattern\?|comes next\?)\s*([^?]+)$/i)?.[1]?.replace(/_+/g, 'blank').trim()
    return `Look at how each number changes into the next${series ? ` in ${series}` : ''}. Check the differences first, then check whether the same multiplication, division, or alternating rule repeats. Apply that rule to the last number without skipping a step.`
  }
  if (lower.includes('discount') && lower.includes('customer pay')) {
    return 'First find the discount amount by taking the stated percentage of the original price. Then subtract that discount from the original price to get the amount paid.'
  }
  if (lower.includes('discount percentage')) {
    return 'Find how many pesos were removed from the original price. Divide that decrease by the original price, then convert the result to a percentage.'
  }
  if (lower.includes('same speed') || lower.includes('same rate')) {
    return 'This is a direct proportion. Find the amount for one unit of time or one item first, then scale that unit rate to the quantity requested.'
  }
  if (lower.includes('recipe requires')) {
    return 'Keep the flour-to-servings ratio the same. Work out the amount for one serving, then multiply it by the new number of servings.'
  }
  if (lower.includes('value of x')) {
    return 'Treat the equation like a balanced scale. Undo the operation beside x by performing the opposite operation on both sides.'
  }
  if (lower.includes('how many are male')) {
    return 'Find the percentage that is not female by subtracting the given percentage from 100%. Then apply that remaining percentage to the total number of students.'
  }
  if (lower.includes('liter of gas')) {
    return 'The statement gives kilometers per liter. Divide the total trip distance by the distance covered using one liter.'
  }
  if (/what is \d+% of/i.test(text)) {
    return 'Convert the percentage to a decimal or fraction, then multiply it by the given whole amount.'
  }
  if (lower.includes('which conclusion is valid') || lower.includes('definitely true')) {
    return 'Translate each statement exactly as written and follow only the connection it guarantees. A statement about “some” does not mean “all,” and sharing one trait does not automatically prove group membership.'
  }
  if (lower.includes('rotates 90 degrees') || lower.includes('turn 90 degrees') || lower.includes('turn 135 degrees')) {
    return 'Track the starting direction, then apply each turn in order. Clockwise moves to the right around a compass; counter-clockwise moves to the left. Do not combine the turns until each step is accounted for.'
  }
  if (lower.includes('gains one more side')) {
    return 'Count the sides of each shape. The rule already says one side is added at every step, so continue that count once more and match it to the correct shape name.'
  }
  if (lower.includes('repeat') && lower.includes('shape')) {
    return 'Identify the complete repeating block of shapes, then restart that same block after its final item. The blank should match the next position in the cycle.'
  }
  if (lower.includes('doubled, then increased')) {
    return 'Apply both operations in the stated order to every number: multiply first, then add. Verify the rule on two earlier pairs before applying it to the last number.'
  }
  if (lower.includes('az, by')) {
    return 'Read the two letters in each pair separately. One side moves forward through the alphabet while the other moves backward by the same amount.'
  }
  if (lower.includes('rotate the letter')) {
    return 'Imagine turning the entire letter halfway around its center. A 180-degree rotation changes both its up/down and left/right orientation; it is not just a mirror reflection.'
  }
  if (lower.includes('folding') && lower.includes('layers')) {
    return 'Each complete fold places one layer over another. Track how the number of stacked layers changes after the first fold and then after the second.'
  }
  if (lower.includes('opposite') && lower.includes('cube')) {
    return 'A cube has three pairs of opposite faces. Account for the two opposite pairs already given; the two remaining colors must form the last pair.'
  }
  if (lower.includes('fold a net')) {
    return 'Use the square as the base and imagine each attached triangle folding upward. Then identify the solid formed when the triangle edges meet.'
  }
  if (lower.includes('cross-section')) {
    return 'A slice parallel to a face produces a cross-section with the same outline as that face. Picture the exposed surface created by the straight cut.'
  }
  if (lower.includes('standard die')) {
    return 'Use the rule provided in the question: opposite faces total 7. The bottom is opposite the top, so determine the number that completes that total.'
  }
  if (lower.includes('lower-right') || lower.includes('directly north') || lower.includes('facing north') || lower.includes('facing east') || lower.includes('facing northeast')) {
    return 'Sketch a small compass or coordinate cross. Place each location or direction one step at a time, then read the final direction from the starting point.'
  }
  if (lower.includes('view a cylinder directly from the top')) {
    return 'Think only about the flat outline visible from directly above, not the cylinder’s side view or full 3D form.'
  }
  if (lower.includes('shadow')) {
    return 'Work backward from the outline of the shadow. Ask which three-dimensional object can produce that same outline from the described direction.'
  }
  if (lower.includes('identical cubes are stacked')) {
    return 'Count the faces of both cubes, then remove the two faces hidden where the cubes touch. Only faces exposed to the outside are visible.'
  }
  if (lower.includes('experimental setup') || lower.includes('test whether')) {
    return 'A fair test changes only the factor being investigated while keeping other conditions alike. Look for a setup with a comparison group and a measurable result.'
  }
  if (lower.includes('control group')) {
    return 'The control group is the comparison baseline that does not receive the treatment being tested. It helps show whether the treatment caused a meaningful difference.'
  }
  if (lower.includes('hypothesis is best')) {
    return 'A hypothesis is a specific statement that can be tested using observations or an experiment. It should make a measurable prediction rather than state a proven fact.'
  }
  if (lower.includes('correlation') || (lower.includes('both increase') || lower.includes('also reported'))) {
    return 'Two things occurring together show correlation, but that alone does not prove that one causes the other. Consider whether another factor could influence both.'
  }
  if (lower.includes('controlled variable')) {
    return 'A controlled variable is a condition deliberately kept the same for every group so it cannot unfairly affect the result.'
  }
  if (lower.includes('sample size') || lower.includes('survey of 10')) {
    return 'Ask whether the participants are numerous and varied enough to represent the larger population. A small or narrow sample can produce an unreliable conclusion.'
  }
  if (lower.includes('theory and a hypothesis')) {
    return 'Compare their scientific roles: one is a testable proposed explanation, while the other is a broad explanation supported by extensive repeated evidence.'
  }
  if (lower.includes('repeat experiments') || lower.includes('cannot be reproduced')) {
    return 'Replication checks whether the same method produces consistent results. If others cannot reproduce a finding, its reliability or method needs closer review.'
  }
  if (lower.includes('honor students')) {
    return 'Check whether the surveyed group fairly represents all students. Selecting only one special subgroup can bias the conclusion.'
  }
  if (question.dimension === 'Scientific Reasoning') {
    return `Focus on the exact claim in this question: “${text}” Identify the evidence given, what still needs to be tested, and which option follows scientific method without assuming causation.`
  }
  if (question.dimension === 'Practical/Applied') {
    return `The situation is: “${text}” Identify the immediate goal or problem, then prefer the choice that checks instructions or safety first and solves the issue without creating unnecessary risk.`
  }
  if (question.dimension === 'Spatial') {
    return `Visualize the situation described in “${text}” Draw a quick shape or compass if helpful, apply each movement in order, and compare only the final position or visible outline.`
  }
  if (question.dimension === 'Abstract/Logical') {
    return `For “${text}” separate the given facts from assumptions, identify the exact rule connecting them, and choose only what must follow from that rule.`
  }

  return `Read the exact task again: “${text}” Identify what information is given and what single value, relationship, or conclusion the question asks you to find.`
}

function OnboardingSkills() {
  const navigate = useNavigate()

  const [questions, setQuestions] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [results, setResults] = useState(null)
  const [showExplanation, setShowExplanation] = useState(false)

  // Fetch 30 questions once when the page loads
  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/api/quiz`)
      .then((res) => res.json())
      .then((data) => {
        setQuestions(data.questions || [])
        setLoading(false)
      })
      .catch(() => {
        setError('Could not load quiz questions. Please refresh.')
        setLoading(false)
      })
  }, [])

  const handleSelect = (questionId, choice) => {
    setAnswers((prev) => ({ ...prev, [questionId]: choice }))
  }

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1)
      setShowExplanation(false)
    }
  }

  const handleBack = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
      setShowExplanation(false)
    }
  }

  const handleSubmit = async () => {
  if (Object.keys(answers).length < questions.length) {
    setError('Please answer all questions before submitting.')
    return
  }

  setSubmitting(true)
  setError('')
  const token = localStorage.getItem('token')

  const formattedAnswers = Object.entries(answers).map(([questionId, selectedOption]) => ({
    question_id: Number(questionId),
    selected_option: selectedOption,
  }))

  try {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/quiz`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ answers: formattedAnswers }),
    })
    const data = await response.json()

    if (!response.ok) {
      setError(data.message || 'Something went wrong submitting the quiz.')
      setSubmitting(false)
      return
    }

    console.log('Quiz result:', data)
    setResults(data)
  } catch {
    setError('Cannot connect to server. Please try again.')
    setSubmitting(false)
  }
}
  const handleContinue = () => {
    navigate('/onboarding/personality')
  }

  if (results) {
    const domainNames = Object.keys(results.domainScores)

    return (
      <OnboardingLayout currentStep={3} isComplete={true}>
        <div className="max-w-xl mx-auto px-6 py-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Your Skills Quiz Results</h2>
          <p className="text-gray-500 text-sm mb-8">
            You got {results.totalCorrect} out of {results.totalQuestions} correct.
          </p>

          <div className="space-y-5 mb-10">
            {domainNames.map((domain) => {
              const { correct, total } = results.domainScores[domain]
              const percent = Math.round((correct / total) * 100)
              return (
                <div key={domain}>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="font-medium text-gray-800">{domain}</span>
                    <span className="text-gray-500">{correct}/{total}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2.5">
                    <div
                      className="bg-orange-500 h-2.5 rounded-full transition-all"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>

          <button
            type="button"
            onClick={handleContinue}
            className="w-full bg-orange-500 text-white py-3 rounded-xl font-medium hover:bg-orange-600 transition text-sm"
          >
            Continue to Personality Assessment →
          </button>
        </div>
      </OnboardingLayout>
    )
  }

  if (loading) {
    return (
      <OnboardingLayout currentStep={3} isComplete={false}>
        <div className="max-w-xl mx-auto px-6 py-12 text-center text-gray-500 text-sm">
          Loading quiz questions...
        </div>
      </OnboardingLayout>
    )
  }

  if (questions.length === 0) {
    return (
      <OnboardingLayout currentStep={3} isComplete={false}>
        <div className="max-w-xl mx-auto px-6 py-12 text-center text-gray-500 text-sm">
          No quiz questions available right now.
        </div>
      </OnboardingLayout>
    )
  }

  const currentQuestion = questions[currentIndex]
  const selectedChoice = answers[currentQuestion.question_id]
  const isLastQuestion = currentIndex === questions.length - 1
  const answeredCount = Object.keys(answers).length
  const questionGuide = currentQuestion.explanation || getQuestionGuide(currentQuestion)

  const choiceLabels = [
    { key: 'A', text: currentQuestion.choice_a },
    { key: 'B', text: currentQuestion.choice_b },
    { key: 'C', text: currentQuestion.choice_c },
    { key: 'D', text: currentQuestion.choice_d },
  ]

  return (
    <OnboardingLayout currentStep={3} isComplete={answeredCount === questions.length}>
      <div className="max-w-2xl mx-auto px-5 sm:px-8 py-8 sm:py-12">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <div className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-white mb-3">
              <svg className="h-3.5 w-3.5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5s3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18s-3.332.477-4.5 1.253" />
              </svg>
              Skills check
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">Academic Skills Quiz</h2>
          </div>
          <div className="shrink-0 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Question</p>
            <p className="text-sm font-bold text-gray-900"><span className="text-orange-600">{currentIndex + 1}</span> / {questions.length}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 mb-7">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-orange-500 transition-all duration-300"
              style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
            />
          </div>
          <span className="shrink-0 text-xs font-semibold text-gray-400">{currentQuestion.dimension}</span>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm mb-6">
            {error}
          </div>
        )}

        <div className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-7 shadow-[0_18px_45px_-34px_rgba(15,23,42,0.45)] mb-7">
          {/* Question figure, if this item has one */}
          {currentQuestion.image_url && (
            <div className="mb-5 overflow-hidden rounded-2xl border border-gray-100 bg-gray-50 p-3">
              <img
                src={currentQuestion.image_url}
                alt="Question figure"
                className="mx-auto max-h-64 max-w-full object-contain"
              />
            </div>
          )}

          <div className="mb-5 border-l-4 border-orange-500 pl-4">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Select the best answer</p>
            <p className="text-base sm:text-lg font-semibold leading-relaxed text-gray-900">
              {currentQuestion.question_text}
            </p>
          </div>

          {questionGuide && (
            <div className="mb-5 overflow-hidden rounded-2xl border border-blue-100 bg-blue-50/70">
              <button
                type="button"
                onClick={() => setShowExplanation((current) => !current)}
                aria-expanded={showExplanation}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-semibold text-slate-700 transition hover:bg-blue-50"
              >
                <span className="flex items-center gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold text-blue-600 shadow-sm ring-1 ring-blue-100">?</span>
                  {showExplanation ? 'Hide explanation' : 'Not sure what this means?'}
                </span>
                <svg className={`h-4 w-4 shrink-0 text-blue-500 transition-transform ${showExplanation ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showExplanation && (
                <div className="border-t border-blue-100 px-4 py-3 text-sm leading-relaxed text-slate-600">
                  <p>{questionGuide}</p>
                </div>
              )}
            </div>
          )}

          {/* Answer choices */}
          <div className="space-y-2.5">
            {choiceLabels.map((choice) => (
              <button
                key={choice.key}
                type="button"
                onClick={() => handleSelect(currentQuestion.question_id, choice.key)}
                aria-pressed={selectedChoice === choice.key}
                className={`group flex w-full items-center gap-3 rounded-2xl border p-3 text-left text-sm transition-all sm:p-3.5 ${
                  selectedChoice === choice.key
                    ? 'border-orange-500 bg-orange-50 text-gray-900 shadow-sm ring-1 ring-orange-500'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-orange-300 hover:bg-orange-50/40'
                }`}
              >
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold transition ${
                  selectedChoice === choice.key
                    ? 'bg-orange-500 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-500 group-hover:bg-orange-100 group-hover:text-orange-700'
                }`}>
                  {choice.key}
                </span>
                <span className="min-w-0 flex-1 leading-relaxed">{choice.text}</span>
                {selectedChoice === choice.key && (
                  <svg className="h-5 w-5 shrink-0 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Navigation */}
        <div className="flex justify-between items-center gap-3">
          <button
            type="button"
            onClick={handleBack}
            disabled={currentIndex === 0}
            className="px-3 sm:px-5 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:text-gray-900 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition"
          >
            ← Back
          </button>

          {isLastQuestion ? (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="px-4 sm:px-6 py-3 rounded-xl text-sm font-medium bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 transition shadow-sm"
            >
              {submitting ? 'Submitting...' : 'Submit Quiz'}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleNext}
              disabled={!selectedChoice}
              className="px-5 sm:px-7 py-3 rounded-xl text-sm font-medium bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 transition shadow-sm"
            >
              Next →
            </button>
          )}
        </div>
      </div>
    </OnboardingLayout>
  )
}

export default OnboardingSkills
