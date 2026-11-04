import './skeleton.css'

// Use the real page markup so loading and loaded views share their geometry.
export default function SkeletonContent({ loading = true, label = 'Loading content...', children }) {
  if (!loading) return children
  return <div role="status" aria-live="polite" aria-busy="true" aria-label={label}>
    <span className="sr-only">{label}</span>
    <div className="layout-skeleton" aria-hidden="true" inert>{children}</div>
  </div>
}

export function SkeletonBlock({ className = '' }) {
  return <div className={`skeleton-block rounded-lg bg-gray-200/70 ${className}`} />
}
