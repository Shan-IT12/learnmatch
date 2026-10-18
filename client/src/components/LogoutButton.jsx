import { useState } from 'react'
import { createPortal } from 'react-dom'
import ActionConfirmationModal from './ActionConfirmationModal'

export default function LogoutButton({ onConfirm, children = 'Logout', className = 'lm-action lm-action-danger' }) {
  const [open, setOpen] = useState(false)
  return <>
    <button type="button" className={className} aria-haspopup="dialog" onClick={() => setOpen(true)}>{children}</button>
    {open && createPortal(<ActionConfirmationModal
      action="logout"
      onCancel={() => setOpen(false)}
      onConfirm={() => { setOpen(false); onConfirm() }}
    />, document.body)}
  </>
}
