import './siteHeader.css'

export default function HeaderBrand() {
  return <span className="text-xl font-bold tracking-tight text-gray-900">Learn<span className="text-orange-500">Match</span></span>
}

export function HeaderAccount({ username }) {
  const name = String(username || 'Your account')
  const initials = name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase()
  return <span className="lm-header-account"><span className="lm-account-avatar" aria-hidden="true">{initials}</span><span className="lm-account-text"><span className="lm-account-label">Welcome back</span><strong title={name}>{name}</strong></span></span>
}
