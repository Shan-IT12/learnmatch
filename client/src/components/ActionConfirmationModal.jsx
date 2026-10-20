import { useEffect, useRef } from 'react'
import { IconArchive, IconArrowRight, IconArrowsExchange, IconHistory, IconLoader2, IconLogout, IconPlayerPause, IconRefresh, IconX } from '@tabler/icons-react'

const ACTION_DETAILS = {
  directions: {
    title: 'Share your location for directions?',
    description: 'If you continue and allow location access, LearnMatch sends your current latitude and longitude and the selected school’s coordinates to OpenRouteService (HeiGIT) to calculate a route. The map loads tiles from OpenStreetMap, which receives your IP address, browser request metadata, and the map area requested. Directions are optional; you can keep browsing schools without sharing your location.',
    cancelLabel: 'Keep browsing schools',
    confirmLabel: 'Continue to location permission',
    icon: IconArrowRight,
  },
  earlyCheckin: {
    title: 'Start this check-in early?',
    description: 'This check-in is ahead of your recommended schedule. Waiting until the recommended phase gives you more time to reflect on your experience.',
    cancelLabel: 'Wait for scheduled phase',
    confirmLabel: 'Continue early',
    icon: IconHistory,
  },
  logout: {
    title: 'Log out of LearnMatch?',
    description: 'Are you sure you want to log out? You can sign in again anytime.',
    cancelLabel: 'Stay signed in',
    confirmLabel: 'Yes, log out',
    icon: IconLogout,
  },
  leaveAssessment: {
    title: 'Leave this assessment?',
    description: 'Take a break and come back when you are ready.',
    noteTitle: 'Your progress stays saved',
    note: 'Your answers are saved for this assessment session, so you can return without starting over.',
    cancelLabel: 'Stay here',
    confirmLabel: 'Leave Assessment',
    icon: IconLogout,
  },
  retake: {
    title: 'Retake your assessment?',
    description: 'Start fresh with a new set of answers and discover how your course matches may change.',
    noteTitle: 'Your recommendations stay saved',
    note: 'Your current recommendations and completed assessment will stay saved in Assessment History, so you can view them again anytime.',
    confirmLabel: 'Start New Assessment',
    icon: IconRefresh,
  },
  pause: {
    title: 'Pause tracking?',
    description: 'Take a break from College Phase. No new terms or check-ins will be expected until you resume.',
    noteTitle: 'Your progress stays saved',
    note: 'Your completed check-ins and tracking history will remain available. You can resume when you are ready.',
    confirmLabel: 'Confirm Pause',
    icon: IconPlayerPause,
  },
  change: {
    title: 'Change program?',
    description: 'You will choose and confirm your new program next. This does not create a LearnMatch recommendation.',
    noteTitle: 'Your previous history stays saved',
    note: 'Your previous program history will remain unchanged and available for you to review.',
    confirmLabel: 'Change Program',
    icon: IconArrowsExchange,
  },
  end: {
    title: 'End tracking?',
    description: 'This will close your current tracking cycle and move it to your archive.',
    noteTitle: 'Your history stays available',
    note: 'Your completed tracking history will be preserved. You can start a new tracking cycle later.',
    confirmLabel: 'End Tracking',
    destructive: true,
    icon: IconArchive,
  },
}

function ActionConfirmationModal({ action, onCancel, onConfirm, processing = false, error = '', confirmDisabled = false, description }) {
  const dialogRef = useRef(null)
  const cancelButtonRef = useRef(null)
  const previousFocusRef = useRef(null)
  const onCancelRef = useRef(onCancel)

  useEffect(() => {
    onCancelRef.current = onCancel
  }, [onCancel])

  useEffect(() => {
    if (!action) return undefined

    previousFocusRef.current = document.activeElement
    cancelButtonRef.current?.focus()

    return () => {
      previousFocusRef.current?.focus?.()
    }
  }, [action])

  if (!action) return null

  const details = ACTION_DETAILS[action]
  const ActionIcon = details.icon
  const titleId = `college-${action}-confirmation-title`
  const descriptionId = `college-${action}-confirmation-description`

  const handleKeyDown = (event) => {
    if (event.key === 'Escape' && !processing) {
      event.preventDefault()
      onCancelRef.current()
      return
    }

    if (event.key !== 'Tab') return
    const focusable = dialogRef.current?.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')
    if (!focusable?.length) return

    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return (
    <div className="motion-page fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4 backdrop-blur-sm sm:p-6" style={action === 'directions' ? { zIndex: 1100 } : undefined} role="presentation">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={details.note ? `${descriptionId} ${descriptionId}-note` : descriptionId}
        aria-busy={processing}
        onKeyDown={handleKeyDown}
        className="relative max-h-[calc(100dvh-3rem)] w-full max-w-lg overflow-y-auto rounded-3xl border border-white/80 bg-white shadow-[0_32px_100px_-24px_rgba(15,23,42,.5)]"
      >
        <div className={`relative overflow-hidden px-6 pb-6 pt-9 text-center sm:px-9 sm:pb-7 sm:pt-10 ${details.destructive ? 'bg-gradient-to-b from-rose-50/90 to-white' : 'bg-gradient-to-b from-orange-50/90 via-orange-50/30 to-white'}`}>
          <button type="button" onClick={onCancel} disabled={processing} aria-label="Close confirmation" className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full border border-gray-200/80 bg-white/80 text-gray-400 transition hover:border-gray-300 hover:bg-white hover:text-gray-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500 disabled:cursor-not-allowed disabled:opacity-40"><IconX size={16} aria-hidden="true" /></button>
          <div aria-hidden="true" className={`mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full border-[8px] ${details.destructive ? 'border-rose-100/70 bg-rose-500 text-white shadow-[0_8px_24px_-12px_rgba(225,29,72,.5)]' : 'border-orange-100/80 bg-orange-500 text-white shadow-[0_8px_24px_-12px_rgba(249,115,22,.5)]'}`}><ActionIcon size={29} stroke={1.7} /></div>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">Before you continue</p>
          <h2 id={titleId} className="text-2xl font-bold leading-tight tracking-tight text-slate-950 sm:text-[28px]">{details.title}</h2>
          <p id={descriptionId} className="mx-auto mt-3 max-w-sm text-sm leading-6 text-slate-500">{description || details.description}</p>
        </div>

        <div className="px-6 pb-6 sm:px-8 sm:pb-8">
          {details.note && <div id={`${descriptionId}-note`} className="flex items-start gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4 sm:p-5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-emerald-100 bg-white text-emerald-600"><IconHistory size={18} stroke={1.8} aria-hidden="true" /></span>
            <div className="min-w-0"><p className="text-sm font-semibold leading-5 text-emerald-950">{details.noteTitle}</p><p className="mt-1.5 text-xs leading-6 text-emerald-900/75 sm:text-[13px]">{details.note}</p></div>
          </div>}
          {error && <p role="alert" className="mt-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">{error}</p>}
          <div className="mt-6 grid gap-3 sm:grid-cols-[.8fr_1.2fr]">
            <button
              ref={cancelButtonRef}
              type="button"
              onClick={onCancel}
              disabled={processing}
              className="order-2 inline-flex min-h-12 items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-600 transition hover:border-gray-300 hover:bg-gray-50 hover:text-gray-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500 disabled:cursor-not-allowed disabled:opacity-50 sm:order-1"
            >
              {details.cancelLabel || 'Cancel'}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={processing || confirmDisabled}
              className={`order-1 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white transition hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60 sm:order-2 ${details.destructive ? 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 focus-visible:outline-red-500' : 'bg-orange-500 shadow-sm shadow-orange-200 hover:bg-orange-600 focus-visible:outline-orange-500'}`}
            >
              {processing ? <><IconLoader2 size={17} className="motion-safe:animate-spin" aria-hidden="true" /> Processing...</> : <>{confirmDisabled ? 'Checking destination...' : details.confirmLabel}<IconArrowRight size={16} aria-hidden="true" /></>}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ActionConfirmationModal
