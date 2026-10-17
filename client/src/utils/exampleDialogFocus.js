// Native modal dialog makes the underlying page inert. Keep Tab cycling inside,
// restore scroll/focus on close, and leave all course form state untouched.
export function setupExampleDialog(dialog, closeButton, trigger) {
  const doc = dialog.ownerDocument
  const previousOverflow = doc.body.style.overflow
  const previousFocus = trigger || doc.activeElement
  dialog.showModal()
  doc.body.style.overflow = 'hidden'
  closeButton.focus()
  const trap = event => {
    if (event.key !== 'Tab') return
    const controls = [...dialog.querySelectorAll('button:not([disabled]), a[href]')]
    const first = controls[0], last = controls.at(-1)
    if (!first) return
    if (event.shiftKey && doc.activeElement === first) { event.preventDefault(); last.focus() }
    else if (!event.shiftKey && doc.activeElement === last) { event.preventDefault(); first.focus() }
  }
  dialog.addEventListener('keydown',trap)
  return () => {
    dialog.removeEventListener('keydown',trap)
    dialog.close()
    doc.body.style.overflow=previousOverflow
    if (previousFocus?.isConnected) previousFocus.focus()
  }
}
