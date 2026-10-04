export function RequiredMark() {
  return <span className="ml-0.5 text-xs font-bold text-red-500" aria-hidden="true">*</span>
}

export function FieldError({ id, children }) {
  if (!children) return null
  return <p id={id} role="alert" className="mt-1.5 text-xs font-medium text-red-600">{children}</p>
}
