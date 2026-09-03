import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconStar, IconStarFilled } from '@tabler/icons-react'

const categories = [
  { value: 'Bug Report', label: 'Something is broken' },
  { value: 'Suggestion', label: 'I have a suggestion' },
  { value: 'General Feedback', label: 'General feedback' },
]

function Feedback() {
  const navigate = useNavigate()
  const token = localStorage.getItem('token')

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
      <div className="min-h-screen bg-white">
        <nav className="bg-white border-b border-gray-100 px-14 py-[18px] flex justify-between items-center">
          <button
            onClick={() => navigate('/dashboard')}
            className="text-lg font-bold text-gray-900 hover:opacity-80 transition"
          >
            Learn<span className="text-orange-500">Match</span>
          </button>
        </nav>
        <div className="max-w-md mx-auto px-6 py-24 text-center">
          <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mb-6 mx-auto">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Thanks for your feedback!</h1>
          <p className="text-sm text-gray-500 mb-8">It genuinely helps us improve LearnMatch.</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="bg-orange-500 text-white px-6 py-3 rounded-xl font-medium hover:bg-orange-600 transition text-sm"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <nav className="bg-white border-b border-gray-100 px-14 py-[18px] flex justify-between items-center">
        <button
          onClick={() => navigate('/dashboard')}
          className="text-lg font-bold text-gray-900 hover:opacity-80 transition"
        >
          Learn<span className="text-orange-500">Match</span>
        </button>
        <button
          onClick={() => navigate('/dashboard')}
          className="text-sm text-gray-500 hover:text-gray-900 transition"
        >
          ← Back to Dashboard
        </button>
      </nav>

      <div className="max-w-lg mx-auto px-6 py-16">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Send Feedback</h1>
        <p className="text-sm text-gray-500 mb-8">
          Tell us what's working, what's not, or what you'd like to see.
        </p>

        {error && (
          <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              How would you rate your experience?
            </label>
            <div className="flex gap-1.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="text-orange-400 transition-transform hover:scale-110"
                >
                  {(hoverRating || rating) >= star ? (
                    <IconStarFilled size={32} />
                  ) : (
                    <IconStar size={32} stroke={1.5} />
                  )}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              What's this about?
            </label>
            <div className="space-y-2">
              {categories.map((cat) => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => setCategory(cat.value)}
                  className={`w-full text-left px-4 py-3 rounded-xl border text-sm font-medium transition ${
                    category === cat.value
                      ? 'bg-orange-500 text-white border-orange-500'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-orange-300'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Anything else? <span className="text-gray-400 font-normal text-xs">(optional)</span>
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              placeholder="Tell us more..."
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-orange-500 text-white py-3 rounded-xl font-medium hover:bg-orange-600 transition text-sm disabled:opacity-50"
          >
            {submitting ? 'Sending...' : 'Send Feedback'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default Feedback