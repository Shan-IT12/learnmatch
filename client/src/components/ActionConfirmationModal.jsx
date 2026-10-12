import { useEffect, useRef } from 'react'
import { IconAlertTriangle } from '@tabler/icons-react'

const ACTION_DETAILS = {
  pause: {
    title: 'Pause tracking?',
    description: 'No new terms or check-ins will be expected until you resume. Your progress and history will remain available.',
    confirmLabel: 'Confirm Pause',
  },
  change: {
    title: 'Change program?',
    description: 'Your previous program history will remain unchanged, and this will not create a LearnMatch recommendation. You will choose and confirm your new program next.',
    confirmLabel: 'Change Program',
  },
  end: {
    title: 'End tracking?',
    description: 'Your tracking will be archived. Your history will be preserved, and you can start a new tracking cycle later.',
    confirmLabel: 'End Tracking',
    destructive: true,
  },
}

function ActionConfirmationModal({ action, onCancel, onConfirm, processing = false }) {
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
    <div className="motion-page fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/40 p-3 backdrop-blur-[2px] sm:p-6" role="presentation">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        aria-busy={processing}
        onKeyDown={handleKeyDown}
        className="relative w-full max-w-[30rem] overflow-hidden rounded-[28px] border border-orange-100/90 bg-white shadow-[0_28px_70px_-30px_rgba(15,23,42,.42)]"
      >
        <div aria-hidden="true" className={`absolute inset-x-0 top-0 h-1 ${details.destructive ? 'bg-gradient-to-r from-red-500 via-red-600 to-rose-500' : 'bg-gradient-to-r from-amber-400 via-orange-500 to-orange-600'}`} />
        <div className="relative p-5 pt-6 sm:p-8 sm:pt-9">
          <div className="flex items-start gap-4 sm:gap-5">
            <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border shadow-sm sm:h-14 sm:w-14 ${details.destructive ? 'border-red-100 bg-red-50 text-red-600 shadow-red-100/70' : 'border-orange-100 bg-orange-50 text-orange-600 shadow-orange-100/70'}`}>
              <IconAlertTriangle size={24} stroke={2.1} aria-hidden="true" />
            </span>
            <div className="min-w-0 pt-0.5">
              <h2 id={titleId} className="text-xl font-bold leading-tight tracking-[-0.025em] text-slate-950 sm:text-[1.35rem]">{details.title}</h2>
              <p id={descriptionId} className="mt-2.5 max-w-[23rem] text-sm leading-6 text-slate-600 sm:text-[0.9375rem]">{details.description}</p>
            </div>
          </div>

          <div className="mt-7 flex flex-col-reverse gap-2.5 border-t border-slate-100 pt-5 sm:mt-8 sm:flex-row sm:justify-end sm:gap-3 sm:pt-6">
            <button
              ref={cancelButtonRef}
              type="button"
              onClick={onCancel}
              disabled={processing}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={processing}
              className={`inline-flex min-h-11 w-full items-center justify-center rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition duration-150 hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:min-w-36 ${details.destructive ? 'bg-gradient-to-r from-red-600 to-rose-600 shadow-[0_12px_26px_-14px_rgba(220,38,38,.85)] hover:from-red-700 hover:to-rose-700 focus-visible:ring-red-500' : 'bg-gradient-to-r from-orange-500 to-orange-600 shadow-[0_12px_26px_-14px_rgba(234,88,12,.85)] hover:from-orange-600 hover:to-orange-700 focus-visible:ring-orange-400'}`}
            >
              {processing ? 'Processing...' : details.confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ActionConfirmationModal
