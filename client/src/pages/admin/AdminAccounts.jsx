import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  IconCheck, IconCopy, IconPlus, IconX,
} from '@tabler/icons-react'
import AdminHeader from '../../components/AdminHeader'
import { RequiredMark } from '../../components/FormValidation'
import SkeletonContent from '../../components/SkeletonContent'
import { ADMIN_ROLES, getRoleMeta, getStoredAdminRole } from '../../utils/adminRole'

const EMPTY_FORM = {
  first_name: '',
  last_name: '',
  username: '',
  email: '',
  role: ADMIN_ROLES.SYSTEM_ADMIN,
}

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function AdminAccounts() {
  const navigate = useNavigate()
  const adminToken = localStorage.getItem('adminToken')
  const currentRole = getStoredAdminRole()
  const isSystemDeveloper = currentRole === ADMIN_ROLES.SYSTEM_DEVELOPER

  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [modalError, setModalError] = useState('')
  const [generatedSetup, setGeneratedSetup] = useState(null)
  const [copiedSetup, setCopiedSetup] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    if (!adminToken) {
      navigate('/admin/login', { replace: true })
      return
    }
    const controller = new AbortController()
    const fetchAccounts = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/accounts`, {
          headers: { Authorization: `Bearer ${adminToken}` },
          signal: controller.signal,
        })
        if (response.status === 401) {
          localStorage.removeItem('adminToken')
          localStorage.removeItem('adminRole')
          navigate('/admin/login', { replace: true })
          return
        }
        const data = await response.json()
        if (!response.ok) {
          setError(data.message || 'Could not load admin accounts.')
          return
        }
        setAccounts(Array.isArray(data.accounts) ? data.accounts : [])
      } catch (requestError) {
        if (requestError.name !== 'AbortError') {
          setError('Cannot connect to server. Please try again.')
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    fetchAccounts()
    return () => controller.abort()
  }, [adminToken, navigate, refreshKey])

  const openCreateModal = () => {
    setForm({ ...EMPTY_FORM, role: ADMIN_ROLES.SYSTEM_ADMIN })
    setModalError('')
    setGeneratedSetup(null)
    setCopiedSetup(false)
    setModalOpen(true)
  }

  const closeModal = () => {
    if (submitting) return
    setModalOpen(false)
    setModalError('')
    setGeneratedSetup(null)
    setCopiedSetup(false)
  }

  const copySetupLink = async () => {
    if (!generatedSetup?.setupUrl) return
    try {
      await navigator.clipboard.writeText(generatedSetup.setupUrl)
      setCopiedSetup(true)
      setTimeout(() => setCopiedSetup(false), 2500)
    } catch {
      /* Clipboard unavailable. */
    }
  }

  const regenerateSetupLink = async (account) => {
    setError('')
    setSuccess('')
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/accounts/${account.admin_id}/setup-link`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
      })
      const data = await response.json()
      if (!response.ok) {
        setError(data.message || 'Could not generate a new setup link.')
        return
      }
      setGeneratedSetup({
        email: data.email || account.email,
        fullName: account.full_name,
        setupUrl: data.setupUrl,
        message: data.message,
      })
      setCopiedSetup(false)
      setModalOpen(true)
    } catch {
      setError('Cannot connect to server. Please try again.')
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setModalError('')
    setSuccess('')
    setSubmitting(true)
    try {
      const resolvedRole = isSystemDeveloper ? form.role : ADMIN_ROLES.SYSTEM_ADMIN
      const fullName = `${form.first_name.trim()} ${form.last_name.trim()}`.trim()
      const payload = {
        full_name: fullName,
        username: form.username,
        email: form.email,
        role: resolvedRole,
      }
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/accounts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify(payload),
      })
      const data = await response.json()
      if (!response.ok) {
        setModalError(data.message || 'Could not create admin account.')
        return
      }
      setLoading(true)
      setError('')
      setRefreshKey((k) => k + 1)
      if (data.setupUrl) {
        setGeneratedSetup({
          email: data.account?.email || form.email,
          fullName,
          setupUrl: data.setupUrl,
          message: data.message,
        })
        return
      }
      setModalOpen(false)
      setSuccess(data.message || 'Admin account created.')
    } catch {
      setModalError('Cannot connect to server. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#fcfbf9] text-slate-900">
      <AdminHeader currentPage="accounts" />

      <main className="mx-auto max-w-[1440px] px-5 py-8 sm:px-8 lg:px-10">
        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-orange-600">
              {isSystemDeveloper ? 'Developer Governance' : 'Admin Accounts'}
            </p>
            <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
              {isSystemDeveloper ? 'System Governance & Account Handover' : 'Co-Admin Management'}
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              {isSystemDeveloper
                ? 'Manage System Developer and System Admin accounts.'
                : 'Add and manage Co-Admin accounts for daily LearnMatch operations.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-600"
            >
              <IconPlus size={17} />
              {isSystemDeveloper ? 'Add Admin Account' : 'Add Co-Admin'}
            </button>
          </div>
        </div>

        {error && (
          <div role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {success && (
          <div role="status" className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {success}
          </div>
        )}

        {/* Admin Accounts Table */}
        <section className="overflow-hidden rounded-2xl border border-stone-200/90 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4">
            <h2 className="text-sm font-bold text-slate-900">
              {isSystemDeveloper ? 'Registered Admin & Developer Accounts' : 'System Admin (Co-Admin) Accounts'}
            </h2>
            <span className="text-xs text-slate-500">{accounts.length} account{accounts.length === 1 ? '' : 's'}</span>
          </div>
          <SkeletonContent loading={loading} label="Loading admin accounts...">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-stone-100 bg-stone-50/70 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Account</th>
                    <th className="px-5 py-3">Email</th>
                    <th className="px-5 py-3">Role</th>
                    <th className="px-5 py-3">Created</th>
                    <th className="px-5 py-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {accounts.map((account) => {
                    const roleMeta = getRoleMeta(account.role)
                    return (
                      <tr key={account.admin_id} className="hover:bg-orange-50/30">
                        <td className="px-5 py-3.5">
                          <p className="font-semibold text-slate-900">{account.full_name}</p>
                          <p className="text-xs text-slate-500">@{account.username}</p>
                        </td>
                        <td className="px-5 py-3.5 text-slate-700">
                          {account.email || <span className="text-slate-400">Not linked</span>}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex rounded-md border px-2.5 py-0.5 text-xs font-semibold ${roleMeta.badgeClass}`}>
                            {roleMeta.label}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-xs text-slate-500">{formatDate(account.created_at)}</td>
                        <td className="px-5 py-3.5 text-right">
                          {account.setup_pending ? (
                            <button
                              type="button"
                              onClick={() => regenerateSetupLink(account)}
                              className="inline-flex items-center gap-1 rounded-lg border border-orange-200 bg-orange-50 px-2.5 py-1.5 text-xs font-semibold text-orange-800 hover:bg-orange-100"
                            >
                              <IconCopy size={13} />
                              Pending Setup · Copy Link
                            </button>
                          ) : (
                            <span className="inline-flex rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                              Active
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                  {!accounts.length && (
                    <tr>
                      <td colSpan={5} className="px-5 py-8 text-center text-sm text-slate-500">
                        No accounts found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </SkeletonContent>
        </section>
      </main>

      {/* Add / Edit Admin Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-account-modal-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 id="admin-account-modal-title" className="text-lg font-bold text-slate-950">
                {generatedSetup
                  ? 'Account Setup Link'
                  : (isSystemDeveloper ? 'Create Admin Account' : 'Add Co-Admin Account')}
              </h2>
              <button
                type="button"
                onClick={closeModal}
                aria-label="Close modal"
                className="rounded-lg p-1.5 text-slate-500 hover:bg-stone-100"
              >
                <IconX size={18} />
              </button>
            </div>

            {modalError && (
              <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-700">
                {modalError}
              </div>
            )}

            {generatedSetup ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                  <p className="font-semibold">{generatedSetup.message}</p>
                  <p className="mt-1 text-xs text-emerald-800">
                    Share this one-time link with <strong>{generatedSetup.fullName}</strong> ({generatedSetup.email}). They must open it to verify their email and set their own password before signing in (valid for 60 minutes).
                  </p>
                </div>

                <div>
                  <label htmlFor="generated-admin-setup-link" className="block text-xs font-semibold text-slate-700">
                    Copy-Pastable Setup Link
                  </label>
                  <div className="mt-1.5 flex gap-2">
                    <input
                      id="generated-admin-setup-link"
                      type="text"
                      readOnly
                      value={generatedSetup.setupUrl || ''}
                      onFocus={(e) => e.target.select()}
                      className="min-w-0 flex-1 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 font-mono text-xs text-slate-800"
                    />
                    <button
                      type="button"
                      onClick={copySetupLink}
                      className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
                        copiedSetup
                          ? 'bg-emerald-600 text-white'
                          : 'bg-orange-500 text-white hover:bg-orange-600'
                      }`}
                    >
                      {copiedSetup ? <IconCheck size={15} /> : <IconCopy size={15} />}
                      {copiedSetup ? 'Copied!' : 'Copy Setup Link'}
                    </button>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="admin-first-name" className="block text-xs font-semibold text-slate-700">
                    First Name <RequiredMark />
                  </label>
                  <input
                    id="admin-first-name"
                    type="text"
                    required
                    maxLength={50}
                    placeholder="e.g. Juan"
                    value={form.first_name}
                    onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-stone-200 px-3.5 py-2.5 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                  />
                </div>
                <div>
                  <label htmlFor="admin-last-name" className="block text-xs font-semibold text-slate-700">
                    Last Name <RequiredMark />
                  </label>
                  <input
                    id="admin-last-name"
                    type="text"
                    required
                    maxLength={50}
                    placeholder="e.g. Dela Cruz"
                    value={form.last_name}
                    onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-stone-200 px-3.5 py-2.5 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="admin-username" className="block text-xs font-semibold text-slate-700">
                  Username <RequiredMark />
                </label>
                <input
                  id="admin-username"
                  type="text"
                  required
                  minLength={3}
                  maxLength={50}
                  placeholder="e.g. jdelacruz"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-stone-200 px-3.5 py-2.5 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                />
              </div>

              <div>
                <label htmlFor="admin-email" className="block text-xs font-semibold text-slate-700">
                  Email Address <RequiredMark />
                </label>
                <input
                  id="admin-email"
                  type="email"
                  required
                  placeholder="e.g. admin@learnmatch.online"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-stone-200 px-3.5 py-2.5 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                />
              </div>

              <div>
                <label htmlFor="admin-role" className="block text-xs font-semibold text-slate-700">
                  Role Designation {isSystemDeveloper && <RequiredMark />}
                </label>
                {isSystemDeveloper ? (
                  <select
                    id="admin-role"
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                  >
                    <option value={ADMIN_ROLES.SYSTEM_ADMIN}>System Admin — Dedicated platform operator</option>
                    <option value={ADMIN_ROLES.SYSTEM_DEVELOPER}>System Developer — Technical maintainer &amp; logs</option>
                  </select>
                ) : (
                  <input
                    id="admin-role"
                    type="text"
                    readOnly
                    value="System Admin (Co-Admin)"
                    className="mt-1 w-full rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-sm font-medium text-slate-700"
                  />
                )}
              </div>

              <p className="rounded-xl border border-orange-100 bg-orange-50/70 px-3.5 py-2.5 text-xs leading-5 text-slate-700">
                No password is set here. A secure, one-time <strong>Setup Link</strong> will be generated so the new admin can verify their email and set their own password before signing in.
              </p>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={submitting}
                  className="rounded-xl border border-stone-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-stone-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
                >
                  {submitting ? 'Generating...' : 'Generate Setup Link'}
                </button>
              </div>
            </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
