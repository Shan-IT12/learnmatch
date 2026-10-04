import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { IconEye, IconEyeOff } from '@tabler/icons-react'
import AuthJourneyPanel from '../components/AuthJourneyPanel'
import { FieldError, RequiredMark } from '../components/FormValidation'
import { scrollToFirstInvalidField } from '../utils/formValidation'
import {
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  validateUsername,
} from '../utils/usernameValidation'

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
  const [fieldErrors, setFieldErrors] = useState({})

  const [step, setStep] = useState('register')
  const [userId, setUserId] = useState(null)
  const [otpCode, setOtpCode] = useState('')
  const [otpError, setOtpError] = useState('')
  const [otpMessage, setOtpMessage] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [resending, setResending] = useState(false)

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
    setFieldErrors((current) => ({ ...current, [e.target.name]: undefined }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    const nextErrors = {}
    if (!formData.email.trim()) nextErrors.email = 'Please enter your email address.'
    else if (!isValidEmail(formData.email)) nextErrors.email = 'Please enter a valid email address.'
    const usernameError = validateUsername(formData.username)
    if (usernameError) nextErrors.username = usernameError
    const passwordError = isValidPassword(formData.password)
    if (!formData.password) nextErrors.password = 'Please enter a password.'
    else if (passwordError) nextErrors.password = passwordError
    if (!formData.confirmPassword) nextErrors.confirmPassword = 'Please confirm your password.'
    else if (formData.password !== formData.confirmPassword) nextErrors.confirmPassword = 'Passwords do not match.'
    if (Object.keys(nextErrors).length) { setFieldErrors(nextErrors); scrollToFirstInvalidField(Object.keys(nextErrors)); return }
    setFieldErrors({})

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
      scrollToFirstInvalidField(['otpCode'])
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
    <div className="relative min-h-screen overflow-x-hidden bg-[#fbf8f3] text-gray-900">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_18%,rgba(251,146,60,0.13),transparent_28%),radial-gradient(circle_at_72%_75%,rgba(253,186,116,0.11),transparent_31%),linear-gradient(115deg,rgba(255,255,255,.78),rgba(255,247,237,.34))]" />

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .auth-fade-in { animation: none !important; }
        }
      `}</style>

      <nav className="relative z-10 mx-auto flex max-w-[1440px] items-center justify-between gap-3 px-5 py-5 sm:px-8 lg:px-10">
        <Link to="/" className="text-xl font-bold tracking-tight text-gray-900">
          Learn<span className="text-orange-500">Match</span>
        </Link>
        <div className="flex items-center gap-2">
          <span className="hidden text-sm text-gray-400 sm:inline">Already have an account?</span>
          <Link
            to="/login"
            className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition duration-150 hover:border-orange-200 hover:bg-orange-50 hover:text-orange-700 active:translate-y-px"
          >
            Log In
          </Link>
        </div>
      </nav>

      <main className="relative z-0 mx-auto grid max-w-[1380px] items-center gap-8 px-5 pb-10 pt-3 sm:px-8 sm:pb-14 sm:pt-6 lg:grid-cols-[minmax(400px,0.82fr)_minmax(500px,1.18fr)] lg:gap-10 lg:px-10 lg:py-8 xl:gap-16">

        <section className="relative mx-auto w-full max-w-[520px] overflow-hidden rounded-[28px] border border-white/90 bg-white/72 px-6 py-8 shadow-[0_24px_70px_-42px_rgba(120,53,15,.42)] backdrop-blur-xl sm:px-9 sm:py-10 lg:mx-0 lg:px-10 lg:py-11">
          <div className="absolute inset-y-10 left-0 w-1 rounded-r-full bg-gradient-to-b from-orange-400 via-orange-500 to-amber-300" />

          {step === 'register' && (
            <div className="auth-fade-in" style={{ animation: 'fadeIn 0.3s ease-out' }}>
              <div className="inline-flex items-center gap-2 bg-orange-50 text-orange-600 text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
                <span className="w-1.5 h-1.5 bg-orange-500 rounded-full" />
                Personalized course guidance
              </div>

              <h1 className="mb-3 text-3xl font-bold leading-[1.12] tracking-[-0.025em] text-gray-900 sm:text-[2.5rem]">
                Create your account
              </h1>
              <p className="text-base text-gray-500 leading-relaxed mb-8">
                Create your account and start exploring courses that fit your strengths and goals.
              </p>

              {error && (
                <div role="alert" className="mb-6 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} noValidate className="space-y-4">
                <div data-validation-field="email">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email <RequiredMark /></label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full rounded-2xl border border-stone-200/90 bg-white/85 px-4 py-3.5 text-sm outline-none transition duration-150 hover:border-orange-200 focus:border-orange-400 focus:bg-white focus:ring-4 focus:ring-orange-100/80"
                    required
                    aria-required="true" aria-invalid={fieldErrors.email ? 'true' : undefined} aria-describedby={fieldErrors.email ? 'register-email-error' : undefined}
                  />
                  <FieldError id="register-email-error">{fieldErrors.email}</FieldError>
                </div>

                <div data-validation-field="username">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Username <RequiredMark /></label>
                  <input
                    type="text"
                    name="username"
                    value={formData.username}
                    onChange={handleChange}
                    minLength={USERNAME_MIN_LENGTH}
                    maxLength={USERNAME_MAX_LENGTH}
                    className="w-full rounded-2xl border border-stone-200/90 bg-white/85 px-4 py-3.5 text-sm outline-none transition duration-150 hover:border-orange-200 focus:border-orange-400 focus:bg-white focus:ring-4 focus:ring-orange-100/80"
                    required
                    aria-required="true" aria-invalid={fieldErrors.username ? 'true' : undefined} aria-describedby={fieldErrors.username ? 'register-username-error' : undefined}
                  />
                  <FieldError id="register-username-error">{fieldErrors.username}</FieldError>
                </div>

                <div data-validation-field="password">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Password <RequiredMark /></label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      className="w-full rounded-2xl border border-stone-200/90 bg-white/85 px-4 py-3.5 pr-11 text-sm outline-none transition duration-150 hover:border-orange-200 focus:border-orange-400 focus:bg-white focus:ring-4 focus:ring-orange-100/80"
                      required
                      minLength={8}
                      aria-required="true" aria-invalid={fieldErrors.password ? 'true' : undefined} aria-describedby={fieldErrors.password ? 'register-password-error' : undefined}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-1 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-gray-400 transition duration-150 hover:bg-gray-50 hover:text-gray-600 active:scale-95"
                      tabIndex={-1}
                    >
                      {showPassword ? <IconEyeOff size={18} stroke={1.75} /> : <IconEye size={18} stroke={1.75} />}
                    </button>
                  </div>
                  <FieldError id="register-password-error">{fieldErrors.password}</FieldError>
                  <p className="text-xs text-gray-400 mt-1.5">
                    At least 8 characters, with 1 uppercase letter and 1 number
                  </p>
                </div>

                <div data-validation-field="confirmPassword">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Confirm Password <RequiredMark /></label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      className="w-full rounded-2xl border border-stone-200/90 bg-white/85 px-4 py-3.5 pr-11 text-sm outline-none transition duration-150 hover:border-orange-200 focus:border-orange-400 focus:bg-white focus:ring-4 focus:ring-orange-100/80"
                      required
                      minLength={8}
                      aria-required="true" aria-invalid={fieldErrors.confirmPassword ? 'true' : undefined} aria-describedby={fieldErrors.confirmPassword ? 'register-confirm-error' : undefined}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                      className="absolute right-1 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-gray-400 transition duration-150 hover:bg-gray-50 hover:text-gray-600 active:scale-95"
                      tabIndex={-1}
                    >
                      {showConfirmPassword ? <IconEyeOff size={18} stroke={1.75} /> : <IconEye size={18} stroke={1.75} />}
                    </button>
                  </div>
                  <FieldError id="register-confirm-error">{fieldErrors.confirmPassword}</FieldError>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-orange-600 py-3.5 text-sm font-semibold text-white shadow-[0_12px_28px_-12px_rgba(234,88,12,.8)] transition duration-150 hover:-translate-y-0.5 hover:shadow-[0_16px_32px_-12px_rgba(234,88,12,.72)] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50"
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
            <div className="auth-fade-in" style={{ animation: 'fadeIn 0.3s ease-out' }}>
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
                <div role="alert" className="mb-6 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
                  {otpError}
                </div>
              )}

              {otpMessage && (
                <div role="status" className="mb-6 rounded-xl border border-green-100 bg-green-50 px-4 py-3 text-sm text-green-700">
                  {otpMessage}
                </div>
              )}

              <form onSubmit={handleVerifyOtp} noValidate className="space-y-4">
                <div data-validation-field="otpCode">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Verification Code <RequiredMark /></label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => { setOtpCode(e.target.value.replace(/\D/g, '')); setOtpError('') }}
                    placeholder="000000"
                    className="w-full rounded-2xl border border-stone-200/90 bg-white/85 px-3 py-3.5 text-center text-xl font-bold tracking-[0.3em] outline-none transition duration-150 hover:border-orange-200 focus:border-orange-400 focus:bg-white focus:ring-4 focus:ring-orange-100/80 sm:px-4 sm:text-2xl sm:tracking-[0.5em]"
                    autoFocus
                    required aria-required="true" aria-invalid={otpError ? 'true' : undefined} aria-describedby={otpError ? 'register-otp-error' : undefined}
                  />
                  <FieldError id="register-otp-error">{otpError}</FieldError>
                </div>

                <button
                  type="submit"
                  disabled={verifying}
                  className="w-full rounded-2xl bg-gradient-to-r from-orange-500 to-orange-600 py-3.5 text-sm font-semibold text-white shadow-[0_12px_28px_-12px_rgba(234,88,12,.8)] transition duration-150 hover:-translate-y-0.5 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50"
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
            <div style={{ animation: 'fadeIn 0.3s ease-out' }} className="auth-fade-in text-center">
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
        </section>

        <AuthJourneyPanel
          heading="Find a path that fits you."
          supportingText="Discover courses that align with your strengths, interests, and goals."
        />
      </main>
    </div>
  )
}

export default Register
