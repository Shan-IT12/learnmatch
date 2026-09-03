import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconStar, IconStarFilled, IconX } from '@tabler/icons-react'

function FeedbackPopup() {
  const navigate = useNavigate()
  const token = localStorage.getItem('token')

  const [visible, setVisible] = useState(false)
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    const alreadyShown = sessionStorage.getItem('feedbackPopupShown')
    if (!alreadyShown) {
      const timer = setTimeout(() => setVisible(true), 1500)
      return () => clearTimeout(timer)
    }
  }, [])

  const dismiss = () => {
    sessionStorage.setItem('feedbackPopupShown', 'true')
    setVisible(false)
  }

  const handleStarClick = async (star) => {
    setRating(star)
    try {
      await fetch(`${import.meta.env.VITE_API_URL}/api/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ rating: star, category: 'General Feedback' }),
      })
      setSubmitted(true)
      sessionStorage.setItem('feedbackPopupShown', 'true')
      setTimeout(() => setVisible(false), 2000)
    } catch {
      dismiss()
    }
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-6 right-6 z-40 bg-white rounded-2xl shadow-xl border border-gray-100 p-5 w-72 animate-[fadeIn_0.3s_ease-out]">
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <button
        onClick={dismiss}
        className="absolute top-3 right-3 text-gray-300 hover:text-gray-500 transition"
      >
        <IconX size={16} stroke={2} />
      </button>

      {submitted ? (
        <p className="text-sm text-gray-700 font-medium text-center py-2">Thanks for the feedback! 🎉</p>
      ) : (
        <>
          <p className="text-sm font-semibold text-gray-900 mb-1">How helpful was this?</p>
          <p className="text-xs text-gray-400 mb-3">Rate your recommendations</p>
          <div className="flex gap-1 mb-3">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => handleStarClick(star)}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                className="text-orange-400 transition-transform hover:scale-110"
              >
                {(hoverRating || rating) >= star ? (
                  <IconStarFilled size={24} />
                ) : (
                  <IconStar size={24} stroke={1.5} />
                )}
              </button>
            ))}
          </div>
          <button
            onClick={() => {
              dismiss()
              navigate('/feedback')
            }}
            className="text-xs text-orange-500 hover:underline font-medium"
          >
            Want to add more detail? →
          </button>
        </>
      )}
    </div>
  )
}

export default FeedbackPopup