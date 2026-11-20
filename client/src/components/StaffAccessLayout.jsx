import { IconClipboardCheck, IconLock, IconShieldCheck } from '@tabler/icons-react'
import HeaderBrand from './HeaderBrand'
import './staffAccess.css'

export default function StaffAccessLayout({ role, title, description, wide = false, children, footer }) {
  const isAdmin = role === 'admin'
  const RoleIcon = isAdmin ? IconShieldCheck : IconClipboardCheck
  return <main id="main-content" className="staff-access">
    <div className={`staff-access-frame ${wide ? 'staff-access-wide' : ''}`}>
      <aside className="staff-access-rail">
        <span className="staff-access-brand"><HeaderBrand /></span>
        <div className="staff-access-identity">
          <span className="staff-access-icon"><RoleIcon size={26} stroke={1.7} aria-hidden="true" /></span>
          <p>{isAdmin ? 'Administrator' : 'Course Validator'}</p>
        </div>
        <span className="staff-access-private"><IconLock size={16} aria-hidden="true" /> Staff access</span>
      </aside>
      <div className="staff-access-content">
        <header className="mb-6 space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">{title}</h1>
          {description && <p className="max-w-lg text-sm leading-6 text-slate-600">{description}</p>}
        </header>
        <div className="space-y-4">{children}</div>
        {footer && <nav aria-label="Account actions" className="staff-access-links">{footer}</nav>}
      </div>
    </div>
  </main>
}
