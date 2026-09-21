import { useEffect, useState } from 'react'
import { IconEye, IconEyeOff } from '@tabler/icons-react'
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
    <div className="min-h-screen bg-white overflow-hidden">
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <nav className="flex justify-between items-center px-10 py-5">
        <Link to="/" className="text-xl font-bold tracking-tight text-gray-900">
          Learn<span className="text-orange-500">Match</span>
        </Link>
        <Link to="/login" className="text-sm text-gray-700 px-4 py-2.5 rounded-lg hover:bg-gray-50 transition font-medium">
          Back to Login
        </Link>
      </nav>

      <div className="max-w-7xl mx-auto px-10 pt-8 pb-16 grid grid-cols-2 gap-16 items-center min-h-[calc(100vh-80px)]">
        <div className="max-w-md w-full" style={{ animation: 'fadeIn 0.3s ease-out' }}>
          {step !== 'success' && (
            <>
              <div className="inline-flex items-center gap-2 bg-orange-50 text-orange-600 text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
                <span className="w-1.5 h-1.5 bg-orange-500 rounded-full" />
                Password recovery
              </div>

              <h1 className="text-4xl font-bold text-gray-900 leading-tight mb-3">
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

          {error && <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm mb-6">{error}</div>}
          {message && step === 'otp' && <div className="bg-green-50 text-green-700 px-4 py-3 rounded-xl text-sm mb-6">{message}</div>}

          {step === 'email' && (
            <form onSubmit={requestOtp} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" autoComplete="email" required autoFocus />
              </div>
              <button type="submit" disabled={loading} className="w-full bg-orange-500 text-white py-3 rounded-xl font-medium hover:bg-orange-600 transition text-sm disabled:opacity-50">
                {loading ? 'Sending...' : 'Send Verification Code'}
              </button>
            </form>
          )}

          {step === 'otp' && (
            <form onSubmit={verifyOtp} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Verification Code</label>
                <input type="text" inputMode="numeric" maxLength={6} value={otpCode} onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, ''))} placeholder="000000" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-center text-2xl font-bold tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-orange-400" required autoFocus />
              </div>
              <button type="submit" disabled={loading || otpCode.length !== 6} className="w-full bg-orange-500 text-white py-3 rounded-xl font-medium hover:bg-orange-600 transition text-sm disabled:opacity-50">
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
                  <input type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-3 pr-11 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" autoComplete="new-password" minLength={8} required />
                  <button type="button" onClick={() => setShowPassword((current) => !current)} className="absolute right-1 top-1/2 -translate-y-1/2 w-10 h-10 inline-flex items-center justify-center text-gray-400 hover:text-gray-600 transition" aria-label={showPassword ? 'Hide new password' : 'Show new password'}>
                    {showPassword ? <IconEyeOff size={18} stroke={1.75} /> : <IconEye size={18} stroke={1.75} />}
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-1.5">At least 8 characters, with 1 uppercase letter and 1 number</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Confirm Password</label>
                <div className="relative">
                  <input type={showConfirmPassword ? 'text' : 'password'} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-3 pr-11 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" autoComplete="new-password" minLength={8} required />
                  <button type="button" onClick={() => setShowConfirmPassword((current) => !current)} className="absolute right-1 top-1/2 -translate-y-1/2 w-10 h-10 inline-flex items-center justify-center text-gray-400 hover:text-gray-600 transition" aria-label={showConfirmPassword ? 'Hide password confirmation' : 'Show password confirmation'}>
                    {showConfirmPassword ? <IconEyeOff size={18} stroke={1.75} /> : <IconEye size={18} stroke={1.75} />}
                  </button>
                </div>
              </div>
              <button type="submit" disabled={loading} className="w-full bg-orange-500 text-white py-3 rounded-xl font-medium hover:bg-orange-600 transition text-sm disabled:opacity-50">
                {loading ? 'Resetting Password...' : 'Reset Password'}
              </button>
            </form>
          )}

          {step === 'success' && (
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mb-6 mx-auto">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-3">Password reset!</h1>
              <p className="text-base text-gray-500 mb-6">Your password has been updated. Redirecting you to Login...</p>
              <Link to="/login" className="inline-flex bg-orange-500 text-white px-6 py-3 rounded-xl font-medium hover:bg-orange-600 transition text-sm">Return to Login</Link>
            </div>
          )}
        </div>

        <div className="relative h-[500px] rounded-[32px] overflow-hidden flex flex-col justify-between p-10" style={{ background: 'linear-gradient(150deg, #fb923c 0%, #f97316 55%, #ea580c 100%)' }}>
          <svg width="280" height="280" viewBox="0 0 280 280" className="absolute -top-16 -right-16 opacity-25"><circle cx="140" cy="140" r="120" fill="none" stroke="#fff" strokeWidth="1.5" /><circle cx="140" cy="140" r="80" fill="none" stroke="#fff" strokeWidth="1.5" /></svg>
          <div className="relative">
            <h2 className="text-3xl font-bold text-white leading-tight mb-3">Get back on track.</h2>
            <p className="text-sm text-orange-50 leading-relaxed max-w-xs">Securely reset your password and continue exploring the courses that fit you.</p>
          </div>
          <div className="relative bg-white rounded-2xl shadow-lg px-5 py-4 w-64 border border-orange-100">
            <p className="text-xs font-semibold text-orange-500 uppercase tracking-wide mb-2">Secure recovery</p>
            <p className="text-sm font-semibold text-gray-800">Verification codes expire after 10 minutes.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ForgotPassword
