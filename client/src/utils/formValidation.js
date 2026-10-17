export function scrollToFirstInvalidField(fieldNames) {
  const firstField = fieldNames.find(Boolean)
  if (!firstField) return
  window.setTimeout(() => {
    const container = document.querySelector(`[data-validation-field="${firstField}"]`)
    if (!container) return
    if (container.closest('[data-draft-disclosure]') || container.querySelector('[data-draft-disclosure]')) {
      const target = container.querySelector('[aria-invalid="true"]:not([disabled]), input:invalid:not([disabled]), select:invalid:not([disabled]), textarea:invalid:not([disabled])')
        || (container.matches('input, select, textarea, button') ? container : container.querySelector('input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])'))
      target?.dispatchEvent(new Event('draft:reveal', { bubbles: true }))
      window.setTimeout(() => {
        target?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        target?.focus({ preventScroll: true })
      }, 0)
      return
    }
    container.scrollIntoView({ behavior: 'smooth', block: 'center' })
    const focusTarget = container.matches('input, select, textarea, button')
      ? container
      : container.querySelector('input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])')
    focusTarget?.focus({ preventScroll: true })
  }, 0)
}
