export const SUCCESS_CONFIRMATION_DELAY_MS = 650

export function getSuccessConfirmationDelay(matchMedia = globalThis.matchMedia) {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
    ? 0
    : SUCCESS_CONFIRMATION_DELAY_MS
}

export function waitForSuccessConfirmation(matchMedia) {
  return new Promise((resolve) => setTimeout(resolve, getSuccessConfirmationDelay(matchMedia)))
}
