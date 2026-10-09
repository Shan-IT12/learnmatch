import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconArrowRight, IconCircleCheck } from '@tabler/icons-react'
import { checkinQuestions, checkinScale } from '../../data/checkinQuestions'
import { FieldError, RequiredMark } from '../../components/FormValidation'
import { scrollToFirstInvalidField } from '../../utils/formValidation'
import CourseName from '../../components/CourseName'
import SuccessConfirmation from '../../components/SuccessConfirmation'
import { waitForSuccessConfirmation } from '../../utils/successConfirmation'

const RESULT_STYLES = {
  'On Track': 'border-emerald-200 bg-emerald-50 text-emerald-700',
  Monitor: 'border-amber-200 bg-amber-50 text-amber-700',
  'Needs Attention': 'border-red-200 bg-red-50 text-red-700',
}
const RESULT_LABELS = {
  'On Track': 'Going Well',
  Monitor: 'Keep an Eye On',
  'Needs Attention': 'Support Recommended',
}

export function CheckinResult({ result, courseName, termLabel, phase, onBack = () => {} }) {
  const statusStyle = RESULT_STYLES[result.status] || 'border-gray-200 bg-gray-50 text-gray-700'
  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="border-b border-gray-100 bg-white px-4 py-4 sm:px-8 sm:py-5">
        <span className="text-lg font-bold">Learn<span className="text-orange-500">Match</span></span>
      </nav>
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <header className="mb-6 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600"><IconCircleCheck size={27} stroke={2} /></span>
          <p className="mt-4 text-xs font-bold uppercase tracking-[0.18em] text-orange-600">Term Check-in</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-gray-950 sm:text-4xl">Check-in Complete</h1>
          <CourseName name={courseName} className="mt-2 block text-base font-semibold text-gray-800" secondaryClassName="mt-0.5 text-sm font-medium text-gray-500" />
          <div className="mt-2 flex flex-wrap items-center justify-center gap-2 text-sm text-gray-500">
            {termLabel && <span>{termLabel}</span>}
            {termLabel && <span aria-hidden="true">•</span>}
            <span>{phase} Phase</span>
          </div>
        </header>

        <section className="overflow-hidden rounded-[24px] border border-gray-100 bg-white shadow-[0_22px_55px_-38px_rgba(15,23,42,.45)]">
          <div className="grid gap-5 border-b border-gray-100 p-5 sm:grid-cols-[1fr_auto] sm:items-center sm:p-7">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-gray-400">Career Alignment Result</p>
              <span className={`mt-3 inline-flex rounded-full border px-3 py-1.5 text-sm font-bold ${statusStyle}`}>{RESULT_LABELS[result.status] || result.status}</span>
            </div>
            <div className="sm:text-right">
              <p className="text-4xl font-bold tracking-tight text-gray-950 sm:text-5xl">{result.alignmentPercent}%</p>
              <p className="mt-1 text-sm font-medium text-gray-500">aligned</p>
            </div>
          </div>

          <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-2">
            <article className="rounded-2xl border border-gray-100 bg-slate-50 p-5">
              <h2 className="text-sm font-bold text-gray-900">What your result means</h2>
              <p className="mt-3 text-sm leading-7 text-gray-600">{result.feedback}</p>
            </article>
            <article className="rounded-2xl border border-orange-100 bg-orange-50/60 p-5">
              <h2 className="text-sm font-bold text-gray-900">What you can do next</h2>
              <p className="mt-3 text-sm leading-7 text-gray-600">{result.recommendation}</p>
            </article>
          </div>
        </section>

        <div className="mt-6 flex justify-center">
          <button type="button" onClick={onBack} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-7 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-600 focus:outline-none focus:ring-4 focus:ring-orange-200 sm:w-auto">
            Back to College Dashboard <IconArrowRight size={17} />
          </button>
        </div>
      </main>
    </div>
  )
}

export function AnsweredProgress({ answeredCount }) {
  return (
    <div className="mt-6" aria-label={`${answeredCount} of 5 answered`}>
      <div className="mb-2 flex items-center justify-between text-xs font-semibold">
        <span className="text-slate-300">Your progress</span>
        <span className="text-orange-300">{answeredCount} of 5 answered</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-800">
        <div className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-400 transition-[width] duration-300" style={{ width: `${answeredCount * 20}%` }} />
      </div>
    </div>
  )
}

export function CheckinHeader({ courseName, termLabel, phase, answeredCount }) {
  return (
    <header className="mb-6 overflow-hidden rounded-[24px] border border-slate-800 bg-slate-950 px-5 py-6 text-white shadow-[0_22px_55px_-36px_rgba(15,23,42,.85)] sm:px-7 sm:py-7">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-orange-400">Term Check-in</p>
      <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><CourseName as="h1" name={courseName} className="text-2xl font-bold tracking-tight sm:text-3xl" secondaryClassName="mt-1 text-sm font-medium text-slate-300 sm:text-base" /><div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-300">{termLabel && <span>{termLabel}</span>}{termLabel && <span aria-hidden="true">•</span>}<span className="rounded-full border border-orange-400/40 bg-orange-400/10 px-2.5 py-1 font-semibold text-orange-200">{phase} Phase</span></div></div>
        <p className="max-w-md text-sm leading-relaxed text-slate-400">Answer based on your current experience in this term. Choose the response that feels most accurate for you right now.</p>
      </div>
      <AnsweredProgress answeredCount={answeredCount} />
    </header>
  )
}

export function CheckinQuestionCard({ question, selectedValue, onSelect = () => {}, error = '' }) {
  const fieldName = `checkin_${question.number}`
  const errorId = `${fieldName}-error`
  return (
    <fieldset data-validation-field={fieldName} className={`rounded-2xl border bg-white p-4 shadow-sm sm:p-5 ${error ? 'border-red-300' : 'border-gray-100'}`} aria-invalid={error ? 'true' : undefined} aria-describedby={error ? errorId : undefined}>
      <legend className="w-full px-0">
        <span className="flex items-start gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-orange-50 text-xs font-bold text-orange-600">{question.number}</span>
          <span className="pt-0.5 text-sm font-semibold leading-relaxed text-gray-900 sm:text-base">{question.text} <RequiredMark /></span>
        </span>
      </legend>
      <div className="mt-4 grid grid-cols-5 gap-2" role="radiogroup" aria-label={`Question ${question.number} response`}>
        {checkinScale.map((choice) => (
          <label key={choice.value} className={`group flex min-h-12 cursor-pointer items-center justify-center rounded-xl border text-sm font-bold transition focus-within:ring-4 focus-within:ring-orange-100 ${selectedValue === choice.value ? 'border-orange-500 bg-orange-500 text-white shadow-sm' : 'border-gray-200 bg-white text-gray-600 hover:border-orange-300 hover:bg-orange-50'}`} title={choice.label}>
            <input className="sr-only" type="radio" name={`question-${question.number}`} value={choice.value} checked={selectedValue === choice.value} onChange={() => onSelect(question.number, choice.value)} required />
            {choice.value}<span className="sr-only"> — {choice.label}</span>
          </label>
        ))}
      </div>
      <FieldError id={errorId}>{error}</FieldError>
      <div className="mt-2 grid grid-cols-3 gap-2 text-[10px] leading-tight text-gray-400 sm:text-xs">
        <span>{checkinScale[0].label}</span><span className="text-center">{checkinScale[2].label}</span><span className="text-right">{checkinScale[4].label}</span>
      </div>
    </fieldset>
  )
}

export function EndPhaseGwaField({ value = '', onChange = () => {} }) {
  return (
    <section className="rounded-2xl border border-orange-100 bg-orange-50/60 p-4 sm:p-5">
      <label htmlFor="term-gwa" className="block text-sm font-semibold text-gray-900">Your GWA this term <span className="font-normal text-gray-500">(optional)</span></label>
      <p className="mb-3 mt-1 text-xs text-gray-500">Percentage scale, 75 = passing. This helps us give more specific feedback.</p>
      <input id="term-gwa" type="number" min="0" max="100" step="0.01" value={value} onChange={onChange} placeholder="e.g. 87.5" className="w-full rounded-xl border border-orange-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-orange-400 focus:ring-4 focus:ring-orange-100 sm:max-w-xs" />
    </section>
  )
}

function SemesterCheckin() {
  const navigate = useNavigate()
  const token = localStorage.getItem('token')

  const [loading, setLoading] = useState(true)
  const [checkinId, setCheckinId] = useState(null)
  const [phase, setPhase] = useState(null)
  const [courseName, setCourseName] = useState('')
  const [termLabel, setTermLabel] = useState('')
  const [answers, setAnswers] = useState({})
  const [gwa, setGwa] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})
  const [saveConfirmed, setSaveConfirmed] = useState(false)

  useEffect(() => {
    if (!token) {
      navigate('/login')
      return
    }

    const fetchPending = async () => {
      try {
        const headers = { Authorization: `Bearer ${token}` }
        const [res, statusRes] = await Promise.all([
          fetch(`${import.meta.env.VITE_API_URL}/api/college/checkin/pending`, { headers }),
          fetch(`${import.meta.env.VITE_API_URL}/api/college/status`, { headers }).catch(() => null),
        ])
        const data = await res.json()

        if (!data.checkinId) {
          navigate('/college')
          return
        }

        setCheckinId(data.checkinId)
        setPhase(data.phase)
        setCourseName(data.courseName)
        if (statusRes?.ok) {
          const status = await statusRes.json()
          setTermLabel(status.termLabel || status.semester || '')
        }
        setLoading(false)
      } catch {
        setError('Could not load your check-in. Please try again.')
        setLoading(false)
      }
    }

    fetchPending()
  }, [navigate, token])

  const handleSelect = (questionNumber, score) => {
    setAnswers((prev) => ({ ...prev, [questionNumber]: score }))
    setFieldErrors((current) => ({ ...current, [questionNumber]: undefined }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    const questions = checkinQuestions[phase]
    const nextErrors = Object.fromEntries(questions.filter((question) => answers[question.number] === undefined).map((question) => [question.number, 'Please select a response.']))
    if (Object.keys(nextErrors).length) { setFieldErrors(nextErrors); scrollToFirstInvalidField([`checkin_${Object.keys(nextErrors)[0]}`]); return }
    setFieldErrors({})

    setSubmitting(true)

    const formattedAnswers = questions.map((q) => ({
      question_number: q.number,
      score: answers[q.number],
    }))

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/college/checkin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          checkinId,
          answers: formattedAnswers,
          gwa: phase === 'End' && gwa ? Number(gwa) : undefined,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.message || 'Something went wrong submitting your check-in.')
        setSubmitting(false)
        return
      }

      setSaveConfirmed(true)
      await waitForSuccessConfirmation()
      setResult(data)
    } catch {
      setError('Cannot connect to server. Please try again.')
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50" aria-label="Loading check-in">
        <div className="h-[73px] border-b border-gray-100 bg-white" />
        <main className="mx-auto max-w-5xl space-y-5 px-4 py-8 sm:px-6">
          <div className="h-52 animate-pulse rounded-[24px] bg-slate-200" />
          {[0, 1, 2].map((item) => <div key={item} className="h-40 animate-pulse rounded-2xl bg-white" />)}
        </main>
      </div>
    )
  }

  if (result) {
    return <CheckinResult result={result} courseName={courseName} termLabel={termLabel} phase={phase} onBack={() => navigate('/college')} />
  }

  if (saveConfirmed) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-50 px-5"><SuccessConfirmation message="Check-in Saved" /></div>
  }

  const questions = checkinQuestions[phase]
  const answeredCount = questions.filter(({ number }) => answers[number] !== undefined).length
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-100 px-8 py-5 flex justify-between items-center">
        <span className="text-lg font-bold">
          Learn<span className="text-orange-500">Match</span>
        </span>
        <button
          onClick={() => navigate('/college')}
          className="text-sm text-gray-500 hover:text-gray-900 transition"
        >
          ← Back
        </button>
      </nav>

      <main className="mx-auto max-w-5xl px-4 py-7 sm:px-6 sm:py-10 lg:px-8 lg:py-12">
        <CheckinHeader courseName={courseName} termLabel={termLabel} phase={phase} answeredCount={answeredCount} />

        {error && (
          <div role="alert" className="mb-5 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="motion-stagger space-y-4">
          {questions.map((question) => <CheckinQuestionCard key={question.number} question={question} selectedValue={answers[question.number]} onSelect={handleSelect} error={fieldErrors[question.number]} />)}

          {phase === 'End' && <EndPhaseGwaField value={gwa} onChange={(event) => setGwa(event.target.value)} />}

          <div className="sticky bottom-3 flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white/95 p-4 shadow-[0_16px_40px_-20px_rgba(15,23,42,.45)] backdrop-blur sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-900">{answeredCount} of 5 answered</p>
              <p className="text-xs text-gray-500">Complete all questions before submitting.</p>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex min-h-12 items-center justify-center rounded-xl bg-orange-500 px-7 text-sm font-semibold text-white transition hover:bg-orange-600 focus:outline-none focus:ring-4 focus:ring-orange-200 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500"
            >
              {submitting ? 'Submitting...' : 'Submit Check-in'}
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}

export default SemesterCheckin
