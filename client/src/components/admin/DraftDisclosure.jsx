import { useEffect, useId, useRef, useState } from 'react'

export function DraftGuidance({ children, label = 'View guidance' }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  return <div className="text-xs text-gray-600">
    <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)} className="rounded text-orange-700 underline underline-offset-2 focus:outline-none focus:ring-2 focus:ring-orange-500">{open ? label.replace('View', 'Hide') : label}</button>
    <div id={id} hidden={!open} className="mt-2 space-y-2 leading-5">{children}</div>
  </div>
}

// Contents stay mounted. Revealing validation errors changes presentation only.
export default function DraftDisclosure({ title, children, defaultOpen = false, hasError = false, enabled = true, summary, actions, level = 'h2' }) {
  const [state, setState] = useState({ open: defaultOpen || hasError, error: hasError })
  if (state.error !== hasError) setState({ open: hasError || state.open, error: hasError })
  const root = useRef(null)
  const id = useId()
  useEffect(() => {
    const element = root.current
    const reveal = () => setState(current => ({ ...current, open: true }))
    element?.addEventListener('draft:reveal', reveal)
    return () => element?.removeEventListener('draft:reveal', reveal)
  }, [enabled])
  if (!enabled) return children
  const Heading = level
  return <section ref={root} data-draft-disclosure className="min-w-0 rounded-xl border border-orange-100 bg-white">
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
      <Heading className="min-w-0 flex-1 text-base font-semibold text-gray-900">
        <button type="button" aria-expanded={state.open} aria-controls={id} onClick={() => setState(current => ({ ...current, open: !current.open }))} className="flex w-full items-center gap-2 rounded text-left focus:outline-none focus:ring-2 focus:ring-orange-500">
          <span aria-hidden="true" className="shrink-0 text-orange-600">{state.open ? '−' : '+'}</span><span className="min-w-0 break-words">{title}</span>
          {hasError && <span className="shrink-0 text-xs font-medium text-red-600">Needs attention</span>}
        </button>
      </Heading>
      {actions}
    </div>
    {summary && <div className="px-4 pb-3 text-sm sm:px-5">{typeof summary === 'function' ? summary({ open: state.open }) : summary}</div>}
    <div id={id} hidden={!state.open} className="border-t border-orange-100 px-4 py-4 sm:px-5">{children}</div>
  </section>
}
