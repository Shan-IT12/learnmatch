import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { IconEye, IconEyeOff } from '@tabler/icons-react'

const isValidEmail = (email) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

const isValidPassword = (password) => {
  if (password.length < 8) return 'Password must be at least 8 characters'
  if (!/[A-Z]/.test(password)) return 'Password must include at least one uppercase letter'
  if (!/[0-9]/.test(password)) return 'Password must include at least one number'
  return null
}

function Register() {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
  })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const [step, setStep] = useState('register')
  const [userId, setUserId] = useState(null)
  const [otpCode, setOtpCode] = useState('')
  const [otpError, setOtpError] = useState('')
  const [otpMessage, setOtpMessage] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [resending, setResending] = useState(false)

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!isValidEmail(formData.email)) {
      setError('Please enter a valid email address')
      return
    }

    const passwordError = isValidPassword(formData.password)
    if (passwordError) {
      setError(passwordError)
      return
    }

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

      setUserId(data.userId)
      setStep('otp')
      setSubmitting(false)
    } catch {
      setError('Cannot connect to server. Please try again.')
      setSubmitting(false)
    }
  }

  const handleVerifyOtp = async (e) => {
    e.preventDefault()
    setOtpError('')

    if (otpCode.length !== 6) {
      setOtpError('Please enter the 6-digit code')
      return
    }

    setVerifying(true)

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, otpCode }),
      })

      const data = await response.json()

      if (!response.ok) {
        setOtpError(data.message || 'Something went wrong. Please try again.')
        setVerifying(false)
        return
      }

      setStep('verified')
      setTimeout(() => navigate('/login'), 1500)
    } catch {
      setOtpError('Cannot connect to server. Please try again.')
      setVerifying(false)
    }
  }

  const handleResendOtp = async () => {
    setOtpError('')
    setOtpMessage('')
    setResending(true)

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/resend-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, email: formData.email }),
      })

      const data = await response.json()

      if (!response.ok) {
        setOtpError(data.message || 'Something went wrong. Please try again.')
        setResending(false)
        return
      }

      setOtpMessage(data.message)
      setResending(false)
    } catch {
      setOtpError('Cannot connect to server. Please try again.')
      setResending(false)
    }
  }

  return (
    <div className="min-h-screen bg-white overflow-hidden">

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

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

      <div className="max-w-7xl mx-auto px-10 pt-8 pb-16 grid grid-cols-2 gap-16 items-center min-h-[calc(100vh-80px)]">

        <div className="max-w-md w-full">

          {step === 'register' && (
            <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
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
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 pr-11 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                      required
                      minLength={8}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                      tabIndex={-1}
                    >
                      {showPassword ? <IconEyeOff size={18} stroke={1.75} /> : <IconEye size={18} stroke={1.75} />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mt-1.5">
                    At least 8 characters, with 1 uppercase letter and 1 number
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Confirm Password</label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 pr-11 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                      required
                      minLength={8}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                      tabIndex={-1}
                    >
                      {showConfirmPassword ? <IconEyeOff size={18} stroke={1.75} /> : <IconEye size={18} stroke={1.75} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-orange-500 text-white py-3 rounded-xl font-medium hover:bg-orange-600 transition text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {submitting ? 'Creating account...' : 'Register'}
                  {!submitting && (
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
          )}

          {step === 'otp' && (
            <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
              <div className="w-14 h-14 rounded-2xl bg-orange-50 flex items-center justify-center mb-6">
                <svg className="w-7 h-7 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>

              <h1 className="text-3xl font-bold text-gray-900 leading-tight mb-3">
                Check your email
              </h1>
              <p className="text-base text-gray-500 leading-relaxed mb-8">
                We sent a 6-digit code to <strong className="text-gray-700">{formData.email}</strong>.
                Enter it below to verify your account.
              </p>

              {otpError && (
                <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm mb-6">
                  {otpError}
                </div>
              )}

              {otpMessage && (
                <div className="bg-green-50 text-green-700 px-4 py-3 rounded-xl text-sm mb-6">
                  {otpMessage}
                </div>
              )}

              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Verification Code</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="000000"
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-center text-2xl font-bold tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-orange-400"
                    autoFocus
                  />
                </div>

                <button
                  type="submit"
                  disabled={verifying}
                  className="w-full bg-orange-500 text-white py-3 rounded-xl font-medium hover:bg-orange-600 transition text-sm disabled:opacity-50"
                >
                  {verifying ? 'Verifying...' : 'Verify Account'}
                </button>
              </form>

              <p className="text-center text-sm text-gray-500 mt-6">
                Didn't get the code?{' '}
                <button
                  onClick={handleResendOtp}
                  disabled={resending}
                  className="text-orange-500 font-medium hover:underline disabled:opacity-50"
                >
                  {resending ? 'Sending...' : 'Resend Code'}
                </button>
              </p>
            </div>
          )}

          {step === 'verified' && (
            <div style={{ animation: 'fadeIn 0.3s ease-out' }} className="text-center">
              <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mb-6 mx-auto">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-3xl font-bold text-gray-900 leading-tight mb-3">
                Account verified!
              </h1>
              <p className="text-base text-gray-500 leading-relaxed">
                Redirecting you to log in...
              </p>
            </div>
          )}
        </div>

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