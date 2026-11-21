import { useState } from 'react'
import {
  IconCamera,
  IconCheck,
  IconInfoCircle,
  IconShieldCheck,
} from '@tabler/icons-react'
import {
  MONITORING_EVENT_LABELS,
  summarizeFocusLevel,
} from '../utils/assessmentMonitoringApi'
import { EVENT_TYPES } from '../utils/monitoringDetection'
import CameraMonitoringModal from './CameraMonitoringModal'

const ORDERED_TYPES = [
  EVENT_TYPES.LOOKING_AWAY,
  EVENT_TYPES.CELLPHONE,
  EVENT_TYPES.NO_FACE,
  EVENT_TYPES.MULTIPLE_FACES,
  EVENT_TYPES.TAB_SWITCH,
  EVENT_TYPES.CAMERA_OFF,
]

export function AssessmentModeBadge({ summary }) {
  const focus = summarizeFocusLevel(summary)
  return (
    <span
      data-assessment-mode={focus.verified ? 'Verified' : 'Standard'}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold tracking-wide ${
        focus.verified
          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
          : 'border-stone-200 bg-stone-100 text-stone-700'
      }`}
    >
      {focus.verified ? (
        <IconShieldCheck size={15} stroke={2.1} aria-hidden="true" className="text-emerald-600" />
      ) : (
        <IconCamera size={14} stroke={1.9} aria-hidden="true" className="text-stone-500" />
      )}
      {focus.badge}
    </span>
  )
}

function PersonalFocusSummaryCard({ summary }) {
  const [showInfoModal, setShowInfoModal] = useState(false)
  const focus = summarizeFocusLevel(summary)
  const counts = summary?.counts || {}
  const totalEvents = Number(summary?.totalEvents || 0)

  return (
    <>
      <section
        aria-labelledby="personal-focus-summary-title"
        className="mt-8 overflow-hidden rounded-3xl border border-stone-200/80 bg-white shadow-[0_4px_24px_-16px_rgba(120,53,15,.15)]"
      >
        <div className="flex flex-col gap-3 border-b border-stone-100 bg-gradient-to-r from-orange-50/60 via-white to-white px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-orange-600">
              Assessment Integrity &amp; Focus
            </p>
            <h2 id="personal-focus-summary-title" className="mt-1 text-lg font-bold tracking-tight text-stone-900 sm:text-xl">
              Personal Focus Summary
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <AssessmentModeBadge summary={summary} />
            <button
              type="button"
              onClick={() => setShowInfoModal(true)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-orange-700 underline hover:text-orange-800"
            >
              <IconInfoCircle size={14} aria-hidden="true" />
              How camera monitoring works
            </button>
          </div>
        </div>

        <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[1.15fr_1.85fr]">
          <div
            className={`flex flex-col justify-between rounded-2xl border p-5 ${
              focus.verified
                ? 'border-emerald-100 bg-gradient-to-br from-emerald-50/80 to-white'
                : 'border-stone-200/80 bg-stone-50/70'
            }`}
          >
            <div>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                  focus.verified ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-200/80 text-stone-700'
                }`}
              >
                {focus.verified && <IconCheck size={13} stroke={2.4} aria-hidden="true" />}
                {focus.level}
              </span>
              <p className="mt-3 text-xl font-bold tracking-tight text-stone-900">
                {focus.headline}
              </p>
              <p className="mt-2 text-xs leading-6 text-stone-600">
                {focus.description}
              </p>
            </div>
            <div className="mt-5 flex items-baseline justify-between border-t border-stone-200/60 pt-3.5 text-xs text-stone-600">
              <span>Total focus reminders</span>
              <span className="text-lg font-bold tabular-nums text-stone-900">{totalEvents}</span>
            </div>
          </div>

          <div className="rounded-2xl border border-stone-200/70 bg-[#fdfcfb] p-5">
            <div className="mb-3.5 flex items-center justify-between gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500">
                Reminder Breakdown by Type
              </h3>
              <span className="text-[11px] text-stone-500">
                Zero score impact · Deleted after 30 days
              </span>
            </div>
            <dl className="grid gap-2.5 sm:grid-cols-2">
              {ORDERED_TYPES.map((type) => {
                const count = Number(counts[type] || 0)
                return (
                  <div
                    key={type}
                    className="flex items-center justify-between gap-3 rounded-xl border border-stone-200/70 bg-white px-3.5 py-2.5"
                  >
                    <dt className="text-xs font-medium text-stone-700">
                      {MONITORING_EVENT_LABELS[type]}
                    </dt>
                    <dd
                      className={`rounded-md px-2 py-0.5 text-xs font-bold tabular-nums ${
                        count > 0
                          ? 'border border-amber-200 bg-amber-50 text-amber-900'
                          : 'bg-stone-100 text-stone-600'
                      }`}
                    >
                      {count}
                    </dd>
                  </div>
                )
              })}
            </dl>
          </div>
        </div>
      </section>

      <CameraMonitoringModal open={showInfoModal} onClose={() => setShowInfoModal(false)} />
    </>
  )
}

export default PersonalFocusSummaryCard
