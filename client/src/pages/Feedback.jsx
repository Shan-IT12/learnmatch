import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  IconAlertTriangle,
  IconArrowLeft,
  IconBug,
  IconBulb,
  IconCheck,
  IconCircleCheck,
  IconMessageCircle,
  IconSend,
  IconStar,
  IconStarFilled,
} from '@tabler/icons-react'
import {
  FEEDBACK_ENTRY_CONTEXT_KEY,
  getFeedbackDashboardPath,
  getFeedbackEntryContext,
} from '../utils/feedbackNavigation'

const categories = [
  { value: 'Bug Report', label: 'Something is broken', icon: IconBug, iconClass: 'bg-rose-50 text-rose-500' },
  { value: 'Suggestion', label: 'I have a suggestion', icon: IconBulb, iconClass: 'bg-amber-50 text-amber-600' },
  { value: 'General Feedback', label: 'General feedback', icon: IconMessageCircle, iconClass: 'bg-sky-50 text-sky-600' },
]

const ratingLabels = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent']

function Feedback() {
  const navigate = useNavigate()
  const location = useLocation()
  const token = localStorage.getItem('token')
  const [entryContext] = useState(() => getFeedbackEntryContext(
    location.state?.entryContext,
    sessionStorage.getItem(FEEDBACK_ENTRY_CONTEXT_KEY)
  ))
  const dashboardPath = getFeedbackDashboardPath(entryContext)

  useEffect(() => {
    sessionStorage.setItem(FEEDBACK_ENTRY_CONTEXT_KEY, entryContext)
  }, [entryContext])

  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [category, setCategory] = useState('')
  const [comment, setComment] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (rating === 0) {
      setError('Please select a rating.')
      return
    }
    if (!category) {
      setError('Please select a category.')
      return
    }

    setSubmitting(true)

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ rating, category, comment }),
      })

      if (!response.ok) {
        const data = await response.json()
        setError(data.message || 'Something went wrong. Please try again.')
        setSubmitting(false)
        return
      }

      setSubmitted(true)
    } catch {
      setError('Cannot connect to server. Please try again.')
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-[#fcfbf9] text-gray-900">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(251,146,60,0.08),transparent_30%),radial-gradient(circle_at_100%_35%,rgba(196,181,253,0.07),transparent_28%)]" />
        <nav className="relative z-10 flex items-center justify-between gap-3 border-b border-white/80 bg-white/85 px-4 py-4 shadow-[0_1px_12px_rgba(15,23,42,0.03)] backdrop-blur-md sm:px-8 lg:px-14">
          <button
            onClick={() => navigate(dashboardPath)}
            className="text-lg font-bold tracking-tight text-gray-900 transition hover:opacity-75"
          >
            Learn<span className="text-orange-500">Match</span>
          </button>
          <button onClick={() => navigate(dashboardPath)} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-gray-500 transition hover:bg-gray-50 hover:text-gray-900 sm:text-sm">
            <IconArrowLeft size={16} stroke={2} /> Back to Dashboard
          </button>
        </nav>
        <main className="relative z-0 mx-auto flex max-w-3xl items-center px-4 py-12 sm:px-8 sm:py-20">
          <section className="w-full rounded-3xl border border-white/80 bg-white/85 px-5 py-10 text-center shadow-[0_12px_40px_rgba(15,23,42,0.06)] backdrop-blur-md sm:px-10 sm:py-14">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600"><IconCircleCheck size={34} stroke={1.8} /></div>
            <h1 className="mt-6 text-2xl font-bold tracking-tight text-gray-950">Thanks for your feedback!</h1>
            <p className="mt-2 text-sm text-gray-500">It genuinely helps us improve LearnMatch.</p>
            <button onClick={() => navigate(dashboardPath)} className="mt-8 inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-6 py-3 text-sm font-semibold text-white shadow-sm shadow-orange-200 transition hover:-translate-y-0.5 hover:bg-orange-600 focus:outline-none focus:ring-4 focus:ring-orange-100">
              <IconArrowLeft size={16} stroke={2} /> Back to Dashboard
            </button>
          </section>
        </main>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#fcfbf9] text-gray-900">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(251,146,60,0.08),transparent_30%),radial-gradient(circle_at_100%_35%,rgba(196,181,253,0.07),transparent_28%)]" />
      <nav className="relative z-10 flex items-center justify-between gap-3 border-b border-white/80 bg-white/85 px-4 py-4 shadow-[0_1px_12px_rgba(15,23,42,0.03)] backdrop-blur-md sm:px-8 lg:px-14">
        <button
          onClick={() => navigate(dashboardPath)}
          className="text-lg font-bold tracking-tight text-gray-900 transition hover:opacity-75"
        >
          Learn<span className="text-orange-500">Match</span>
        </button>
        <button
          onClick={() => navigate(dashboardPath)}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-gray-500 transition hover:bg-gray-50 hover:text-gray-900 sm:text-sm"
        >
          <IconArrowLeft size={16} stroke={2} /> Back to Dashboard
        </button>
      </nav>

      <main className="relative z-0 mx-auto max-w-4xl px-4 py-7 sm:px-8 sm:py-10 lg:px-10 lg:py-12">
        <header className="mb-7">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-orange-600"><IconMessageCircle size={22} stroke={1.8} /></span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-gray-950 sm:text-3xl">Send Feedback</h1>
              <p className="mt-1 text-sm leading-relaxed text-gray-500 sm:text-base">Tell us what’s working, what’s not, or what you’d like to see.</p>
            </div>
          </div>
        </header>

        {error && (
          <div role="alert" className="mb-6 flex items-start gap-3 rounded-2xl border border-red-100 bg-red-50/90 px-4 py-3 text-sm text-red-600 shadow-sm">
            <IconAlertTriangle size={18} stroke={1.8} className="mt-0.5 shrink-0" /> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8 rounded-3xl border border-white/80 bg-white/85 p-5 shadow-[0_12px_40px_rgba(15,23,42,0.06)] backdrop-blur-md sm:p-8 lg:p-10">

          <fieldset>
            <legend className="text-base font-semibold text-gray-900">
              How would you rate your experience?
            </legend>
            <p className="mt-1 text-sm text-gray-500">Choose the rating that best matches your experience.</p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <div className="flex gap-1 rounded-2xl border border-gray-100 bg-gray-50/70 p-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  aria-label={`${star} out of 5 — ${ratingLabels[star]}`}
                  aria-pressed={rating === star}
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="rounded-xl p-1.5 text-orange-400 transition hover:scale-110 hover:bg-white focus:outline-none focus:ring-2 focus:ring-orange-300"
                >
                  {(hoverRating || rating) >= star ? (
                    <IconStarFilled size={30} />
                  ) : (
                    <IconStar size={30} stroke={1.5} className="text-gray-300" />
                  )}
                </button>
              ))}
              </div>
              {rating > 0 && <span className="rounded-full bg-orange-50 px-3 py-1.5 text-xs font-bold text-orange-700">{ratingLabels[rating]}</span>}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-base font-semibold text-gray-900">
              What's this about?
            </legend>
            <p className="mt-1 text-sm text-gray-500">Select the category that fits best.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {categories.map((cat) => {
                const CategoryIcon = cat.icon
                const selected = category === cat.value
                return (
                <label
                  key={cat.value}
                  className={`relative flex min-h-24 cursor-pointer items-center gap-3 rounded-2xl border p-4 transition focus-within:ring-4 focus-within:ring-orange-100 ${
                    selected
                      ? 'border-orange-300 bg-orange-50/70 shadow-sm'
                      : 'border-gray-200 bg-white hover:border-orange-200 hover:bg-orange-50/30'
                  }`}
                >
                  <input type="radio" name="feedback-category" value={cat.value} checked={selected} onChange={() => setCategory(cat.value)} className="sr-only" />
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${cat.iconClass}`}><CategoryIcon size={19} stroke={1.8} /></span>
                  <span className="pr-5 text-sm font-semibold leading-snug text-gray-700">{cat.label}</span>
                  <span className={`absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full border transition ${selected ? 'border-orange-500 bg-orange-500 text-white' : 'border-gray-300 bg-white text-transparent'}`}><IconCheck size={13} stroke={2.5} /></span>
                </label>
                )
              })}
            </div>
          </fieldset>

          <div>
            <label htmlFor="feedback-comment" className="mb-2 block text-base font-semibold text-gray-900">
              Anything else? <span className="text-gray-400 font-normal text-xs">(optional)</span>
            </label>
            <textarea
              id="feedback-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              placeholder="Tell us more..."
              className="min-h-32 w-full resize-y rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm leading-relaxed outline-none transition placeholder:text-gray-400 focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
            />
          </div>

          <div className="flex justify-end border-t border-gray-100 pt-6">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-6 py-3 text-sm font-semibold text-white shadow-sm shadow-orange-200 transition hover:-translate-y-0.5 hover:bg-orange-600 hover:shadow-md focus:outline-none focus:ring-4 focus:ring-orange-100 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              {submitting ? 'Sending...' : <><IconSend size={17} stroke={2} /> Send Feedback</>}
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}

export default Feedback
