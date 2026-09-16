import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { IconEye, IconEyeOff, IconShieldLock } from '@tabler/icons-react'

function AdminLogin() {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({ username: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.message || 'Invalid credentials')
        setSubmitting(false)
        return
      }

      localStorage.setItem('adminToken', data.token)
      localStorage.setItem('adminUsername', data.username)
      navigate('/admin')
    } catch {
      setError('Cannot connect to server. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-orange-50/40 flex items-center justify-center px-5 py-10 sm:px-6">
      <div className="w-full max-w-md">

        <div className="flex flex-col items-center mb-7 text-center">
          <div className="w-12 h-12 rounded-2xl bg-orange-50 border border-orange-100 flex items-center justify-center mb-4 shadow-sm">
            <IconShieldLock size={22} stroke={1.75} className="text-orange-500" />
          </div>
          <span className="text-xl font-bold text-gray-900">
            Learn<span className="text-orange-500">Match</span>
          </span>
          <p className="text-xs text-orange-600 mt-1 font-semibold tracking-widest uppercase">Admin Portal</p>
        </div>

        <div className="bg-white border border-orange-100 rounded-2xl p-6 sm:p-8 shadow-sm">
          <h1 className="text-2xl font-bold text-gray-900 text-center">Welcome back, Admin</h1>
          <p className="text-sm text-gray-500 text-center mt-2 mb-7">Sign in to manage the LearnMatch system.</p>
          {error && (
            <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl text-sm mb-6" role="alert">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">
                Username
              </label>
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleChange}
                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                required
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 pr-11 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 w-10 h-10 inline-flex items-center justify-center text-gray-400 hover:text-gray-700 transition focus:outline-none focus:ring-2 focus:ring-orange-500 rounded"
                  tabIndex={-1}
                >
                  {showPassword ? <IconEyeOff size={18} stroke={1.75} /> : <IconEye size={18} stroke={1.75} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-orange-500 text-white py-3 rounded-xl font-medium hover:bg-orange-600 transition text-sm disabled:opacity-50 mt-2"
            >
              {submitting ? 'Signing in...' : 'Log In'}
            </button>
          </form>
        </div>

        <div className="text-center mt-6">
          <Link
            to="/"
            className="text-sm text-gray-500 hover:text-orange-600 transition focus:outline-none focus:ring-2 focus:ring-orange-500 rounded"
          >
            ← Back to LearnMatch
          </Link>
          <p className="text-xs text-gray-400 mt-4">Restricted access — LearnMatch personnel only</p>
        </div>
      </div>
    </div>
  )
}

export default AdminLogin
