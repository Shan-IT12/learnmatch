import { useEffect, useState } from 'react'
import {
  IconArrowLeft,
  IconArrowRight,
  IconCheck,
  IconClock,
  IconEye,
  IconEyeOff,
  IconKey,
  IconLock,
  IconMail,
  IconShieldCheck,
} from '@tabler/icons-react'
import { Link, useNavigate } from 'react-router-dom'

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

const passwordValidationError = (password) => {
  if (password.length < 8) return 'Password must be at least 8 characters'
  if (!/[A-Z]/.test(password)) return 'Password must include at least one uppercase letter'
  if (!/[0-9]/.test(password)) return 'Password must include at least one number'
  return null
}

function ForgotPassword() {
  const navigate = useNavigate()
  const [step, setStep] = useState('email')
  const [email, setEmail] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [resetToken, setResetToken] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (step !== 'success') return undefined
    const timeout = setTimeout(() => navigate('/login'), 2000)
    return () => clearTimeout(timeout)
  }, [navigate, step])

  const requestOtp = async (event) => {
    event?.preventDefault()
    setError('')
    setMessage('')

    const normalizedEmail = email.trim().toLowerCase()
    if (!isValidEmail(normalizedEmail)) {
      setError('Please enter a valid email address')
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail }),
      })
      const data = await response.json()

      if (!response.ok) {
        setError(data.message || 'Unable to send a verification code. Please try again.')
        return
      }

      setEmail(normalizedEmail)
      setOtpCode('')
      setMessage(data.message)
      setStep('otp')
    } catch {
      setError('Cannot connect to server. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const verifyOtp = async (event) => {
    event.preventDefault()
    setError('')
    setMessage('')

    if (!/^\d{6}$/.test(otpCode)) {
      setError('Please enter the 6-digit code')
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/forgot-password/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otpCode }),
      })
      const data = await response.json()

      if (!response.ok) {
        setError(data.message || 'Unable to verify the code. Please try again.')
        return
      }

      setResetToken(data.resetToken)
      setStep('password')
    } catch {
      setError('Cannot connect to server. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const submitPassword = async (event) => {
    event.preventDefault()
    setError('')

    const validationError = passwordValidationError(password)
    if (validationError) {
      setError(validationError)
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/forgot-password/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resetToken, password, confirmPassword }),
      })
      const data = await response.json()

      if (!response.ok) {
        setError(data.message || 'Unable to reset the password. Please try again.')
        return
      }

      setResetToken('')
      setPassword('')
      setConfirmPassword('')
      setStep('success')
    } catch {
      setError('Cannot connect to server. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#fbf8f3] text-gray-900">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_18%,rgba(251,146,60,0.13),transparent_28%),radial-gradient(circle_at_72%_100%,rgba(253,186,116,0.12),transparent_30%),linear-gradient(115deg,rgba(255,255,255,.78),rgba(255,247,237,.34))]" />
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .recovery-fade { animation: none !important; }
        }
      `}</style>

      <nav className="relative z-10 mx-auto flex max-w-[1440px] items-center justify-between gap-3 px-5 py-5 sm:px-8 lg:px-10">
        <Link to="/" className="text-xl font-bold tracking-tight text-gray-900">
          Learn<span className="text-orange-500">Match</span>
        </Link>
        <Link to="/login" className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition duration-150 hover:border-orange-200 hover:bg-orange-50 hover:text-orange-700 active:translate-y-px">
          <IconArrowLeft size={16} stroke={2} /> Back to Login
        </Link>
      </nav>

      <main className="relative z-0 mx-auto grid max-w-[1380px] items-center gap-8 px-5 pb-10 pt-3 sm:px-8 sm:pb-14 sm:pt-6 lg:min-h-[calc(100vh-84px)] lg:grid-cols-[minmax(390px,.82fr)_minmax(500px,1.18fr)] lg:gap-10 lg:px-10 lg:py-8 xl:gap-16">
        <section className="recovery-fade relative mx-auto w-full max-w-[510px] overflow-hidden rounded-[28px] border border-white/90 bg-white/72 px-6 py-8 shadow-[0_24px_70px_-42px_rgba(120,53,15,.42)] backdrop-blur-xl sm:px-9 sm:py-10 lg:mx-0 lg:px-10 lg:py-11" style={{ animation: 'fadeIn 0.3s ease-out' }}>
          <div className="absolute inset-y-10 left-0 w-1 rounded-r-full bg-gradient-to-b from-orange-400 via-orange-500 to-amber-300" />
          {step !== 'success' && (
            <>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-orange-100 bg-orange-50 px-3 py-1.5 text-xs font-semibold text-orange-600">
                <span className="w-1.5 h-1.5 bg-orange-500 rounded-full" />
                Password recovery
              </div>

              <h1 className="mb-3 text-3xl font-bold leading-[1.12] tracking-[-0.025em] text-gray-900 sm:text-[2.5rem]">
                {step === 'email' && 'Forgot your password?'}
                {step === 'otp' && 'Check your email'}
                {step === 'password' && 'Create a new password'}
              </h1>
              <p className="text-base text-gray-500 leading-relaxed mb-8">
                {step === 'email' && 'Enter the email address registered with your LearnMatch account.'}
                {step === 'otp' && `Enter the 6-digit verification code sent to ${email}.`}
                {step === 'password' && 'Choose a secure password for your LearnMatch account.'}
              </p>
            </>
          )}

          {error && <div role="alert" className="mb-6 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}
          {message && step === 'otp' && <div role="status" className="mb-6 rounded-xl border border-green-100 bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div>}

          {step === 'email' && (
            <form onSubmit={requestOtp} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <div className="relative">
                  <IconMail className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} stroke={1.8} />
                  <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-2xl border border-stone-200/90 bg-white/85 py-3.5 pl-11 pr-4 text-sm outline-none transition duration-150 hover:border-orange-200 focus:border-orange-400 focus:bg-white focus:ring-4 focus:ring-orange-100/80" autoComplete="email" required autoFocus />
                </div>
              </div>
              <button type="submit" disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-orange-600 py-3.5 text-sm font-semibold text-white shadow-[0_12px_28px_-12px_rgba(234,88,12,.8)] transition duration-150 hover:-translate-y-0.5 hover:shadow-[0_16px_32px_-12px_rgba(234,88,12,.72)] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50">
                {loading ? 'Sending...' : 'Send Verification Code'}
                {!loading && <IconArrowRight size={17} stroke={2} />}
              </button>
            </form>
          )}

          {step === 'otp' && (
            <form onSubmit={verifyOtp} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Verification Code</label>
                <input type="text" inputMode="numeric" maxLength={6} value={otpCode} onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, ''))} placeholder="000000" className="w-full rounded-2xl border border-stone-200/90 bg-white/85 px-3 py-3.5 text-center text-xl font-bold tracking-[0.3em] outline-none transition duration-150 hover:border-orange-200 focus:border-orange-400 focus:bg-white focus:ring-4 focus:ring-orange-100/80 sm:px-4 sm:text-2xl sm:tracking-[0.5em]" required autoFocus />
              </div>
              <div className="flex items-center justify-center gap-1.5 text-xs text-gray-500"><IconClock size={14} /> Code expires after 10 minutes</div>
              <button type="submit" disabled={loading || otpCode.length !== 6} className="w-full rounded-2xl bg-gradient-to-r from-orange-500 to-orange-600 py-3.5 text-sm font-semibold text-white shadow-[0_12px_28px_-12px_rgba(234,88,12,.8)] transition duration-150 hover:-translate-y-0.5 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50">
                {loading ? 'Verifying...' : 'Verify Code'}
              </button>
              <p className="text-center text-sm text-gray-500">
                Didn't get the code?{' '}
                <button type="button" onClick={requestOtp} disabled={loading} className="text-orange-500 font-medium hover:underline disabled:opacity-50">
                  Resend Code
                </button>
              </p>
            </form>
          )}

          {step === 'password' && (
            <form onSubmit={submitPassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">New Password</label>
                <div className="relative">
                  <input type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-2xl border border-stone-200/90 bg-white/85 px-4 py-3.5 pr-11 text-sm outline-none transition duration-150 hover:border-orange-200 focus:border-orange-400 focus:bg-white focus:ring-4 focus:ring-orange-100/80" autoComplete="new-password" minLength={8} required />
                  <button type="button" onClick={() => setShowPassword((current) => !current)} className="absolute right-1 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-gray-400 transition duration-150 hover:bg-gray-50 hover:text-gray-600 active:scale-95" aria-label={showPassword ? 'Hide new password' : 'Show new password'}>
                    {showPassword ? <IconEyeOff size={18} stroke={1.75} /> : <IconEye size={18} stroke={1.75} />}
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-1.5">At least 8 characters, with 1 uppercase letter and 1 number</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Confirm Password</label>
                <div className="relative">
                  <input type={showConfirmPassword ? 'text' : 'password'} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="w-full rounded-2xl border border-stone-200/90 bg-white/85 px-4 py-3.5 pr-11 text-sm outline-none transition duration-150 hover:border-orange-200 focus:border-orange-400 focus:bg-white focus:ring-4 focus:ring-orange-100/80" autoComplete="new-password" minLength={8} required />
                  <button type="button" onClick={() => setShowConfirmPassword((current) => !current)} className="absolute right-1 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-gray-400 transition duration-150 hover:bg-gray-50 hover:text-gray-600 active:scale-95" aria-label={showConfirmPassword ? 'Hide password confirmation' : 'Show password confirmation'}>
                    {showConfirmPassword ? <IconEyeOff size={18} stroke={1.75} /> : <IconEye size={18} stroke={1.75} />}
                  </button>
                </div>
              </div>
              <button type="submit" disabled={loading} className="w-full rounded-2xl bg-gradient-to-r from-orange-500 to-orange-600 py-3.5 text-sm font-semibold text-white shadow-[0_12px_28px_-12px_rgba(234,88,12,.8)] transition duration-150 hover:-translate-y-0.5 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50">
                {loading ? 'Resetting Password...' : 'Reset Password'}
              </button>
            </form>
          )}

          {step === 'success' && (
            <div className="py-2 text-center">
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-green-100 bg-green-50 text-green-600 shadow-sm">
                <IconCheck size={32} stroke={2} />
              </div>
              <div className="mb-3 text-xs font-bold uppercase tracking-[0.17em] text-green-600">Password updated</div>
              <h1 className="mb-3 text-3xl font-bold tracking-tight text-gray-900">Password reset!</h1>
              <p className="mb-6 text-base text-gray-500">You can now log in using your new password. Redirecting you to Login...</p>
              <Link to="/login" className="inline-flex items-center gap-2 rounded-2xl bg-orange-500 px-6 py-3 text-sm font-semibold text-white shadow-[0_12px_28px_-12px_rgba(234,88,12,.8)] transition duration-150 hover:-translate-y-0.5 hover:bg-orange-600 active:translate-y-0">Return to Login <IconArrowRight size={17} /></Link>
            </div>
          )}
        </section>

        <aside className="group relative isolate min-h-[300px] overflow-hidden rounded-[30px] border border-orange-300/35 bg-[linear-gradient(145deg,#fb923c_0%,#f97316_46%,#dc5b16_100%)] p-6 text-white shadow-[0_28px_80px_-34px_rgba(194,65,12,.6)] sm:min-h-[360px] sm:p-8 lg:min-h-[600px] lg:p-10 xl:p-12">
          <div className="pointer-events-none absolute inset-0 opacity-25 [background-image:linear-gradient(rgba(255,255,255,.16)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.16)_1px,transparent_1px)] [background-size:42px_42px] [mask-image:linear-gradient(to_bottom,black,transparent_78%)]" />
          <div className="pointer-events-none absolute -right-24 top-16 h-64 w-64 rounded-full bg-amber-200/25 blur-3xl" />
          <div className="relative z-10 max-w-md">
            <div className="mb-4 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-orange-100"><span className="h-px w-7 bg-orange-100/75" /> Secure account recovery</div>
            <h2 className="text-3xl font-bold leading-[1.08] tracking-[-0.025em] sm:text-4xl">Get back on track.</h2>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-orange-50/90 sm:text-base">Reset your password securely and return to LearnMatch.</p>
          </div>

          <div className="relative z-10 mt-8 h-[190px] sm:h-[225px] lg:mt-14 lg:h-[300px]">
            <svg aria-hidden="true" viewBox="0 0 520 300" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full">
              <path d="M70 72 C165 15 183 158 272 143 S382 234 458 195" fill="none" stroke="rgba(255,255,255,.55)" strokeWidth="2" strokeDasharray="5 10" />
              <circle cx="70" cy="72" r="5" fill="#fff" /><circle cx="272" cy="143" r="5" fill="#fff" /><circle cx="458" cy="195" r="7" fill="#fed7aa" />
            </svg>
            <div className="absolute left-[2%] top-[5%] flex items-center gap-2 rounded-full border border-white/30 bg-white/20 px-3 py-2 text-xs font-semibold backdrop-blur-lg sm:px-4"><IconMail size={17} /> Email</div>
            <div className="absolute left-[35%] top-[31%] flex h-24 w-24 items-center justify-center rounded-[28px] border border-white/50 bg-white/92 text-orange-600 shadow-[0_18px_42px_-22px_rgba(124,45,18,.65)] transition duration-200 motion-safe:group-hover:-translate-y-1 sm:h-28 sm:w-28">
              <IconLock size={43} stroke={1.5} />
              <span className="absolute -right-2 -top-2 flex h-9 w-9 items-center justify-center rounded-full bg-orange-950 text-orange-200"><IconKey size={18} /></span>
            </div>
            <div className="absolute bottom-[4%] right-[1%] flex items-center gap-2 rounded-2xl border border-white/30 bg-orange-950/85 px-4 py-3 text-xs font-semibold shadow-lg backdrop-blur-lg"><IconShieldCheck size={19} className="text-orange-300" /> Verified return</div>
          </div>

          <div className="relative z-10 flex items-center gap-3 rounded-2xl border border-white/25 bg-white/15 px-4 py-3 text-sm text-orange-50 backdrop-blur-lg">
            <IconClock className="shrink-0 text-orange-200" size={19} />
            <span>Verification codes expire after <strong className="text-white">10 minutes</strong>.</span>
          </div>
        </aside>
      </main>
    </div>
  )
}

export default ForgotPassword
