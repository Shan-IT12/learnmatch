import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  IconChevronLeft,
  IconChevronRight,
  IconSearch,
  IconUserSearch,
  IconX,
} from '@tabler/icons-react'
import AdminHeader from '../../components/AdminHeader'

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
  const [pagination, setPagination] = useState({ page: 1, pageSize: PAGE_SIZE, total: 0, totalPages: 1 })
  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [account, setAccount] = useState('')
  const [assessment, setAssessment] = useState('')
  const [tracking, setTracking] = useState('')
  const [alignment, setAlignment] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    document.title = 'Users | LearnMatch Admin'
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    const loadUsers = async () => {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
      if (search) params.set('search', search)
      if (account) params.set('account', account)
      if (assessment) params.set('assessment', assessment)
      if (tracking) params.set('tracking', tracking)
      if (alignment) params.set('alignment', alignment)

      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/users?${params}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` },
          signal: controller.signal,
        })
        if (handleUnauthorized(response, navigate)) return
        if (!response.ok) throw new Error('Could not load registered users.')
        const data = await response.json()
        setUsers(data.users || [])
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
  }, [account, alignment, assessment, navigate, page, search, tracking])

  const changeFilter = (setter, value) => {
    setLoading(true)
    setPage(1)
    setter(value)
  }

  const submitSearch = (event) => {
    event.preventDefault()
    setLoading(true)
    setPage(1)
    setSearch(searchInput.trim())
  }

  const clearFilters = () => {
    setSearchInput('')
    setSearch('')
    setAccount('')
    setAssessment('')
    setTracking('')
    setAlignment('')
    setPage(1)
    setLoading(true)
  }

  const changePage = (nextPage) => {
    setLoading(true)
    setPage(nextPage)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const hasFilters = Boolean(search || account || assessment || tracking || alignment)

  return (
    <div className="min-h-screen bg-[#fcfaf7]">
      <AdminHeader currentPage="users" />
      <main className="mx-auto max-w-[1440px] px-5 py-8 sm:px-8 sm:py-10 lg:px-10">
        <div className="mb-7 border-b border-slate-200 pb-6">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-orange-600">Administration</p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950">User Monitoring</h1>
          <p className="mt-2 text-sm text-slate-600">Review registered accounts, assessment progress, recommendations, and Career Alignment status.</p>
        </div>

        <section className="mb-5 rounded-xl border border-orange-100 bg-white p-4 shadow-sm sm:p-5" aria-label="User filters">
          <form onSubmit={submitSearch} className="flex flex-col gap-3 lg:flex-row">
            <div className="relative min-w-0 flex-1">
              <IconSearch size={18} stroke={1.8} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search by student name, username, or email"
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
            {hasFilters && <button type="button" onClick={clearFilters} className="text-sm font-semibold text-orange-600 hover:text-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500">Clear filters</button>}
          </div>
        </section>

        {error && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</div>
        )}

        {loading ? (
          <div className="rounded-xl border border-orange-100 bg-white py-16 text-center shadow-sm">
            <p className="text-sm text-slate-500">Loading user accounts…</p>
          </div>
        ) : users.length === 0 ? (
          <div className="rounded-xl border border-orange-100 bg-white px-6 py-14 text-center shadow-sm">
            <IconUserSearch size={30} stroke={1.6} className="mx-auto text-slate-400" />
            <h2 className="mt-3 text-lg font-semibold text-slate-900">{hasFilters ? 'No users match these filters' : 'No registered users yet'}</h2>
            <p className="mt-1 text-sm text-slate-500">{hasFilters ? 'Try changing your search or filter selections.' : 'Registered student accounts will appear here.'}</p>
            {hasFilters && <button type="button" onClick={clearFilters} className="mt-5 text-sm font-semibold text-orange-600 hover:text-orange-700">Clear filters</button>}
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto rounded-xl border border-orange-100 bg-white shadow-sm lg:block">
              <table className="w-full min-w-[1120px] text-left text-sm">
                <thead className="border-b border-orange-100 bg-orange-50/50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Student</th>
                    <th className="px-4 py-3 font-semibold">Account</th>
                    <th className="px-4 py-3 font-semibold">Assessment</th>
                    <th className="px-4 py-3 font-semibold">Recommendation</th>
                    <th className="px-4 py-3 font-semibold">College Tracking</th>
                    <th className="px-4 py-3 font-semibold">Latest Alignment</th>
                    <th className="px-4 py-3 font-semibold">Registered</th>
                    <th className="px-5 py-3 text-right font-semibold"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((user) => (
                    <tr key={user.userId} className="transition hover:bg-orange-50/30">
                      <td className="px-5 py-4">
                        <p className="font-semibold text-slate-900">{user.displayName}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{user.email}</p>
                      </td>
                      <td className="px-4 py-4"><StatusBadge>{user.accountStatus}</StatusBadge></td>
                      <td className="px-4 py-4"><StatusBadge>{user.assessmentStatus}</StatusBadge></td>
                      <td className="px-4 py-4"><StatusBadge>{user.recommendationStatus}</StatusBadge></td>
                      <td className="px-4 py-4"><StatusBadge>{user.trackingStatus}</StatusBadge></td>
                      <td className="px-4 py-4"><StatusBadge>{user.latestAlignment || 'No Check-in'}</StatusBadge></td>
                      <td className="whitespace-nowrap px-4 py-4 text-slate-600">{formatDate(user.registeredAt)}</td>
                      <td className="px-5 py-4 text-right">
                        <button type="button" onClick={() => navigate(`/admin/users/${user.userId}`)} className="text-sm font-semibold text-orange-600 hover:text-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500">View</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid gap-4 lg:hidden">
              {users.map((user) => (
                <article key={user.userId} className="rounded-xl border border-orange-100 bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-900">{user.displayName}</p>
                      <p className="mt-0.5 truncate text-sm text-slate-500">{user.email}</p>
                    </div>
                    <StatusBadge>{user.accountStatus}</StatusBadge>
                  </div>
                  <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Assessment</dt><dd className="mt-1.5"><StatusBadge>{user.assessmentStatus}</StatusBadge></dd></div>
                    <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Recommendation</dt><dd className="mt-1.5"><StatusBadge>{user.recommendationStatus}</StatusBadge></dd></div>
                    <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">College Tracking</dt><dd className="mt-1.5"><StatusBadge>{user.trackingStatus}</StatusBadge></dd></div>
                    <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Latest Alignment</dt><dd className="mt-1.5"><StatusBadge>{user.latestAlignment || 'No Check-in'}</StatusBadge></dd></div>
                  </dl>
                  <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
                    <p className="text-sm text-slate-500">Registered {formatDate(user.registeredAt)}</p>
                    <button type="button" onClick={() => navigate(`/admin/users/${user.userId}`)} className="text-sm font-semibold text-orange-600 hover:text-orange-700">View details</button>
                  </div>
                </article>
              ))}
            </div>

            <nav className="mt-5 flex flex-col items-center justify-between gap-3 rounded-xl border border-orange-100 bg-white px-5 py-4 shadow-sm sm:flex-row" aria-label="User pagination">
              <p className="text-sm text-slate-500">Page {pagination.page} of {pagination.totalPages}</p>
              <div className="flex items-center gap-2">
                <button type="button" disabled={pagination.page <= 1} onClick={() => changePage(pagination.page - 1)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:border-orange-200 hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-40">
                  <IconChevronLeft size={16} /> Previous
                </button>
                <button type="button" disabled={pagination.page >= pagination.totalPages} onClick={() => changePage(pagination.page + 1)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:border-orange-200 hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-40">
                  Next <IconChevronRight size={16} />
                </button>
              </div>
            </nav>
          </>
        )}
      </main>
    </div>
  )
}

export default AdminUsers
