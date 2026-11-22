import { useEffect, useState } from 'react'
import LogoutButton from './LogoutButton'
import HeaderBrand from '../components/HeaderBrand'
import { Link, useNavigate } from 'react-router-dom'
import { ADMIN_ROLES, getRoleMeta, getStoredAdminRole } from '../utils/adminRole'

function AdminHeader({ currentPage }) {
  const navigate = useNavigate()
  const [adminRole, setAdminRole] = useState(() => getStoredAdminRole())

  useEffect(() => {
    const token = localStorage.getItem('adminToken')
    if (!token) return
    let cancelled = false
    fetch(`${import.meta.env.VITE_API_URL}/api/admin/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.admin) {
          if (data.admin.role) {
            localStorage.setItem('adminRole', data.admin.role)
            setAdminRole(data.admin.role)
          }
          if (data.admin.fullName) localStorage.setItem('adminFullName', data.admin.fullName)
          if (data.admin.email) localStorage.setItem('adminEmail', data.admin.email)
          else localStorage.removeItem('adminEmail')
        }
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  const roleMeta = getRoleMeta(adminRole)
  const isSystemDeveloper = roleMeta.key === ADMIN_ROLES.SYSTEM_DEVELOPER

  const handleLogout = () => {
    localStorage.removeItem('adminToken')
    localStorage.removeItem('adminUsername')
    localStorage.removeItem('adminRole')
    localStorage.removeItem('adminFullName')
    localStorage.removeItem('adminEmail')
    navigate('/')
  }

  const navClass = (page) => `lm-action ${currentPage === page ? 'lm-action-selected' : ''}`

  return (
    <header className="lm-site-header border-b border-orange-100 bg-white shadow-sm">
      <div className="lm-header-inner mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 px-5 py-3.5 sm:px-8 lg:flex-nowrap lg:px-10">
        <Link to="/admin" className="flex shrink-0 items-center gap-2.5 rounded-md text-xl font-bold tracking-tight text-slate-950 focus:outline-none focus:ring-2 focus:ring-orange-500">
          <span><HeaderBrand /></span>
          <span className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${roleMeta.badgeClass}`}>
            {roleMeta.label}
          </span>
        </Link>
        <nav className="lm-admin-navigation" aria-label="Admin navigation">
          {isSystemDeveloper ? (
            <>
              <Link to="/admin" className={navClass('dashboard')} aria-current={currentPage === 'dashboard' ? 'page' : undefined}>System Logs</Link>
              <Link to="/admin/accounts" className={navClass('accounts')} aria-current={currentPage === 'accounts' ? 'page' : undefined}>Governance</Link>
            </>
          ) : (
            <>
              <Link to="/admin" className={navClass('dashboard')} aria-current={currentPage === 'dashboard' ? 'page' : undefined}>Dashboard</Link>
              <Link to="/admin/users" className={navClass('users')} aria-current={currentPage === 'users' ? 'page' : undefined}>Users</Link>
              <Link to="/admin/courses" className={navClass('courses')} aria-current={currentPage === 'courses' ? 'page' : undefined}>Courses</Link>
              <Link to="/admin/validators" className={navClass('validators')} aria-current={currentPage === 'validators' ? 'page' : undefined}>Validators</Link>
              <Link to="/admin/analytics" className={navClass('analytics')} aria-current={currentPage === 'analytics' ? 'page' : undefined}>Analytics</Link>
              <Link to="/admin/feedback" className={navClass('feedback')} aria-current={currentPage === 'feedback' ? 'page' : undefined}>Feedback</Link>
              <Link to="/admin/accounts" className={navClass('accounts')} aria-current={currentPage === 'accounts' ? 'page' : undefined}>Accounts</Link>
            </>
          )}
          <LogoutButton onConfirm={handleLogout} className="lm-action lm-action-danger">
            Logout
          </LogoutButton>
        </nav>
      </div>
    </header>
  )
}

export default AdminHeader
