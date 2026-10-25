import { useEffect, useRef, useState } from 'react'
import { scrollToFirstInvalidField } from '../utils/formValidation'
import useResendCountdown from './useResendCountdown'

// Shared by public recovery and inline Settings. The existing server endpoints
// still own OTP verification, password policy, hashing and one-time token use.
export default function usePasswordRecovery({ initialEmail = '', fieldPrefix = 'forgot', resendCooldownSeconds = 0, lastCodeRequestedAt = 0, onCodeRequested } = {}) {
  const cooldownDeadline = lastCodeRequestedAt ? lastCodeRequestedAt + resendCooldownSeconds * 1000 : 0
  const [step, setStep] = useState(() => initialEmail && cooldownDeadline > Date.now() ? 'otp' : 'email')
  const resendSecondsRemaining = useResendCountdown(cooldownDeadline)
  const [email, setEmail] = useState(initialEmail)
  const [otpCode, setOtpCode] = useState('')
  const [resetToken, setResetToken] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [fieldErrors, setFieldErrors] = useState({})
  const request = useRef(null)
  const generation = useRef(0)
  useEffect(() => () => { generation.current++; request.current?.abort() }, [])

  const showErrors = errors => {
    setFieldErrors(errors)
    scrollToFirstInvalidField(Object.keys(errors).map(key => `${fieldPrefix}${key === 'otpCode' ? 'Otp' : key[0].toUpperCase() + key.slice(1)}`))
  }
  const send = async (path, body, fallback, success) => {
    if (request.current) return
    const controller = new AbortController()
    const token = ++generation.current
    request.current = controller
    const timeout = setTimeout(() => controller.abort(), 20000)
    setLoading(true)
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/auth/forgot-password${path}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body), signal: controller.signal,
      })
      const data = await response.json()
      if (generation.current !== token) return
      if (!response.ok) { setError(data.message || fallback); return }
      success(data)
    } catch {
      if (generation.current === token) setError('Cannot connect to server. Please try again.')
    } finally {
      clearTimeout(timeout)
      if (generation.current === token) { request.current = null; setLoading(false) }
    }
  }
  const requestOtp = async event => {
    event?.preventDefault()
    if (request.current || Date.now() < cooldownDeadline) return
    setError(''); setMessage('')
    const normalizedEmail = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      showErrors({ email: normalizedEmail ? 'Please enter a valid email address.' : 'Please enter your email address.' }); return
    }
    setFieldErrors({})
    await send('', { email: normalizedEmail }, 'Unable to send a verification code. Please try again.', data => {
      const requestedAt = Date.now()
      onCodeRequested?.(requestedAt)
      setEmail(normalizedEmail); setOtpCode(''); setResetToken(''); setMessage(data.message || 'Check your email for a verification code.'); setStep('otp')
    })
  }
  const verifyOtp = async event => {
    event.preventDefault()
    if (request.current) return
    setError(''); setMessage('')
    if (!/^\d{6}$/.test(otpCode)) { showErrors({ otpCode: 'Please enter the 6-digit code.' }); return }
    setFieldErrors({})
    await send('/verify', { email, otpCode }, 'Unable to verify the code. Please try again.', data => {
      if (typeof data.resetToken !== 'string' || !data.resetToken) { setError('Unable to verify the code. Please try again.'); return }
      setResetToken(data.resetToken); setOtpCode(''); setStep('password')
    })
  }
  const submitPassword = async event => {
    event.preventDefault()
    if (request.current) return
    setError('')
    const errors = {}
    if (!password) errors.password = 'Please enter a new password.'
    else if (password.length < 8) errors.password = 'Password must be at least 8 characters'
    else if (!/[A-Z]/.test(password)) errors.password = 'Password must include at least one uppercase letter'
    else if (!/[0-9]/.test(password)) errors.password = 'Password must include at least one number'
    if (!confirmPassword) errors.confirmPassword = 'Please confirm your new password.'
    else if (password !== confirmPassword) errors.confirmPassword = 'Passwords do not match.'
    if (Object.keys(errors).length) { showErrors(errors); return }
    setFieldErrors({})
    await send('/reset', { resetToken, password, confirmPassword }, 'Unable to reset the password. Please try again.', () => {
      setResetToken(''); setPassword(''); setConfirmPassword(''); setStep('success')
    })
  }
  return { step, email, setEmail, otpCode, setOtpCode, password, setPassword, confirmPassword, setConfirmPassword,
    error, message, loading, fieldErrors, setFieldErrors, requestOtp, verifyOtp, submitPassword, resendSecondsRemaining }
}
