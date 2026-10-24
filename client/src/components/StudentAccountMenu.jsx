import { useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { IconChevronDown, IconSettings, IconUserCircle } from '@tabler/icons-react'
import { HeaderAccount } from './HeaderBrand'

export default function StudentAccountMenu({ username, returnTo = 'dashboard', onProfile }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const triggerRef = useRef(null)
  const id = useId()
  useEffect(() => {
    if (!open) return undefined
    const closeOutside = event => {
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', closeOutside)
    return () => document.removeEventListener('pointerdown', closeOutside)
  }, [open])
  const itemClass = 'flex w-full items-center gap-2 rounded-lg px-3 py-3 text-left text-sm font-medium text-gray-700 hover:bg-orange-50 hover:text-orange-800 focus-visible:outline-2 focus-visible:outline-orange-500'
  return <div ref={rootRef} className="relative" onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
  }} onKeyDown={event => {
    if (event.key === 'Escape' && open) {
      event.preventDefault()
      setOpen(false)
      triggerRef.current?.focus()
    }
  }}>
    <button ref={triggerRef} type="button" className="lm-account-trigger" aria-label={`Account menu for ${username || 'your account'}`} aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)}>
      <HeaderAccount username={username} /><IconChevronDown size={14} aria-hidden="true" />
    </button>
    {open && <div id={id} className="absolute left-0 top-full z-40 mt-2 w-48 rounded-xl border border-gray-200 bg-white p-1.5 shadow-lg sm:left-auto sm:right-0">
      <button type="button" className={itemClass} onClick={() => { setOpen(false); onProfile() }}><IconUserCircle size={16} aria-hidden="true" /> Profile</button>
      <Link className={itemClass} to={`/settings?returnTo=${returnTo}`} onClick={() => setOpen(false)}><IconSettings size={16} aria-hidden="true" /> Settings</Link>
    </div>}
  </div>
}
