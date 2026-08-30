import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { checkinQuestions, checkinScale } from '../../data/checkinQuestions'

function SemesterCheckin() {
  const navigate = useNavigate()
  const token = localStorage.getItem('token')

  const [loading, setLoading] = useState(true)
  const [checkinId, setCheckinId] = useState(null)
  const [phase, setPhase] = useState(null)
  const [courseName, setCourseName] = useState('')
  const [answers, setAnswers] = useState({})
  const [gwa, setGwa] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  useEffect(() => {
    if (!token) {
      navigate('/login')
      return
    }

    const fetchPending = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/college/checkin/pending`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const data = await res.json()

        if (!data.checkinId) {
          navigate('/college')
          return
        }

        setCheckinId(data.checkinId)
        setPhase(data.phase)
        setCourseName(data.courseName)
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
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    const questions = checkinQuestions[phase]
    if (Object.keys(answers).length < questions.length) {
      setError('Please answer all 5 questions before submitting.')
      return
    }

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

      setResult(data)
    } catch {
      setError('Cannot connect to server. Please try again.')
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-400">Loading your check-in...</p>
      </div>
    )
  }

  if (result) {
    return (
      <div className="min-h-screen bg-gray-50">
        <nav className="bg-white border-b border-gray-100 px-8 py-5 flex justify-between items-center">
          <span className="text-lg font-bold">
            Learn<span className="text-orange-500">Match</span>
          </span>
        </nav>
        <div className="max-w-xl mx-auto px-6 py-12">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Check-in Complete</h1>
          <p className="text-gray-500 text-sm mb-8">Here's how things are looking.</p>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
            <p className="text-xs font-semibold text-orange-500 uppercase tracking-widest mb-2">
              {result.status}
            </p>
            <p className="text-3xl font-bold text-gray-900 mb-4">{result.alignmentPercent}% aligned</p>
            <p className="text-sm text-gray-600 leading-relaxed mb-3">{result.feedback}</p>
            <p className="text-sm text-gray-600 leading-relaxed">{result.recommendation}</p>
          </div>

          <button
            type="button"
            onClick={() => navigate('/college')}
            className="w-full bg-orange-500 text-white py-3 rounded-xl font-medium hover:bg-orange-600 transition text-sm"
          >
            Back to College Dashboard →
          </button>
        </div>
      </div>
    )
  }

  const questions = checkinQuestions[phase]

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

      <div className="max-w-xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Semester Check-in</h1>
        <p className="text-gray-500 text-sm mb-8">
          {courseName} · {phase} phase — answer honestly, this only takes a minute.
        </p>

        {error && (
          <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {questions.map((q) => (
            <div key={q.number} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <p className="text-sm font-medium text-gray-900 mb-4">{q.text}</p>
              <div className="space-y-2">
                {checkinScale.map((choice) => (
                  <button
                    key={choice.value}
                    type="button"
                    onClick={() => handleSelect(q.number, choice.value)}
                    className={`w-full text-left px-4 py-2.5 rounded-xl border text-sm transition ${
                      answers[q.number] === choice.value
                        ? 'bg-orange-500 text-white border-orange-500'
                        : 'bg-white text-gray-700 border-gray-200 hover:border-orange-300'
                    }`}
                  >
                    <span className="font-medium mr-2">{choice.value}.</span>
                    {choice.label}
                  </button>
                ))}
              </div>
            </div>
          ))}

          {phase === 'End' && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <label className="block text-sm font-medium text-gray-900 mb-1">
                Your GWA this semester <span className="text-gray-400 font-normal text-xs">(optional)</span>
              </label>
              <p className="text-xs text-gray-500 mb-3">
                Percentage scale, 75 = passing. This helps us give more specific feedback.
              </p>
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={gwa}
                onChange={(e) => setGwa(e.target.value)}
                placeholder="e.g. 87.5"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-orange-500 text-white py-3 rounded-xl font-medium hover:bg-orange-600 transition text-sm disabled:opacity-50"
          >
            {submitting ? 'Submitting...' : 'Submit Check-in'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default SemesterCheckin