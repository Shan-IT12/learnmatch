import { useEffect, useState } from 'react'
import { IconAlertTriangle, IconCheck, IconChevronDown, IconChevronLeft, IconChevronRight, IconCopy, IconRefresh, IconTerminal2 } from '@tabler/icons-react'
import { ADMIN_ROLES, getStoredAdminRole } from '../../utils/adminRole'

function formatLogTimestamp(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  }).format(date)
}

export default function SystemErrorLogsPanel({ onUnauthorized }) {
  const [logs, setLogs] = useState([])
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 1 })
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedId, setExpandedId] = useState(null)
  const [copiedId, setCopiedId] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const isSystemDeveloper = getStoredAdminRole() === ADMIN_ROLES.SYSTEM_DEVELOPER

  const copyErrorReport = async (log) => {
    const report = [
      `LearnMatch Error Report (#${log.id})`,
      `Date/Time: ${formatLogTimestamp(log.created_at)}`,
      `Source: ${log.source}`,
      `Endpoint: ${log.endpoint}`,
      `Error Message: ${log.error_message}`,
    ].join('\n')
    try {
      await navigator.clipboard.writeText(report)
      setCopiedId(log.id)
      setTimeout(() => setCopiedId((curr) => (curr === log.id ? null : curr)), 2000)
    } catch {
      /* Clipboard unavailable in restricted contexts. */
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    const fetchLogs = async () => {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_URL}/api/admin/system-logs?page=${page}&limit=25`,
          {
            headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` },
            signal: controller.signal,
          }
        )
        if (response.status === 401 || response.status === 403) {
          onUnauthorized?.()
          return
        }
        const data = await response.json()
        if (!response.ok) {
          setError(data.message || 'Could not load system error logs.')
          return
        }
        setLogs(Array.isArray(data.logs) ? data.logs : [])
        if (data.pagination) setPagination(data.pagination)
      } catch (requestError) {
        if (requestError.name !== 'AbortError') {
          setError('Cannot connect to server. Please try again.')
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    fetchLogs()
    return () => controller.abort()
  }, [onUnauthorized, page, refreshKey])

  const triggerReload = (nextPage = page) => {
    setLoading(true)
    setError('')
    if (nextPage !== page) setPage(nextPage)
    else setRefreshKey((k) => k + 1)
  }

  return (
    <section aria-labelledby="system-logs-heading" className="rounded-xl border border-orange-100 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orange-50 text-orange-600">
            <IconTerminal2 size={19} stroke={1.8} />
          </span>
          <div>
            <h2 id="system-logs-heading" className="text-[17px] font-semibold text-slate-900">
              System Error Logs
            </h2>
            <p className="mt-0.5 text-sm text-slate-500">
              Centralized runtime exception log ({pagination.total.toLocaleString()} total record{pagination.total === 1 ? '' : 's'})
              {isSystemDeveloper
                ? ' · Full developer view with stack traces'
                : ' · Copy error details to report issues to the System Developer'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => triggerReload(page)}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:border-orange-300 hover:text-orange-700 disabled:opacity-50"
        >
          <IconRefresh size={15} />
          Refresh
        </button>
      </div>

      {error && (
        <div role="alert" className="m-5 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <IconAlertTriangle size={18} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="space-y-3 p-6 animate-pulse" aria-label="Loading system error logs">
          {[1, 2, 3, 4].map((row) => (
            <div key={row} className="h-12 rounded-lg bg-slate-100" />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3">Date / Time</th>
                <th className="px-5 py-3">Source</th>
                <th className="px-5 py-3">Endpoint</th>
                <th className="px-5 py-3">Error Message</th>
                <th className="px-5 py-3 text-right">{isSystemDeveloper ? 'Details' : 'Report'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.map((log) => {
                const isExpanded = expandedId === log.id
                const hasStack = isSystemDeveloper && Boolean(log.stack_trace)
                const isCopied = copiedId === log.id
                return (
                  <tr key={log.id} className="align-top hover:bg-orange-50/20">
                    <td className="whitespace-nowrap px-5 py-3.5 text-xs text-slate-600">
                      {formatLogTimestamp(log.created_at)}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5">
                      <span
                        className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-semibold ${
                          log.source === 'FRONTEND'
                            ? 'border-sky-200 bg-sky-50 text-sky-800'
                            : 'border-amber-200 bg-amber-50 text-amber-800'
                        }`}
                      >
                        {log.source}
                      </span>
                    </td>
                    <td className="max-w-xs break-all px-5 py-3.5 font-mono text-xs text-slate-800">
                      {log.endpoint}
                    </td>
                    <td className="max-w-md px-5 py-3.5 text-xs leading-5 text-slate-700">
                      <p className="break-words font-medium text-slate-900">{log.error_message}</p>
                      {isExpanded && hasStack && (
                        <pre className="mt-2.5 max-h-64 overflow-auto rounded-lg border border-slate-200 bg-slate-950 p-3 font-mono text-[11px] leading-5 text-slate-100">
                          {log.stack_trace}
                        </pre>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-right">
                      {isSystemDeveloper ? (
                        hasStack ? (
                          <button
                            type="button"
                            onClick={() => setExpandedId(isExpanded ? null : log.id)}
                            aria-expanded={isExpanded}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:border-orange-300 hover:text-orange-700"
                          >
                            Stack
                            <IconChevronDown
                              size={14}
                              className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                            />
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )
                      ) : (
                        <button
                          type="button"
                          onClick={() => copyErrorReport(log)}
                          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${
                            isCopied
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                              : 'border-slate-200 bg-white text-slate-700 hover:border-orange-300 hover:text-orange-700'
                          }`}
                        >
                          {isCopied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                          {isCopied ? 'Copied' : 'Copy Error Details'}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
              {!logs.length && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-sm text-slate-500">
                    No system errors recorded.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3.5 text-xs text-slate-600">
          <span>
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => triggerReload(Math.max(1, page - 1))}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 font-semibold text-slate-700 hover:border-orange-300 disabled:opacity-40"
            >
              <IconChevronLeft size={14} /> Previous
            </button>
            <button
              type="button"
              disabled={page >= pagination.totalPages || loading}
              onClick={() => triggerReload(Math.min(pagination.totalPages, page + 1))}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 font-semibold text-slate-700 hover:border-orange-300 disabled:opacity-40"
            >
              Next <IconChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
