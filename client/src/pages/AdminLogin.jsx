import StaffAccessLayout from '../components/StaffAccessLayout'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { IconEye, IconEyeOff } from '@tabler/icons-react'
import { FieldError, RequiredMark } from '../components/FormValidation'
import { RequiredFieldsNote, WorkflowFeedback, workflowInput } from '../components/CourseValidationForms'
import { scrollToFirstInvalidField } from '../utils/formValidation'

function AdminLogin() {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({ username: '', password: '' })
  const [legacy, setLegacy] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [fieldErrors, setFieldErrors] = useState({})

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
    setFieldErrors((current) => ({ ...current, [e.target.name]: undefined }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    const nextErrors = {}
    if (!formData.username.trim()) nextErrors.username = legacy ? 'Enter your existing username.' : 'Enter your Administrator email.'
    if (!formData.password) nextErrors.password = 'Please enter your password.'
    if (Object.keys(nextErrors).length) { setFieldErrors(nextErrors); scrollToFirstInvalidField(Object.keys(nextErrors)); return }
    setFieldErrors({})
    setSubmitting(true)

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(legacy ? formData : { email: formData.username, password: formData.password }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.message || 'Invalid credentials')
        setSubmitting(false)
        return
      }

      localStorage.setItem('adminToken', data.token)
      localStorage.setItem('adminUsername', data.username)
      localStorage.setItem('adminRole', data.role || 'system_developer')
      navigate('/admin')
    } catch {
      setError('Cannot connect to server. Please try again.')
      setSubmitting(false)
    }
  }

  return <StaffAccessLayout role="admin" title="Administrator sign-in" description="Sign in to manage validators, course reviews, and publication." footer={<>
    <Link to="/admin/account/forgot">Forgot password?</Link>
    <button type="button" onClick={() => { setLegacy(value => !value); setError(''); setFieldErrors({}) }}>{legacy ? 'Use email sign-in' : 'Use existing username'}</button>
  </>}>
    <WorkflowFeedback error={error} />
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <RequiredFieldsNote />
      <div data-validation-field="username">
        <label htmlFor="admin-identifier" className="block text-sm font-semibold text-slate-800">
          {legacy ? 'Existing username' : 'Email'} <RequiredMark />
        </label>
        <input
          type={legacy ? 'text' : 'email'}
          autoComplete="username"
          id="admin-identifier"
          name="username"
          value={formData.username}
          onChange={handleChange}
          className={workflowInput}
          required
          aria-invalid={fieldErrors.username ? 'true' : undefined}
          aria-describedby={fieldErrors.username ? 'admin-username-error' : undefined}
        />
        <FieldError id="admin-username-error">{fieldErrors.username}</FieldError>
      </div>
      <div data-validation-field="password">
        <label htmlFor="admin-password" className="block text-sm font-semibold text-slate-800">Password <RequiredMark /></label>
        <div className="relative mt-1.5">
          <input
            type={showPassword ? 'text' : 'password'}
            name="password"
            id="admin-password"
            autoComplete="current-password"
            value={formData.password}
            onChange={handleChange}
            className={`${workflowInput} !mt-0 pr-12`}
            required
            aria-invalid={fieldErrors.password ? 'true' : undefined}
            aria-describedby={fieldErrors.password ? 'admin-password-error' : undefined}
          />
          <button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'}
            onClick={() => setShowPassword(value => !value)}
            className="absolute inset-y-0 right-1 my-auto inline-flex size-10 items-center justify-center rounded-lg text-slate-600 hover:bg-orange-50 focus-visible:outline-2 focus-visible:outline-orange-600">
            {showPassword ? <IconEyeOff size={18} stroke={1.75} aria-hidden="true" /> : <IconEye size={18} stroke={1.75} aria-hidden="true" />}
          </button>
        </div>
        <FieldError id="admin-password-error">{fieldErrors.password}</FieldError>
      </div>
      <button type="submit" className="lm-action lm-action-selected min-h-11 w-full" disabled={submitting}>{submitting ? 'Signing in…' : 'Log In'}</button>
    </form>
    {legacy && <p className="rounded-xl border border-orange-100 bg-orange-50 p-3 text-xs leading-5 text-slate-700">Username access is available until your verified email is linked. Contact a platform operator to set it up.</p>}
  </StaffAccessLayout>
}

export default AdminLogin
