import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  IconAlertTriangle,
  IconChevronLeft,
  IconChevronRight,
  IconClock,
  IconDownload,
  IconMessageReport,
  IconRefresh,
  IconSearch,
  IconStarFilled,
  IconX,
} from '@tabler/icons-react'
import AdminHeader from '../../components/AdminHeader'
import { downloadCsv } from '../../utils/csvExport'

const PAGE_SIZE = 10

const CATEGORY_BADGE_STYLES = {
  General: 'border-sky-200 bg-sky-50 text-sky-800',
  'System Performance': 'border-rose-200 bg-rose-50 text-rose-800',
  'Assessment Experience': 'border-amber-200 bg-amber-50 text-amber-800',
  'Course Recommendations': 'border-orange-200 bg-orange-50 text-orange-800',
  'College Phase': 'border-emerald-200 bg-emerald-50 text-emerald-800',
}

function CategoryBadge({ value }) {
  const tone = CATEGORY_BADGE_STYLES[value] || 'border-slate-200 bg-slate-50 text-slate-700'
  return (
    <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-medium ${tone}`}>
      {value || 'General'}
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
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

function Rating({ value }) {
  return (
    <span className="inline-flex items-center gap-1 font-semibold tabular-nums text-slate-700" aria-label={`${value} out of 5 stars`}>
      <IconStarFilled size={15} className="text-amber-500" /> {value}/5
    </span>
  )
}

function EmptyState({ filtered }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center">
      <IconMessageReport className="mx-auto text-slate-300" size={32} stroke={1.6} />
      <h2 className="mt-4 font-semibold text-slate-900">
        {filtered ? 'No feedback matches these filters' : 'No feedback has been submitted yet.'}
      </h2>
      {filtered && <p className="mt-1 text-sm text-slate-500">Try changing the search or filter selections.</p>}
    </div>
  )
}

function AdminFeedback() {
  const navigate = useNavigate()
  const [feedback, setFeedback] = useState([])
  const [summary, setSummary] = useState({ totalFeedback: 0, averageRating: null, recentFeedback: 0 })
  const [ratingDistribution, setRatingDistribution] = useState([])
  const [categories, setCategories] = useState([])
  const [exporting, setExporting] = useState(false)
  const [pagination, setPagination] = useState({ page: 1, pageSize: PAGE_SIZE, total: 0, totalPages: 1 })
  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [rating, setRating] = useState('')
  const [sort, setSort] = useState('newest')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    document.title = 'Feedback | LearnMatch Admin'
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    const loadFeedback = async () => {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE), sort })
      if (search) params.set('search', search)
      if (category) params.set('category', category)
      if (rating) params.set('rating', rating)

      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/feedback?${params}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` },
          signal: controller.signal,
        })
        if (response.status === 401 || response.status === 403) {
          localStorage.removeItem('adminToken')
          localStorage.removeItem('adminUsername')
          navigate('/admin/login', { replace: true })
          return
        }
        if (!response.ok) throw new Error('Could not load submitted feedback.')
        const data = await response.json()
        setFeedback(data.feedback)
        setSummary(data.summary)
        setRatingDistribution(Array.isArray(data.ratingDistribution) ? data.ratingDistribution : [])
        setCategories(data.categoryDistribution)
        setPagination(data.pagination)
      } catch (requestError) {
        if (requestError.name !== 'AbortError') {
          setError(requestError.message || 'Could not load submitted feedback.')
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    loadFeedback()
    return () => controller.abort()
  }, [category, navigate, page, rating, retryKey, search, sort])

  const applySearch = (event) => {
    event.preventDefault()
    setPage(1)
    setSearch(searchInput.trim())
  }

  const clearSearch = () => {
    setSearchInput('')
    setSearch('')
    setPage(1)
  }

  const retry = () => {
    setLoading(true)
    setError('')
    setRetryKey((current) => current + 1)
  }

  const clearAllFilters = () => {
    setSearchInput('')
    setSearch('')
    setCategory('')
    setRating('')
    setPage(1)
  }

  const handleExportCsv = async () => {
    setExporting(true)
    try {
      const params = new URLSearchParams({ page: '1', pageSize: '50', sort })
      if (search) params.set('search', search)
      if (category) params.set('category', category)
      if (rating) params.set('rating', rating)
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/feedback?${params}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` },
      })
      if (!response.ok) return
      const data = await response.json()
      const items = Array.isArray(data.feedback) ? data.feedback : feedback
      const today = new Date().toISOString().slice(0, 10)
      const rows = [
        ['LearnMatch Feedback Summary', `Exported ${today}`],
        ['Total Feedback', summary.totalFeedback],
        ['Average Rating', summary.averageRating === null ? 'N/A' : `${summary.averageRating}/5`],
        ['Submitted in Last 30 Days', summary.recentFeedback],
        [],
        ['Feedback ID', 'User ID', 'Category', 'Rating', 'Submitted At', 'Comment'],
        ...items.map((item) => [
          item.feedbackId,
          item.user?.userId ?? '',
          item.category,
          `${item.rating}/5`,
          formatDate(item.submittedAt),
          item.commentPreview || '',
        ]),
      ]
      downloadCsv(`learnmatch-feedback-${today}.csv`, rows)
    } finally {
      setExporting(false)
    }
  }

  const filtered = Boolean(search || category || rating)

  return (
    <div className="min-h-screen bg-[#fcfaf7]">
      <AdminHeader currentPage="feedback" />
      <main className="mx-auto max-w-[1440px] px-5 py-8 sm:px-8 sm:py-10 lg:px-10">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-orange-600">Administration</p>
            <h1 className="text-3xl font-bold tracking-tight text-slate-950">Feedback</h1>
            <p className="mt-2 text-sm text-slate-600">Review feedback submitted by LearnMatch users.</p>
          </div>
          {!loading && !error && (
            <button
              type="button"
              disabled={exporting || summary.totalFeedback === 0}
              onClick={handleExportCsv}
              className="inline-flex items-center gap-2 rounded-xl border border-orange-200 bg-white px-4 py-2.5 text-sm font-semibold text-orange-800 shadow-xs transition hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <IconDownload size={16} aria-hidden="true" />
              {exporting ? 'Exporting…' : 'Export Feedback (CSV)'}
            </button>
          )}
        </div>

        {loading && (
          <div aria-label="Loading feedback" className="animate-pulse space-y-6">
            <div className="grid gap-4 sm:grid-cols-3">
              {[1, 2, 3].map((item) => <div key={item} className="h-28 rounded-xl border border-slate-200 bg-white" />)}
            </div>
            <div className="h-20 rounded-xl border border-slate-200 bg-white" />
            <div className="h-80 rounded-xl border border-slate-200 bg-white" />
          </div>
        )}

        {!loading && error && (
          <div className="rounded-xl border border-red-200 bg-white p-8 text-center shadow-sm" role="alert">
            <IconAlertTriangle className="mx-auto text-red-600" size={28} stroke={1.8} />
            <h2 className="mt-3 font-semibold text-slate-900">Unable to load feedback</h2>
            <p className="mt-1 text-sm text-slate-600">{error}</p>
            <button type="button" onClick={retry} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2">
              <IconRefresh size={16} /> Retry
            </button>
          </div>
        )}

        {!loading && !error && (
          <div className="space-y-6">
            <section aria-label="Feedback summary" className="grid gap-4 sm:grid-cols-3">
              <article className="rounded-xl border border-orange-100 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-4">
                  <div><p className="text-3xl font-bold tabular-nums text-slate-950">{summary.totalFeedback.toLocaleString()}</p><p className="mt-1 text-[15px] font-medium text-slate-600">Total Feedback</p></div>
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-50 text-orange-700"><IconMessageReport size={21} /></span>
                </div>
              </article>
              <article className="rounded-xl border border-orange-100 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-4">
                  <div><p className="text-3xl font-bold tabular-nums text-slate-950">{summary.averageRating === null ? '—' : `${summary.averageRating}/5`}</p><p className="mt-1 text-[15px] font-medium text-slate-600">Average Rating</p></div>
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-700"><IconStarFilled size={21} /></span>
                </div>
              </article>
              <article className="rounded-xl border border-orange-100 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-4">
                  <div><p className="text-3xl font-bold tabular-nums text-slate-950">{summary.recentFeedback.toLocaleString()}</p><p className="mt-1 text-[15px] font-medium text-slate-600">Submitted in Last 30 Days</p></div>
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-700"><IconClock size={21} /></span>
                </div>
              </article>
            </section>

            {ratingDistribution.length > 0 && (
              <section aria-label="Rating distribution" className="rounded-xl border border-orange-100 bg-white p-5 shadow-sm">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">Rating Distribution</h2>
                    <p className="text-xs text-slate-500">Click any star level to filter feedback responses.</p>
                  </div>
                  {rating && (
                    <button
                      type="button"
                      onClick={() => { setRating(''); setPage(1) }}
                      className="text-xs font-semibold text-orange-700 underline hover:text-orange-900"
                    >
                      Clear rating filter
                    </button>
                  )}
                </div>
                <div className="grid gap-2 sm:grid-cols-5">
                  {ratingDistribution.map((entry) => {
                    const isSelected = String(rating) === String(entry.rating)
                    return (
                      <button
                        key={entry.rating}
                        type="button"
                        onClick={() => {
                          setRating(isSelected ? '' : String(entry.rating))
                          setPage(1)
                        }}
                        aria-pressed={isSelected}
                        className={`rounded-xl border p-3 text-left transition ${
                          isSelected
                            ? 'border-orange-400 bg-orange-50/80 ring-2 ring-orange-200'
                            : 'border-slate-100 bg-slate-50/60 hover:border-orange-200 hover:bg-orange-50/30'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                          <span className="inline-flex items-center gap-1">
                            <IconStarFilled size={13} className="text-amber-500" aria-hidden="true" />
                            {entry.rating} Star{entry.rating === 1 ? '' : 's'}
                          </span>
                          <span className="tabular-nums text-slate-500">{entry.count} ({entry.percent}%)</span>
                        </div>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200/80">
                          <div
                            className="h-full rounded-full bg-orange-500 transition-[width] duration-300"
                            style={{ width: `${entry.percent}%` }}
                          />
                        </div>
                      </button>
                    )
                  })}
                </div>
              </section>
            )}

            <section className="rounded-xl border border-orange-100 bg-white p-4 shadow-sm sm:p-5" aria-label="Feedback filters">
              <div className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_220px_150px_160px]">
                <form onSubmit={applySearch} className="flex min-w-0">
                  <div className="relative min-w-0 flex-1">
                    <IconSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                    <input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search feedback" className="h-11 w-full rounded-l-lg border border-r-0 border-slate-200 bg-white pl-10 pr-9 text-sm text-slate-800 outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400" />
                    {searchInput && <button type="button" onClick={clearSearch} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700"><IconX size={15} /></button>}
                  </div>
                  <button type="submit" className="h-11 rounded-r-lg bg-orange-500 px-4 text-sm font-semibold text-white hover:bg-orange-600">Search</button>
                </form>
                <select aria-label="Filter by category" value={category} onChange={(event) => { setCategory(event.target.value); setPage(1) }} className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400">
                  <option value="">All categories</option>
                  {categories.map((item) => <option key={item.category} value={item.category}>{item.category} ({item.count})</option>)}
                </select>
                <select aria-label="Filter by rating" value={rating} onChange={(event) => { setRating(event.target.value); setPage(1) }} className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400">
                  <option value="">All ratings</option>
                  {[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} stars</option>)}
                </select>
                <select aria-label="Sort feedback" value={sort} onChange={(event) => { setSort(event.target.value); setPage(1) }} className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400">
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                </select>
              </div>
              {categories.length > 0 && (
                <div className="mt-3.5 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3.5" aria-label="Quick category filter">
                  <button
                    type="button"
                    onClick={() => { setCategory(''); setPage(1) }}
                    aria-pressed={category === ''}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                      category === ''
                        ? 'border-orange-500 bg-orange-500 text-white'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-orange-200 hover:text-orange-700'
                    }`}
                  >
                    All ({summary.totalFeedback})
                  </button>
                  {categories.map((item) => {
                    const active = category === item.category
                    return (
                      <button
                        key={item.category}
                        type="button"
                        onClick={() => { setCategory(active ? '' : item.category); setPage(1) }}
                        aria-pressed={active}
                        className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                          active
                            ? 'border-orange-500 bg-orange-100 text-orange-900 ring-2 ring-orange-200'
                            : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-orange-200 hover:bg-orange-50/40'
                        }`}
                      >
                        {item.category} ({item.count})
                      </button>
                    )
                  })}
                  {filtered && (
                    <button type="button" onClick={clearAllFilters} className="lm-action ml-auto">Clear filters</button>
                  )}
                </div>
              )}
              {categories.length === 0 && filtered && (
                <div className="mt-3 flex items-center justify-end border-t border-slate-100 pt-3">
                  <button type="button" onClick={clearAllFilters} className="lm-action">Clear filters</button>
                </div>
              )}
            </section>

            {feedback.length === 0 ? <EmptyState filtered={filtered} /> : (
              <>
                <section className="hidden overflow-hidden rounded-xl border border-orange-100 bg-white shadow-sm lg:block" aria-label="Submitted feedback">
                  <table className="w-full table-fixed text-left text-sm">
                    <thead className="border-b border-slate-200 bg-orange-50/50 text-xs uppercase tracking-wide text-slate-500">
                      <tr><th className="w-[10%] px-5 py-3 font-semibold">User ID</th><th className="w-[16%] px-5 py-3 font-semibold">Category</th><th className="w-[10%] px-5 py-3 font-semibold">Rating</th><th className="px-5 py-3 font-semibold">Feedback</th><th className="w-[18%] px-5 py-3 font-semibold">Submitted</th><th className="w-20 px-5 py-3 font-semibold">Action</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {feedback.map((item) => (
                        <tr key={item.feedbackId} className="align-top transition hover:bg-orange-50/30">
                          <td className="px-5 py-4 font-semibold tabular-nums text-slate-900">#{item.user.userId}</td>
                          <td className="px-5 py-4"><CategoryBadge value={item.category} /></td>
                          <td className="px-5 py-4"><Rating value={item.rating} /></td>
                          <td className="px-5 py-4"><p className="line-clamp-2 break-words leading-5 text-slate-600">{item.commentPreview || 'No additional comment.'}</p></td>
                          <td className="px-5 py-4 text-xs leading-5 text-slate-500">{formatDate(item.submittedAt)}</td>
                          <td className="px-5 py-4"><Link to={`/admin/feedback/${item.feedbackId}`} className="lm-action">View</Link></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>

                <section className="grid gap-4 sm:grid-cols-2 lg:hidden" aria-label="Submitted feedback">
                  {feedback.map((item) => (
                    <article key={item.feedbackId} className="rounded-xl border border-orange-100 bg-white p-5 shadow-sm">
                      <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">User ID</p><p className="mt-1 font-semibold tabular-nums text-slate-900">#{item.user.userId}</p></div><Rating value={item.rating} /></div>
                      <div className="mt-4 flex flex-wrap items-center gap-2"><CategoryBadge value={item.category} /><span className="text-xs text-slate-400">{formatDate(item.submittedAt)}</span></div>
                      <p className="mt-4 line-clamp-3 break-words text-sm leading-6 text-slate-600">{item.commentPreview || 'No additional comment.'}</p>
                      <Link to={`/admin/feedback/${item.feedbackId}`} className="lm-action mt-4">View feedback</Link>
                    </article>
                  ))}
                </section>

                <div className="flex flex-col items-center justify-between gap-3 text-sm text-slate-500 sm:flex-row">
                  <p>Showing {(pagination.page - 1) * pagination.pageSize + 1}–{Math.min(pagination.page * pagination.pageSize, pagination.total)} of {pagination.total} feedback records</p>
                  <div className="flex items-center gap-2">
                    <button type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)} className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 font-medium text-slate-600 hover:border-orange-200 hover:text-orange-700 disabled:cursor-not-allowed disabled:opacity-40"><IconChevronLeft size={16} /> Previous</button>
                    <span className="px-2 font-medium text-slate-700">Page {pagination.page} of {pagination.totalPages}</span>
                    <button type="button" disabled={page >= pagination.totalPages} onClick={() => setPage((current) => current + 1)} className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 font-medium text-slate-600 hover:border-orange-200 hover:text-orange-700 disabled:cursor-not-allowed disabled:opacity-40">Next <IconChevronRight size={16} /></button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

export default AdminFeedback
