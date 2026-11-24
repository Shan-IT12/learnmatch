import SkeletonContent from '../../components/SkeletonContent'
import { Fragment, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  IconChevronDown,
  IconChevronLeft,
  IconChevronLeftPipe,
  IconChevronRight,
  IconChevronRightPipe,
  IconChevronUp,
  IconSearch,
  IconShieldCheck,
  IconUserSearch,
  IconX,
} from '@tabler/icons-react'
import AdminHeader from '../../components/AdminHeader'
import AdminAttemptLogsSection, { AdminMonitoringBadge } from '../../components/admin/AdminAttemptMonitoringPanel'

const PAGE_SIZE = 10

const badgeStyles = {
  Active: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  Inactive: 'border-slate-200 bg-slate-100 text-slate-600',
  Completed: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  'In Progress': 'border-amber-200 bg-amber-50 text-amber-700',
  'Not Started': 'border-slate-200 bg-slate-50 text-slate-600',
  Available: 'border-orange-200 bg-orange-50 text-orange-700',
  'Not Yet Generated': 'border-slate-200 bg-slate-50 text-slate-600',
  'Tracking Started': 'border-orange-200 bg-orange-50 text-orange-700',
  'On Track': 'border-emerald-200 bg-emerald-50 text-emerald-700',
  Monitor: 'border-amber-200 bg-amber-50 text-amber-700',
  'Needs Attention': 'border-red-200 bg-red-50 text-red-700',
  'No Check-in': 'border-slate-200 bg-slate-50 text-slate-600',
}

function StatusBadge({ children }) {
  return (
    <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-medium ${badgeStyles[children] || badgeStyles['Not Started']}`}>
      {children}
    </span>
  )
}

function formatDate(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value))
}

function handleUnauthorized(response, navigate) {
  if (response.status !== 401 && response.status !== 403) return false
  localStorage.removeItem('adminToken')
  localStorage.removeItem('adminUsername')
  navigate('/admin/login', { replace: true })
  return true
}

function AdminUsers() {
  const navigate = useNavigate()
  const [users, setUsers] = useState([])
  const [enrollmentSummary, setEnrollmentSummary] = useState(null)
  const [pagination, setPagination] = useState({ page: 1, pageSize: PAGE_SIZE, total: 0, totalPages: 1 })
  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [reload, setReload] = useState(0)
  const [account, setAccount] = useState('')
  const [assessment, setAssessment] = useState('')
  const [tracking, setTracking] = useState('')
  const [alignment, setAlignment] = useState('')
  const [enrollmentProof, setEnrollmentProof] = useState(
    () => new URLSearchParams(window.location.search).get('enrollmentProof') || ''
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedUserId, setExpandedUserId] = useState(null)

  useEffect(() => {
    document.title = 'Users | LearnMatch Admin'
  }, [])

  useEffect(() => {
    const nextSearch = searchInput.trim()
    if (nextSearch === search) return
    const timer = setTimeout(() => {
      setLoading(true)
      setPage(1)
      setSearch(nextSearch)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput, search])

  useEffect(() => {
    const controller = new AbortController()
    const loadUsers = async () => {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
      if (search) params.set('search', search)
      if (account) params.set('account', account)
      if (assessment) params.set('assessment', assessment)
      if (tracking) params.set('tracking', tracking)
      if (alignment) params.set('alignment', alignment)
      if (enrollmentProof) params.set('enrollmentProof', enrollmentProof)

      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/users?${params}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` },
          signal: controller.signal,
        })
        if (handleUnauthorized(response, navigate)) return
        if (!response.ok) throw new Error('Could not load registered users.')
        const data = await response.json()
        if (controller.signal.aborted) return
        setUsers(data.users || [])
        setEnrollmentSummary(data.enrollmentSummary || null)
        setPagination(data.pagination || { page: 1, pageSize: PAGE_SIZE, total: 0, totalPages: 1 })
        setError('')
      } catch (requestError) {
        if (requestError.name !== 'AbortError') setError(requestError.message || 'Could not load registered users.')
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    loadUsers()
    return () => controller.abort()
  }, [account, alignment, assessment, enrollmentProof, navigate, page, search, tracking, reload])

  const changeFilter = (setter, value) => {
    setReload(value => value + 1)
    setLoading(true)
    setPage(1)
    setter(value)
  }

  const submitSearch = (event) => {
    event.preventDefault()
    setLoading(true)
    setPage(1)
    setSearch(searchInput.trim())
    setReload(value => value + 1)
  }

  const clearFilters = () => {
    setReload(value => value + 1)
    setSearchInput('')
    setSearch('')
    setAccount('')
    setAssessment('')
    setTracking('')
    setAlignment('')
    setEnrollmentProof('')
    setPage(1)
    setLoading(true)
  }

  const changePage = (nextPage) => {
    setLoading(true)
    setPage(nextPage)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const hasFilters = Boolean(search || account || assessment || tracking || alignment || enrollmentProof)

  return (
    <div className="min-h-screen bg-[#fcfaf7]">
      <AdminHeader currentPage="users" />
      <main className="mx-auto max-w-[1440px] px-5 py-8 sm:px-8 sm:py-10 lg:px-10">
        <div className="mb-7 border-b border-slate-200 pb-6">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-orange-600">Administration</p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950">User Monitoring</h1>
          <p className="mt-2 text-sm text-slate-600">Review registered accounts, assessment progress, recommendations, and Career Alignment status.</p>
        </div>

        {enrollmentSummary && (
          <section
            aria-label="College enrollment verification summary"
            className="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-orange-100 bg-white px-5 py-3.5 shadow-sm"
          >
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-orange-50 text-orange-600">
                <IconShieldCheck size={18} stroke={1.8} aria-hidden="true" />
              </span>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-700">College Enrollment Verification</p>
                <p className="text-xs text-slate-500">
                  {enrollmentSummary.totalEnrolled} college {enrollmentSummary.totalEnrolled === 1 ? 'student' : 'students'} tracked · Click a status to filter
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
              <button
                type="button"
                onClick={() => changeFilter(setEnrollmentProof, enrollmentProof === 'verified' ? '' : 'verified')}
                aria-pressed={enrollmentProof === 'verified'}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 transition ${
                  enrollmentProof === 'verified'
                    ? 'border-emerald-500 bg-emerald-100 text-emerald-900 ring-2 ring-emerald-300'
                    : 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                }`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Verified Enrolled: {enrollmentSummary.verified}
              </button>
              <button
                type="button"
                onClick={() => changeFilter(setEnrollmentProof, enrollmentProof === 'pending_review' ? '' : 'pending_review')}
                aria-pressed={enrollmentProof === 'pending_review'}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 transition ${
                  enrollmentProof === 'pending_review'
                    ? 'border-amber-500 bg-amber-100 text-amber-950 ring-2 ring-amber-300'
                    : 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'
                }`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                Pending Review: {enrollmentSummary.pendingReview}
              </button>
              <button
                type="button"
                onClick={() => changeFilter(setEnrollmentProof, enrollmentProof === 'unverified' ? '' : 'unverified')}
                aria-pressed={enrollmentProof === 'unverified'}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 transition ${
                  enrollmentProof === 'unverified'
                    ? 'border-slate-500 bg-slate-200 text-slate-900 ring-2 ring-slate-300'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                Unverified: {(enrollmentSummary.unsubmitted || 0) + (enrollmentSummary.rejected || 0)}
                {enrollmentSummary.rejected > 0 ? ` (${enrollmentSummary.rejected} rejected)` : ''}
              </button>
            </div>
          </section>
        )}

        <section className="mb-5 rounded-xl border border-orange-100 bg-white p-4 shadow-sm sm:p-5" aria-label="User filters">
          <form onSubmit={submitSearch} className="flex flex-col gap-3 lg:flex-row">
            <div className="relative min-w-0 flex-1">
              <IconSearch size={18} stroke={1.8} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search by User ID, username, or email"
                aria-label="Search users"
                className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-11 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
              {searchInput && (
                <button type="button" onClick={() => setSearchInput('')} aria-label="Clear search" className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 hover:bg-slate-50 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-500">
                  <IconX size={16} />
                </button>
              )}
            </div>
            <button type="submit" className="rounded-lg bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2">
              Search
            </button>
          </form>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <select value={account} onChange={(event) => changeFilter(setAccount, event.target.value)} aria-label="Filter by account status" className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-500">
              <option value="">All Account Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <select value={assessment} onChange={(event) => changeFilter(setAssessment, event.target.value)} aria-label="Filter by assessment status" className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-500">
              <option value="">All Assessment Progress</option>
              <option value="completed">Completed</option>
              <option value="in_progress">In Progress</option>
              <option value="not_started">Not Started</option>
            </select>
            <select value={tracking} onChange={(event) => changeFilter(setTracking, event.target.value)} aria-label="Filter by tracking status" className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-500">
              <option value="">All Tracking Statuses</option>
              <option value="started">Tracking Started</option>
              <option value="not_started">Not Started</option>
            </select>
            <select value={alignment} onChange={(event) => changeFilter(setAlignment, event.target.value)} aria-label="Filter by alignment status" className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-500">
              <option value="">All Alignment Statuses</option>
              <option value="on_track">On Track</option>
              <option value="monitor">Monitor</option>
              <option value="needs_attention">Needs Attention</option>
              <option value="no_checkin">No Check-in</option>
            </select>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <p className="text-sm text-slate-500">{loading ? 'Loading users…' : `${pagination.total.toLocaleString()} registered ${pagination.total === 1 ? 'user' : 'users'}`}</p>
            {hasFilters && <button type="button" onClick={clearFilters} className="lm-action">Clear filters</button>}
          </div>
        </section>

        {error && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</div>
        )}

        <SkeletonContent loading={loading} label="Loading user accounts...">
        {!loading && users.length === 0 ? (
          <div className="rounded-xl border border-orange-100 bg-white px-6 py-14 text-center shadow-sm">
            <IconUserSearch size={30} stroke={1.6} className="mx-auto text-slate-400" />
            <h2 className="mt-3 text-lg font-semibold text-slate-900">{hasFilters ? 'No users match these filters' : 'No registered users yet'}</h2>
            <p className="mt-1 text-sm text-slate-500">{hasFilters ? 'Try changing your search or filter selections.' : 'Registered student accounts will appear here.'}</p>
            {hasFilters && <button type="button" onClick={clearFilters} className="lm-action mt-5">Clear filters</button>}
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto rounded-xl border border-orange-100 bg-white shadow-sm lg:block">
              <table className="w-full min-w-[780px] table-fixed text-left text-sm">
                <colgroup>
                  <col className="w-[18%]" />
                  <col className="w-[16%]" />
                  <col className="w-[23%]" />
                  <col className="w-[25%]" />
                  <col className="w-[18%]" />
                </colgroup>
                <thead className="border-b border-orange-100 bg-orange-50/50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3.5 font-semibold">User ID</th>
                    <th className="px-4 py-3.5 font-semibold">Account Status</th>
                    <th className="px-4 py-3.5 font-semibold">Assessment Status</th>
                    <th className="px-4 py-3.5 font-semibold">College Phase</th>
                    <th className="px-5 py-3.5 font-semibold">Registered</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(loading ? [1, 2, 3, 4, 5].map(userId => ({ userId, username: 'username', accountStatus: 'Active', assessmentStatus: 'Completed', recommendationStatus: 'Available', trackingStatus: 'Active', latestAlignment: 'Aligned', registeredAt: '2026-01-01T00:00:00Z', latestAttempt: null, attempts: [] })) : users).map((user) => {
                    const isExpanded = expandedUserId === user.userId
                    return (
                      <Fragment key={user.userId}>
                        <tr
                          onClick={() => { if (!loading) navigate(`/admin/users/${user.userId}`) }}
                          className={`transition hover:bg-orange-50/40 ${loading ? '' : 'cursor-pointer'}`}
                        >
                          <td className="px-5 py-4 align-top">
                            <button
                              type="button"
                              onClick={(event) => { event.stopPropagation(); navigate(`/admin/users/${user.userId}`) }}
                              className="font-bold tabular-nums text-slate-950 underline decoration-orange-300 underline-offset-2 hover:text-orange-700"
                            >
                              #{user.userId}
                            </button>
                            {user.username && <p className="mt-1 truncate text-xs font-medium text-slate-500">@{user.username}</p>}
                            {user.email && <p className="mt-1 break-all text-xs text-slate-500">{user.email}</p>}
                          </td>
                          <td className="px-4 py-4 align-top"><StatusBadge>{user.accountStatus}</StatusBadge></td>
                          <td className="px-4 py-4 align-top">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <StatusBadge>{user.assessmentStatus}</StatusBadge>
                              {user.latestAttempt && (
                                <AdminMonitoringBadge
                                  cameraEnabled={user.latestAttempt.cameraEnabled}
                                  mode={user.latestAttempt.mode}
                                  flagCount={user.latestAttempt.flagCount}
                                />
                              )}
                            </div>
                            <p className="mt-1.5 break-words text-xs leading-5 text-slate-500">Recommendation: {user.recommendationStatus}</p>
                            {user.attempts?.length > 0 && (
                              <button
                                type="button"
                                onClick={(event) => { event.stopPropagation(); setExpandedUserId(isExpanded ? null : user.userId) }}
                                aria-expanded={isExpanded}
                                className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-orange-700 underline hover:text-orange-800"
                              >
                                {isExpanded ? 'Hide Monitoring Logs' : `View Monitoring Logs (${user.attempts.length})`}
                                {isExpanded ? <IconChevronUp size={13} aria-hidden="true" /> : <IconChevronDown size={13} aria-hidden="true" />}
                              </button>
                            )}
                          </td>
                          <td className="px-4 py-4 align-top">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <StatusBadge>{user.trackingStatus}</StatusBadge>
                              {user.enrollmentProofStatus === 'submitted' && (
                                <span className="inline-flex rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                                  Proof Pending Review
                                </span>
                              )}
                              {user.enrollmentProofStatus === 'verified' && (
                                <span className="inline-flex rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                                  Enrollment Verified
                                </span>
                              )}
                              {user.enrollmentProofStatus === 'rejected' && (
                                <span className="inline-flex rounded-md border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-800">
                                  Proof Rejected
                                </span>
                              )}
                            </div>
                            <p className="mt-1.5 break-words text-xs leading-5 text-slate-500">Alignment: {user.latestAlignment || 'No Check-in'}</p>
                            {user.enrollmentProofStatus === 'submitted' && (
                              <button
                                type="button"
                                onClick={(event) => { event.stopPropagation(); navigate(`/admin/users/${user.userId}`) }}
                                className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-orange-700 underline hover:text-orange-900"
                              >
                                Review Proof →
                              </button>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-5 py-4 align-top text-slate-600">{formatDate(user.registeredAt)}</td>
                        </tr>
                        {isExpanded && (
                          <tr className="bg-orange-50/20">
                            <td colSpan={5} className="px-5 py-4">
                              <AdminAttemptLogsSection attempts={user.attempts} />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="grid gap-4 lg:hidden">
              {(loading ? [1, 2, 3, 4, 5].map(userId => ({ userId, username: 'username', accountStatus: 'Active', assessmentStatus: 'Completed', recommendationStatus: 'Available', trackingStatus: 'Active', latestAlignment: 'Aligned', registeredAt: '2026-01-01T00:00:00Z' })) : users).map((user) => (
                <article
                  key={user.userId}
                  onClick={() => { if (!loading) navigate(`/admin/users/${user.userId}`) }}
                  className={`rounded-xl border border-orange-100 bg-white p-5 shadow-sm transition hover:border-orange-300 ${loading ? '' : 'cursor-pointer'}`}
                >
                  <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
                    <div className="min-w-0">
                      <p className="font-bold tabular-nums text-slate-950">User #{user.userId}</p>
                      {user.username && <p className="mt-1 truncate text-sm font-medium text-slate-700">@{user.username}</p>}
                      {user.email && <p className="mt-1 break-all text-sm text-slate-500">{user.email}</p>}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Account Status</p>
                      <StatusBadge>{user.accountStatus}</StatusBadge>
                    </div>
                  </div>
                  <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Assessment Status</dt>
                      <dd className="mt-1.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <StatusBadge>{user.assessmentStatus}</StatusBadge>
                          {user.latestAttempt && (
                            <AdminMonitoringBadge
                              cameraEnabled={user.latestAttempt.cameraEnabled}
                              mode={user.latestAttempt.mode}
                              flagCount={user.latestAttempt.flagCount}
                            />
                          )}
                        </div>
                        <p className="mt-2 text-xs text-slate-500">Recommendation: {user.recommendationStatus}</p>
                        {user.attempts?.length > 0 && (
                          <button
                            type="button"
                            onClick={(event) => { event.stopPropagation(); setExpandedUserId(expandedUserId === user.userId ? null : user.userId) }}
                            className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-orange-700 underline hover:text-orange-800"
                          >
                            {expandedUserId === user.userId ? 'Hide Monitoring Logs' : `View Monitoring Logs (${user.attempts.length})`}
                          </button>
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">College Phase</dt>
                      <dd className="mt-1.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <StatusBadge>{user.trackingStatus}</StatusBadge>
                          {user.enrollmentProofStatus === 'submitted' && (
                            <span className="inline-flex rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                              Proof Pending Review
                            </span>
                          )}
                          {user.enrollmentProofStatus === 'verified' && (
                            <span className="inline-flex rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                              Enrollment Verified
                            </span>
                          )}
                          {user.enrollmentProofStatus === 'rejected' && (
                            <span className="inline-flex rounded-md border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-800">
                              Proof Rejected
                            </span>
                          )}
                        </div>
                        <p className="mt-2 text-xs text-slate-500">Alignment: {user.latestAlignment || 'No Check-in'}</p>
                        {user.enrollmentProofStatus === 'submitted' && (
                          <button
                            type="button"
                            onClick={() => navigate(`/admin/users/${user.userId}`)}
                            className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-orange-700 underline hover:text-orange-900"
                          >
                            Review Proof →
                          </button>
                        )}
                      </dd>
                    </div>
                  </dl>
                  {expandedUserId === user.userId && user.attempts?.length > 0 && (
                    <div className="mt-4 border-t border-slate-100 pt-4">
                      <AdminAttemptLogsSection attempts={user.attempts} />
                    </div>
                  )}
                  <div className="mt-5 border-t border-slate-100 pt-4">
                    <p className="text-sm text-slate-500">Registered {formatDate(user.registeredAt)}</p>
                  </div>
                </article>
              ))}
            </div>

            <nav className="mt-5 flex flex-col items-center justify-between gap-3 rounded-xl border border-orange-100 bg-white px-3 py-4 shadow-sm sm:flex-row sm:px-5" aria-label="User pagination">
              <p className="text-sm text-slate-500">Page {pagination.page} of {pagination.totalPages}</p>
              <div className="flex items-center gap-1 sm:gap-2">
                <button type="button" disabled={pagination.page <= 1} onClick={() => changePage(1)} aria-label="First page" title="First page" className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg border border-slate-200 px-2 py-2 text-slate-700 hover:border-orange-200 hover:bg-orange-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500 disabled:cursor-not-allowed disabled:opacity-40">
                  <IconChevronLeftPipe size={18} aria-hidden="true" />
                </button>
                <button type="button" disabled={pagination.page <= 1} onClick={() => changePage(pagination.page - 1)} className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-slate-200 px-2 py-2 text-xs font-medium text-slate-700 hover:border-orange-200 hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-40 sm:px-3 sm:text-sm">
                  <IconChevronLeft size={16} /> Previous
                </button>
                <button type="button" disabled={pagination.page >= pagination.totalPages} onClick={() => changePage(pagination.page + 1)} className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-slate-200 px-2 py-2 text-xs font-medium text-slate-700 hover:border-orange-200 hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-40 sm:px-3 sm:text-sm">
                  Next <IconChevronRight size={16} />
                </button>
                <button type="button" disabled={pagination.page >= pagination.totalPages} onClick={() => changePage(pagination.totalPages)} aria-label="Last page" title="Last page" className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg border border-slate-200 px-2 py-2 text-slate-700 hover:border-orange-200 hover:bg-orange-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500 disabled:cursor-not-allowed disabled:opacity-40">
                  <IconChevronRightPipe size={18} aria-hidden="true" />
                </button>
              </div>
            </nav>
          </>
        )}
        </SkeletonContent>
      </main>
    </div>
  )
}

export default AdminUsers
