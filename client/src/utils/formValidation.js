export function scrollToFirstInvalidField(fieldNames) {
  const firstField = fieldNames.find(Boolean)
  if (!firstField) return
  window.setTimeout(() => {
    const container = document.querySelector(`[data-validation-field="${firstField}"]`)
    if (!container) return
    container.scrollIntoView({ behavior: 'smooth', block: 'center' })
    const focusTarget = container.matches('input, select, textarea, button')
      ? container
      : container.querySelector('input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])')
    focusTarget?.focus({ preventScroll: true })
  }, 0)
}
