import { useEffect } from 'react'
import {
  IconCamera,
  IconCheck,
  IconClock,
  IconEyeOff,
  IconLock,
  IconShieldCheck,
  IconSparkles,
  IconX,
} from '@tabler/icons-react'

const ITEMS = [
  {
    icon: IconCamera,
    title: 'What is checked',
    body: 'Prolonged looking away or down, visible external device in the camera frame, missing face, multiple faces, and browser tab or window switches.',
  },
  {
    icon: IconEyeOff,
    title: 'What is NOT saved',
    body: 'Zero video recordings, zero photos or screenshots, and zero audio capture. Camera frames are analyzed on your device and immediately discarded.',
  },
  {
    icon: IconCheck,
    title: 'What IS saved',
    body: 'Only lightweight event metadata: the detection event type, timestamp, and current assessment step.',
  },
  {
    icon: IconLock,
    title: 'Who has access',
    body: 'Your Personal Focus Summary is visible to you, and authorized Administrators can review only the metadata event logs for assessment integrity.',
  },
  {
    icon: IconShieldCheck,
    title: 'When it stops',
    body: 'Monitoring stops automatically the moment you submit or exit the assessment, or whenever you click Turn Off Camera.',
  },
  {
    icon: IconSparkles,
    title: 'Score impact',
    body: 'Zero effect on your WSM scores, quiz results, or course recommendations. Focus reminders never deduct points or cause an automatic fail.',
  },
  {
    icon: IconClock,
    title: 'Log retention',
    body: 'All assessment monitoring event logs are automatically deleted after 30 days.',
  },
]

function CameraMonitoringModal({ open, onClose }) {
  useEffect(() => {
    if (!open) return undefined
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[75] flex items-center justify-center overflow-y-auto bg-slate-950/55 p-4 backdrop-blur-sm sm:p-6"
      role="presentation"
      onClick={(event) => { if (event.target === event.currentTarget) onClose() }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="camera-monitoring-modal-title"
        className="relative max-h-[calc(100dvh-2.5rem)] w-full max-w-2xl overflow-y-auto rounded-3xl border border-stone-200/80 bg-white shadow-[0_32px_100px_-24px_rgba(15,23,42,.55)]"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-stone-100 bg-gradient-to-b from-orange-50/90 via-orange-50/40 to-white px-6 pb-5 pt-6 sm:px-8">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-orange-600">
              Privacy &amp; Transparency
            </p>
            <h2 id="camera-monitoring-modal-title" className="mt-1 text-xl font-bold tracking-tight text-stone-950 sm:text-2xl">
              How Camera Monitoring Works
            </h2>
            <p className="mt-1.5 text-xs leading-5 text-stone-600 sm:text-sm">
              Automated monitoring · No recording · Processed entirely in your browser.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close how camera monitoring works"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-stone-200/80 bg-white text-stone-500 transition hover:border-stone-300 hover:text-stone-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500"
          >
            <IconX size={17} aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-3.5 px-6 py-6 sm:px-8">
          {ITEMS.map((item) => {
            const ItemIcon = item.icon
            return (
              <div
                key={item.title}
                className="flex items-start gap-3.5 rounded-2xl border border-stone-200/70 bg-stone-50/50 p-4"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-orange-100 bg-orange-50 text-orange-600">
                  <ItemIcon size={18} stroke={1.9} aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-stone-900">{item.title}</h3>
                  <p className="mt-1 text-xs leading-6 text-stone-600 sm:text-[13px]">{item.body}</p>
                </div>
              </div>
            )
          })}
        </div>

        <div className="flex flex-col gap-3 border-t border-stone-100 bg-stone-50/70 px-6 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-stone-600">
            <a
              href="/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-orange-700 underline hover:text-orange-800"
            >
              Read Privacy Notice
            </a>
            <span aria-hidden="true" className="text-stone-300">·</span>
            <a
              href="mailto:learnmatch1@gmail.com"
              className="font-semibold text-orange-700 underline hover:text-orange-800"
            >
              Privacy Contact (learnmatch1@gmail.com)
            </a>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-xl bg-orange-500 px-5 py-2.5 text-xs font-semibold text-white shadow-sm shadow-orange-200 transition hover:bg-orange-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500 sm:text-sm"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}

export default CameraMonitoringModal
