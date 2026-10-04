import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { IconEye, IconEyeOff } from '@tabler/icons-react'
import AuthJourneyPanel from '../components/AuthJourneyPanel'
import { FieldError, RequiredMark } from '../components/FormValidation'
import { scrollToFirstInvalidField } from '../utils/formValidation'


function Login() {
  const [formData, setFormData] = useState({ identifier: '', password: '' })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [fieldErrors, setFieldErrors] = useState({})
  const navigate = useNavigate()

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
    setFieldErrors((current) => ({ ...current, [e.target.name]: undefined }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    const nextErrors = {}
    if (!formData.identifier.trim()) nextErrors.identifier = 'Please enter your email or username.'
    if (!formData.password) nextErrors.password = 'Please enter your password.'
    if (Object.keys(nextErrors).length) { setFieldErrors(nextErrors); scrollToFirstInvalidField(Object.keys(nextErrors)); return }
    setFieldErrors({})
    setSubmitting(true)

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.message)
        setSubmitting(false)
        return
      }

      localStorage.setItem('token', data.token)
      localStorage.setItem('userId', data.userId)
      localStorage.setItem('username', data.username)

      navigate('/dashboard')
    } catch {
      setError('Cannot connect to server. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#fbf8f3] text-gray-900">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_18%,rgba(251,146,60,0.13),transparent_28%),radial-gradient(circle_at_72%_75%,rgba(253,186,116,0.11),transparent_31%),linear-gradient(115deg,rgba(255,255,255,.78),rgba(255,247,237,.34))]" />

      {/* Nav */}
      <nav className="relative z-10 mx-auto flex max-w-[1440px] items-center justify-between gap-3 px-5 py-5 sm:px-8 lg:px-10">
        <Link to="/" className="text-xl font-bold tracking-tight text-gray-900">
          Learn<span className="text-orange-500">Match</span>
        </Link>
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline text-sm text-gray-400">No account?</span>
          <Link
            to="/register"
            className="rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-orange-100 transition duration-150 hover:bg-orange-600 active:translate-y-px"
          >
            Get Started
          </Link>
        </div>
      </nav>

      {/* Split layout */}
      <main className="relative z-0 mx-auto grid max-w-[1380px] items-center gap-8 px-5 pb-10 pt-3 sm:px-8 sm:pb-14 sm:pt-6 lg:min-h-[calc(100vh-84px)] lg:grid-cols-[minmax(380px,0.82fr)_minmax(500px,1.18fr)] lg:gap-10 lg:px-10 lg:py-8 xl:gap-16">

        {/* Left side — form */}
        <section className="relative mx-auto w-full max-w-[500px] overflow-hidden rounded-[28px] border border-white/90 bg-white/72 px-6 py-8 shadow-[0_24px_70px_-42px_rgba(120,53,15,.42)] backdrop-blur-xl sm:px-9 sm:py-10 lg:mx-0 lg:px-10 lg:py-11">
          <div className="absolute inset-y-10 left-0 w-1 rounded-r-full bg-gradient-to-b from-orange-400 via-orange-500 to-amber-300" />
          <div className="inline-flex items-center gap-2 bg-orange-50 text-orange-600 text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
            <span className="w-1.5 h-1.5 bg-orange-500 rounded-full" />
            Welcome back
          </div>

          <h1 className="mb-3 text-3xl font-bold leading-[1.12] tracking-[-0.025em] text-gray-900 sm:text-[2.5rem]">
            Log in to LearnMatch
          </h1>
          <p className="text-base text-gray-500 leading-relaxed mb-8">
            Continue where you left off and explore your next steps.
          </p>

          {error && (
            <div role="alert" className="mb-6 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div className="group/field" data-validation-field="identifier">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email or Username <RequiredMark />
              </label>
              <input
                type="text"
                name="identifier"
                value={formData.identifier}
                onChange={handleChange}
                className="w-full rounded-2xl border border-stone-200/90 bg-white/85 px-4 py-3.5 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,.8)] outline-none transition duration-150 hover:border-orange-200 focus:border-orange-400 focus:bg-white focus:ring-4 focus:ring-orange-100/80"
                required
                aria-required="true"
                aria-invalid={fieldErrors.identifier ? 'true' : undefined}
                aria-describedby={fieldErrors.identifier ? 'login-identifier-error' : undefined}
              />
              <FieldError id="login-identifier-error">{fieldErrors.identifier}</FieldError>
            </div>

             <div data-validation-field="password">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Password <RequiredMark />
                </label>
                <Link to="/forgot-password" className="text-sm text-orange-500 font-medium hover:underline">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full rounded-2xl border border-stone-200/90 bg-white/85 px-4 py-3.5 pr-11 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,.8)] outline-none transition duration-150 hover:border-orange-200 focus:border-orange-400 focus:bg-white focus:ring-4 focus:ring-orange-100/80"
                  required
                  minLength={8}
                  aria-required="true"
                  aria-invalid={fieldErrors.password ? 'true' : undefined}
                  aria-describedby={fieldErrors.password ? 'login-password-error' : undefined}
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
              <FieldError id="login-password-error">{fieldErrors.password}</FieldError>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-orange-600 py-3.5 text-sm font-semibold text-white shadow-[0_12px_28px_-12px_rgba(234,88,12,.8)] transition duration-150 hover:-translate-y-0.5 hover:shadow-[0_16px_32px_-12px_rgba(234,88,12,.72)] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? 'Logging in...' : 'Log In'}
              {!submitting && (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              )}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            No account yet?{' '}
            <Link to="/register" className="text-orange-500 font-medium hover:underline">
              Register
            </Link>
          </p>
        </section>

        <AuthJourneyPanel heading="Welcome back." supportingText="Pick up where you left off and keep building your path." />
      </main>
    </div>
  )
}

export default Login
