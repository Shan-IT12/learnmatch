import { useState } from 'react'
import { IconEye, IconEyeOff } from '@tabler/icons-react'
import { FieldError, RequiredMark } from './FormValidation'
import usePasswordRecovery from '../hooks/usePasswordRecovery'

const inputClass = 'mt-1.5 block min-h-11 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm focus:border-orange-500 focus:outline-orange-500 disabled:opacity-60'
const primaryClass = 'inline-flex min-h-11 items-center justify-center rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500 disabled:cursor-wait disabled:opacity-60'

export default function SettingsPasswordForm({ email: registeredEmail, lastCodeRequestedAt, onCodeRequested, onClose }) {
  const { step, email, otpCode, setOtpCode, password, setPassword, confirmPassword, setConfirmPassword,
    error, loading, fieldErrors, setFieldErrors, requestOtp, verifyOtp, submitPassword, resendSecondsRemaining } = usePasswordRecovery({ initialEmail: registeredEmail, fieldPrefix: 'settings', resendCooldownSeconds: 60, lastCodeRequestedAt, onCodeRequested })
  const [visible, setVisible] = useState({})
  return <div id="settings-password-form" className="mt-3 border-t border-gray-100 pt-3">
    {error && <p role="alert" className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
    {step === 'success' ? <div>
      <p role="status" className="text-sm font-semibold text-green-700">Your password has been changed successfully.</p>
      <button type="button" className="lm-action mt-3" onClick={onClose}>Done</button>
    </div> : <form noValidate onSubmit={step === 'email' ? requestOtp : step === 'otp' ? verifyOtp : submitPassword} aria-busy={loading}>
      {step === 'email' && <p className="mb-3 break-words text-sm text-gray-600">Send a verification code to <strong className="break-all font-semibold text-gray-900">{email}</strong>.</p>}
      {step === 'otp' && <div className="max-w-sm" data-validation-field="settingsOtp">
        <p role="status" className="mb-2 text-sm leading-5 text-green-700">Check your registered email for the verification code. It may take a moment to arrive.</p>
        <label htmlFor="settings-otp" className="text-sm font-semibold text-gray-700">Verification code <RequiredMark /></label>
        <input id="settings-otp" className={inputClass} autoComplete="one-time-code" inputMode="numeric" maxLength={6} placeholder="000000" value={otpCode} disabled={loading} autoFocus required aria-required="true"
          onChange={event => { setOtpCode(event.target.value.replace(/\D/g, '')); setFieldErrors(current => ({ ...current, otpCode: undefined })) }} aria-invalid={!!fieldErrors.otpCode} aria-describedby={fieldErrors.otpCode ? 'settings-otp-error' : undefined} />
        <FieldError id="settings-otp-error">{fieldErrors.otpCode}</FieldError>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-gray-500">
          <p>The code expires after 10 minutes.</p>
          <button type="button" disabled={loading || resendSecondsRemaining > 0} className="min-h-11 rounded-lg font-semibold text-orange-700 hover:text-orange-900 focus-visible:outline-2 focus-visible:outline-orange-500 disabled:cursor-not-allowed disabled:text-gray-500" onClick={requestOtp}>{resendSecondsRemaining > 0 ? `Resend code in ${resendSecondsRemaining}s` : 'Resend code'}</button>
        </div>
      </div>}
      {step === 'password' && <div className="grid gap-3 sm:grid-cols-2">
        {[['password', 'New password', password, setPassword], ['confirmPassword', 'Confirm password', confirmPassword, setConfirmPassword]].map(([key, label, value, setter]) => <div key={key} className="min-w-0" data-validation-field={`settings${key[0].toUpperCase()}${key.slice(1)}`}>
          <label htmlFor={`settings-change-${key}`} className="text-sm font-semibold text-gray-700">{label} <RequiredMark /></label>
          <div className="relative">
            <input id={`settings-change-${key}`} className={`${inputClass} pr-12`} type={visible[key] ? 'text' : 'password'} value={value} autoComplete="new-password" disabled={loading} maxLength={1024} required aria-required="true"
              onChange={event => { setter(event.target.value); setFieldErrors(current => ({ ...current, [key]: undefined })) }} aria-invalid={!!fieldErrors[key]} aria-describedby={fieldErrors[key] ? `settings-${key}-error` : key === 'password' ? 'settings-password-help' : undefined} />
            <button type="button" disabled={loading} onClick={() => setVisible(current => ({ ...current, [key]: !current[key] }))} aria-label={`${visible[key] ? 'Hide' : 'Show'} ${label.toLowerCase()}`} aria-pressed={!!visible[key]} className="absolute right-1 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-lg text-gray-500 hover:bg-orange-50 focus-visible:outline-2 focus-visible:outline-orange-500">
              {visible[key] ? <IconEyeOff size={18} /> : <IconEye size={18} />}
            </button>
          </div>
          <FieldError id={`settings-${key}-error`}>{fieldErrors[key]}</FieldError>
          {key === 'password' && <p id="settings-password-help" className="mt-1 text-xs text-gray-500">At least 8 characters, with 1 uppercase letter and 1 number.</p>}
        </div>)}
      </div>}
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="submit" className={primaryClass} disabled={loading || (step === 'otp' && otpCode.length !== 6)}>{loading ? 'Processing...' : step === 'email' ? 'Send Verification Code' : step === 'otp' ? 'Verify Code' : 'Update Password'}</button>
        <button type="button" className="lm-action" disabled={loading} onClick={onClose}>Cancel</button>
      </div>
    </form>}
  </div>
}
