import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import OnboardingLayout from '../../components/OnboardingLayout'
import AssessmentQuestionNavigation from '../../components/AssessmentQuestionNavigation'
import { FieldError, RequiredMark } from '../../components/FormValidation'
import { scrollToFirstInvalidField } from '../../utils/formValidation'
import {
  ASSESSMENT_SESSION_KEYS,
  assessmentHeaders,
  boundedQuestionIndex,
  firstUnansweredQuestionIndex,
  markAssessmentStepComplete,
  readAssessmentSession,
  writeAssessmentSession,
  readActiveAttempt,
  saveActiveAttemptDraft,
} from '../../utils/assessmentSession'

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

  const storage = typeof sessionStorage === 'undefined' ? null : sessionStorage
  const initialSession = readAssessmentSession(storage, ASSESSMENT_SESSION_KEYS.skills, {})
  const [questions, setQuestions] = useState(() => initialSession.questions || [])
  const [currentIndex, setCurrentIndex] = useState(() => boundedQuestionIndex(initialSession.currentIndex, initialSession.questions?.length || 0))
  const [answers, setAnswers] = useState(() => initialSession.answers || {})
  const [loading, setLoading] = useState(() => !initialSession.questions?.length)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [results, setResults] = useState(null)
  const [showExplanation, setShowExplanation] = useState(false)
  const [questionError, setQuestionError] = useState('')
  const [assessmentAccessError, setAssessmentAccessError] = useState('')
  const [attemptLoaded, setAttemptLoaded] = useState(false)

  useEffect(() => {
    readActiveAttempt(import.meta.env.VITE_API_URL, localStorage.getItem('token'), storage)
      .then((attempt) => {
        if (!attempt) return
        if (attempt.skillQuestions?.length) setQuestions(attempt.skillQuestions)
        if (attempt.skillAnswers?.length) setAnswers(Object.fromEntries(
          attempt.skillAnswers.map((answer) => [answer.question_id, answer.selected_option])
        ))
      })
      .catch(() => setAssessmentAccessError('Could not restore your saved Academic Skills progress. Please refresh.'))
      .finally(() => setAttemptLoaded(true))
  }, [storage])

  // A persisted submission is authoritative. Only load editable questions when
  // the account has no saved Academic Skills result.
  useEffect(() => {
    if (!attemptLoaded) return
    const token = localStorage.getItem('token')
    const headers = assessmentHeaders(storage, { Authorization: `Bearer ${token}` })

    fetch(`${import.meta.env.VITE_API_URL}/api/quiz/results`, { headers })
      .then((res) => {
        if (!res.ok) throw new Error('Could not check saved Academic Skills results.')
        return res.json()
      })
      .then((saved) => {
        const domainScores = saved.domainScores || {}
        if (Object.keys(domainScores).length > 0) {
          const totals = Object.values(domainScores).reduce(
            (sum, domain) => ({ correct: sum.correct + domain.correct, total: sum.total + domain.total }),
            { correct: 0, total: 0 }
          )
          markAssessmentStepComplete(storage, 3)
          setResults({ domainScores, totalCorrect: totals.correct, totalQuestions: totals.total })
          setLoading(false)
          return
        }

        if (questions.length > 0) {
          setLoading(false)
          return
        }

        return fetch(`${import.meta.env.VITE_API_URL}/api/quiz`)
          .then((res) => {
            if (!res.ok) throw new Error('Could not load Academic Skills questions.')
            return res.json()
          })
          .then((data) => {
            setQuestions(data.questions || [])
            setLoading(false)
          })
      })
      .catch(() => {
        setAssessmentAccessError('Could not confirm your saved Academic Skills result. Please refresh.')
        setLoading(false)
      })
  }, [attemptLoaded, questions.length, storage])

  useEffect(() => {
    if (!questions.length) return
    writeAssessmentSession(storage, ASSESSMENT_SESSION_KEYS.skills, {
      questions,
      answers,
      currentIndex,
    })
    if (!attemptLoaded) return
    const skillAnswers = Object.entries(answers).map(([questionId, selectedOption]) => ({
      question_id: Number(questionId), selected_option: selectedOption,
    }))
    const timer = setTimeout(() => {
      saveActiveAttemptDraft(import.meta.env.VITE_API_URL, localStorage.getItem('token'), storage, {
        skill_questions: questions,
        skill_answers: skillAnswers,
      }).catch(() => console.warn('Academic Skills draft autosave will retry on the next change.'))
    }, 250)
    return () => clearTimeout(timer)
  }, [answers, attemptLoaded, currentIndex, questions, storage])

  const handleSelect = (questionId, choice) => {
    setAnswers((prev) => ({ ...prev, [questionId]: choice }))
    setQuestionError('')
  }

  const handleNext = () => {
    if (!answers[questions[currentIndex]?.question_id]) {
      setQuestionError('Please select an answer.')
      scrollToFirstInvalidField(['skillQuestion'])
      return
    }
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
    const firstMissingIndex = firstUnansweredQuestionIndex(questions, answers, (question) => question.question_id)
    setCurrentIndex(firstMissingIndex)
    setQuestionError('Please select an answer.')
    scrollToFirstInvalidField(['skillQuestion'])
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
      headers: assessmentHeaders(storage, {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      }),
      body: JSON.stringify({ answers: formattedAnswers }),
    })
    const data = await response.json()

    if (!response.ok) {
      setError(data.message || 'Something went wrong submitting the quiz.')
      setSubmitting(false)
      return
    }

    markAssessmentStepComplete(storage, 3)
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
    const domainNames = ['Verbal', 'Numerical', 'Abstract/Logical', 'Spatial', 'Scientific Reasoning', 'Practical/Applied']
    const domainResults = domainNames.map((name) => {
      const score = results.domainScores[name] || { correct: 0, total: 0 }
      const percentage = score.total > 0 ? Math.round((score.correct / score.total) * 100) : 0
      return { name, ...score, percentage }
    })
    const overallPercentage = results.totalQuestions > 0
      ? Math.round((results.totalCorrect / results.totalQuestions) * 100)
      : 0
    const highestPercentage = Math.max(...domainResults.map((domain) => domain.percentage))
    const lowestPercentage = Math.min(...domainResults.map((domain) => domain.percentage))
    const strongestAreas = domainResults.filter((domain) => domain.percentage === highestPercentage)
    const areasToImprove = domainResults.filter((domain) => domain.percentage === lowestPercentage)

    return (
      <OnboardingLayout currentStep={3} isComplete={true} showFooterNavigation={false}>
        <div className="mx-auto max-w-4xl px-5 py-8 sm:px-8 sm:py-12">
          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_20px_55px_-38px_rgba(15,23,42,0.45)]">
            <div className="border-b border-slate-100 p-6 sm:p-8">
              <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                <div className="max-w-2xl">
                  <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-orange-600">Skills assessment complete</p>
                  <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Academic Skills Results</h2>
                  <p className="mt-3 text-sm leading-6 text-slate-600 sm:text-base">This is a snapshot of your current performance and can help highlight the skills you already use well and the areas you can continue developing.</p>
                </div>
                <div className="rounded-2xl border border-orange-100 bg-orange-50/70 px-6 py-5 md:min-w-72">
                  <p className="text-xs font-semibold uppercase tracking-wide text-orange-700">Overall score</p>
                  <div className="mt-2 flex items-end justify-between gap-6">
                    <p className="text-3xl font-bold tracking-tight text-slate-900">
                      {results.totalCorrect}
                      <span className="ml-2 text-base font-medium tracking-normal text-slate-600">out of {results.totalQuestions} correct</span>
                    </p>
                    <p className="shrink-0 text-2xl font-bold text-orange-600">{overallPercentage}%</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-4 p-6 sm:grid-cols-2 sm:p-8">
              <div className="rounded-2xl border border-orange-100 bg-orange-50/50 p-5">
                <h3 className="mb-3 font-bold text-slate-900">Strongest Areas</h3>
                <div className="flex flex-wrap gap-2">
                  {strongestAreas.map((domain) => <span key={domain.name} className="rounded-full border border-orange-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700">{domain.name} · {domain.percentage}%</span>)}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
                <h3 className="mb-3 font-bold text-slate-900">Areas to Improve</h3>
                <div className="flex flex-wrap gap-2">
                  {areasToImprove.map((domain) => <span key={domain.name} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700">{domain.name} · {domain.percentage}%</span>)}
                </div>
              </div>
            </div>
          </section>

          <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_45px_-38px_rgba(15,23,42,0.45)] sm:p-8">
            <h3 className="text-lg font-bold text-slate-900 sm:text-xl">Domain Breakdown</h3>
            <p className="mt-1 text-sm text-slate-500">Your score across each Academic Skills domain.</p>
            <div className="mt-6 grid gap-x-8 gap-y-6 md:grid-cols-2">
              {domainResults.map((domain) => (
                <div key={domain.name}>
                  <div className="mb-2 flex items-end justify-between gap-4">
                    <span className="text-sm font-semibold text-slate-800">{domain.name}</span>
                    <span className="shrink-0 text-sm font-bold text-slate-900">{domain.correct}/{domain.total} <span className="ml-1 font-medium text-slate-500">({domain.percentage}%)</span></span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-label={`${domain.name}: ${domain.percentage}%`} aria-valuemin="0" aria-valuemax="100" aria-valuenow={domain.percentage}>
                    <div className="h-full rounded-full bg-orange-500 transition-all duration-500" style={{ width: `${domain.percentage}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <aside className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm leading-6 text-slate-600 sm:px-6">
            <span className="font-semibold text-slate-900">How LearnMatch uses your results: </span>
            These results represent your current performance across the six Academic Skills domains. LearnMatch combines this with your Interests, Personality, and Personal Factors when generating recommendations.
          </aside>

          <button
            type="button"
            onClick={handleContinue}
            className="mt-8 flex w-full items-center justify-center rounded-xl bg-orange-500 px-6 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 sm:ml-auto sm:w-auto"
          >
            Continue to Personality Assessment
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

  if (assessmentAccessError) {
    return (
      <OnboardingLayout currentStep={3} isComplete={false} showFooterNavigation={false}>
        <div className="mx-auto max-w-xl px-6 py-12 text-center text-sm text-red-600">{assessmentAccessError}</div>
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
    <OnboardingLayout currentStep={3} isComplete={answeredCount === questions.length} showFooterNavigation={false}>
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
            <p className="text-sm font-bold text-gray-900"><span className="text-orange-600">{currentIndex + 1}</span> of {questions.length}</p>
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

        <div data-validation-field="skillQuestion" className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-7 shadow-[0_18px_45px_-34px_rgba(15,23,42,0.45)] mb-7" aria-invalid={questionError ? 'true' : undefined} aria-describedby={questionError ? 'skill-question-error' : undefined}>
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
              {currentQuestion.question_text} <RequiredMark />
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
              </button>
            ))}
          </div>
          <FieldError id="skill-question-error">{questionError}</FieldError>
        </div>

        <AssessmentQuestionNavigation
          currentIndex={currentIndex}
          isLastQuestion={isLastQuestion}
          currentAnswered={Boolean(selectedChoice)}
          allAnswered={answeredCount === questions.length}
          submitting={submitting}
          finalLabel="Submit Academic Skills"
          onBack={handleBack}
          onNext={handleNext}
          onSubmit={handleSubmit}
        />
      </div>
    </OnboardingLayout>
  )
}

export default OnboardingSkills
