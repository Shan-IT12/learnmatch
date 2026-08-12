import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

function Register() {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setSubmitting(true)

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.message || 'Something went wrong. Please try again.')
        setSubmitting(false)
        return
      }

      setSuccess(true)
      setTimeout(() => {
        navigate('/login')
      }, 1500)
    } catch {
      setError('Cannot connect to server. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-white overflow-hidden">

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
      `}</style>

      {/* Nav */}
      <nav className="flex justify-between items-center px-10 py-5">
        <Link to="/" className="text-xl font-bold tracking-tight text-gray-900">
          Learn<span className="text-orange-500">Match</span>
        </Link>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">Already have an account?</span>
          <Link
            to="/login"
            className="text-sm text-gray-700 px-4 py-2.5 rounded-lg hover:bg-gray-50 transition font-medium"
          >
            Log In
          </Link>
        </div>
      </nav>

      {/* Split layout */}
      <div className="max-w-7xl mx-auto px-10 pt-8 pb-16 grid grid-cols-2 gap-16 items-center min-h-[calc(100vh-80px)]">

        {/* Left side — form */}
        <div className="max-w-md w-full">
          <div className="inline-flex items-center gap-2 bg-orange-50 text-orange-600 text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
            <span className="w-1.5 h-1.5 bg-orange-500 rounded-full" />
            AI-assisted course recommendation
          </div>

          <h1 className="text-4xl font-bold text-gray-900 leading-tight mb-3">
            Create your account
          </h1>
          <p className="text-base text-gray-500 leading-relaxed mb-8">
            Answer a few questions and get course recommendations that actually fit who you are.
          </p>

          {error && (
            <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm mb-6">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-50 text-green-700 px-4 py-3 rounded-xl text-sm mb-6">
              Account created successfully! Redirecting to login...
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                required
                disabled={success}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Username</label>
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleChange}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                required
                disabled={success}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                required
                minLength={8}
                disabled={success}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Confirm Password</label>
              <input
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                required
                minLength={8}
                disabled={success}
              />
            </div>

            <button
              type="submit"
              disabled={submitting || success}
              className="w-full bg-orange-500 text-white py-3 rounded-xl font-medium hover:bg-orange-600 transition text-sm disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting ? 'Creating account...' : success ? 'Account created ✓' : 'Register'}
              {!submitting && !success && (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              )}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-orange-500 font-medium hover:underline">
              Log In
            </Link>
          </p>
        </div>

        {/* Right side — gradient panel with heading and one card */}
        <div
          className="relative h-[500px] rounded-[32px] overflow-hidden flex flex-col justify-between p-10"
          style={{ background: 'linear-gradient(150deg, #fb923c 0%, #f97316 55%, #ea580c 100%)' }}
        >
          <svg width="280" height="280" viewBox="0 0 280 280" className="absolute -top-16 -right-16 opacity-25">
            <circle cx="140" cy="140" r="120" fill="none" stroke="#fff" strokeWidth="1.5" />
            <circle cx="140" cy="140" r="80" fill="none" stroke="#fff" strokeWidth="1.5" />
          </svg>
          <div className="absolute bottom-10 left-10 grid grid-cols-4 gap-2 opacity-25">
            {Array.from({ length: 16 }).map((_, i) => (
              <div key={i} className="w-1.5 h-1.5 bg-white rounded-full" />
            ))}
          </div>

          <div className="relative">
            <h2 className="text-3xl font-bold text-white leading-tight mb-3">
              Find your fit.
            </h2>
            <p className="text-sm text-orange-50 leading-relaxed max-w-xs">
              Join students getting personalized course recommendations based on their skills, interests, and personality.
            </p>
          </div>

          <div
            className="relative bg-white rounded-2xl shadow-lg px-5 py-4 w-60 border border-orange-100"
            style={{ animation: 'float 4s ease-in-out infinite' }}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Match</span>
              <span className="text-sm font-bold text-gray-900">78%</span>
            </div>
            <p className="text-sm font-semibold text-gray-800 mb-3">Healthcare Science</p>
            <div className="w-full bg-gray-100 rounded-full h-1.5">
              <div className="bg-orange-500 h-1.5 rounded-full" style={{ width: '78%' }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Register