import { useState } from 'react'
import {
  IconCamera,
  IconChevronDown,
  IconChevronUp,
  IconFlag,
  IconShieldCheck,
} from '@tabler/icons-react'
import { MONITORING_EVENT_LABELS } from '../../utils/assessmentMonitoringApi'

const STEP_LABELS = Object.freeze({
  personal_factors: 'Personal Factors (Step 1)',
  interests: 'Interests (Step 2)',
  academic_skills: 'Academic Skills (Step 3)',
  personality: 'Personality (Step 4)',
  assessment: 'Assessment',
})

function formatTimestamp(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(value))
}

export function AdminMonitoringBadge({ cameraEnabled, mode, flagCount = 0 }) {
  const verified = Boolean(cameraEnabled) || mode === 'Verified'
  const count = Number(flagCount || 0)

  return (
    <div className="inline-flex flex-wrap items-center gap-1.5">
      <span
        data-monitoring-mode={verified ? 'Verified' : 'Standard'}
        className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold ${
          verified
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
            : 'border-slate-200 bg-slate-100 text-slate-600'
        }`}
      >
        {verified ? (
          <IconShieldCheck size={13} stroke={2.1} aria-hidden="true" />
        ) : (
          <IconCamera size={13} stroke={1.9} aria-hidden="true" />
        )}
        {verified ? 'Verified · Camera Used' : 'Standard · No Camera'}
      </span>
      <span
        className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold tabular-nums ${
          count > 0
            ? 'border-amber-200 bg-amber-50 text-amber-800'
            : 'border-slate-200 bg-slate-50 text-slate-600'
        }`}
      >
        <IconFlag size={12} stroke={2} aria-hidden="true" />
        {count} {count === 1 ? 'flag' : 'flags'}
      </span>
    </div>
  )
}

function AttemptLogRow({ attempt, defaultExpanded = false }) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [detail, setDetail] = useState(null)

  const toggleExpand = async () => {
    const next = !expanded
    setExpanded(next)
    if (!next || detail || loading) return
    setLoading(true)
    setError('')
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || ''}/api/admin/assessment-attempts/${encodeURIComponent(attempt.attemptId)}/monitoring`,
        {
          headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` },
          cache: 'no-store',
        }
      )
      if (!response.ok) throw new Error('Could not load monitoring event logs for this attempt.')
      const data = await response.json()
      setDetail(data)
    } catch (err) {
      setError(err.message || 'Could not load monitoring event logs.')
    } finally {
      setLoading(false)
    }
  }

  const events = detail?.events || []
  const flagCount = detail ? Number(detail.totalEvents || 0) : Number(attempt.flagCount || 0)

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white">
      <div className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-sm font-bold tabular-nums text-slate-900">
            Attempt #{attempt.attemptId}
          </span>
          <span
            className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-medium ${
              attempt.status === 'Completed'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-amber-200 bg-amber-50 text-amber-700'
            }`}
          >
            {attempt.status}
          </span>
          <AdminMonitoringBadge
            cameraEnabled={detail ? detail.cameraEnabled : attempt.cameraEnabled}
            mode={detail ? detail.mode : attempt.mode}
            flagCount={flagCount}
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-end">
          <span className="text-xs text-slate-500">
            {attempt.completedAt
              ? `Completed ${formatTimestamp(attempt.completedAt)}`
              : `Started ${formatTimestamp(attempt.startedAt)}`}
          </span>
          <button
            type="button"
            onClick={toggleExpand}
            aria-expanded={expanded}
            className="inline-flex items-center gap-1 rounded-lg border border-orange-200 bg-orange-50/70 px-3 py-1.5 text-xs font-semibold text-orange-800 transition hover:bg-orange-100"
          >
            {expanded ? 'Hide Event Logs' : 'View Event Logs'}
            {expanded ? <IconChevronUp size={14} aria-hidden="true" /> : <IconChevronDown size={14} aria-hidden="true" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-3.5">
          {loading ? (
            <p className="text-xs text-slate-500">Loading monitoring event logs…</p>
          ) : error ? (
            <p role="alert" className="text-xs font-medium text-red-700">{error}</p>
          ) : events.length === 0 ? (
            <p className="text-xs text-slate-600">
              No monitoring flags were logged for this attempt.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="w-full min-w-[460px] text-left text-xs">
                <thead className="border-b border-slate-100 bg-slate-50 uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3.5 py-2.5 font-semibold">Event Type</th>
                    <th className="px-3.5 py-2.5 font-semibold">Assessment Step</th>
                    <th className="px-3.5 py-2.5 font-semibold">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {events.map((event, index) => (
                    <tr key={`${event.eventType}-${event.createdAt}-${index}`}>
                      <td className="px-3.5 py-2.5 font-semibold text-slate-900">
                        {MONITORING_EVENT_LABELS[event.eventType] || event.eventType}
                        <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] font-normal text-slate-600">
                          {event.eventType}
                        </span>
                      </td>
                      <td className="px-3.5 py-2.5 text-slate-700">
                        {STEP_LABELS[event.assessmentStep] || event.assessmentStep}
                      </td>
                      <td className="whitespace-nowrap px-3.5 py-2.5 tabular-nums text-slate-600">
                        {formatTimestamp(event.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-2.5 text-[11px] text-slate-500">
            Metadata only — zero video, photos, or audio are ever captured or stored. Logs are automatically purged after 30 days.
          </p>
        </div>
      )}
    </div>
  )
}

export function AdminAttemptLogsSection({ attempts = [] }) {
  if (!attempts.length) {
    return (
      <p className="text-sm text-slate-500">
        No assessment attempts recorded for this student yet.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {attempts.map((attempt, index) => (
        <AttemptLogRow
          key={attempt.attemptId}
          attempt={attempt}
          defaultExpanded={index === 0 && Number(attempt.flagCount || 0) > 0}
        />
      ))}
    </div>
  )
}

export default AdminAttemptLogsSection
