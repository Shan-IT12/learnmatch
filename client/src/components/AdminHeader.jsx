import LogoutButton from './LogoutButton'
import HeaderBrand from '../components/HeaderBrand'
import { Link, useNavigate } from 'react-router-dom'

function AdminHeader({ currentPage }) {
  const navigate = useNavigate()

  const handleLogout = () => {
    localStorage.removeItem('adminToken')
    localStorage.removeItem('adminUsername')
    navigate('/')
  }

  const navClass = (page) => `lm-action ${currentPage === page ? 'lm-action-selected' : ''}`

  return (
    <header className="lm-site-header border-b border-orange-100 bg-white shadow-sm">
      <div className="lm-header-inner mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-8 lg:px-10">
        <Link to="/admin" className="flex items-center gap-3 rounded-md text-xl font-bold tracking-tight text-slate-950 focus:outline-none focus:ring-2 focus:ring-orange-500">
          <span><HeaderBrand /></span>
          <span className="hidden rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500 sm:inline">Admin Portal</span>
        </Link>
        <nav className="grid w-full min-w-0 grid-cols-3 items-center gap-1 sm:flex sm:w-auto sm:justify-end sm:gap-2" aria-label="Admin navigation">
          <Link to="/admin" className={navClass('dashboard')} aria-current={currentPage === 'dashboard' ? 'page' : undefined}>Dashboard</Link>
          <Link to="/admin/users" className={navClass('users')} aria-current={currentPage === 'users' ? 'page' : undefined}>Users</Link>
          <Link to="/admin/courses" className={navClass('courses')} aria-current={currentPage === 'courses' ? 'page' : undefined}>Manage Courses</Link>
          <Link to="/admin/analytics" className={navClass('analytics')} aria-current={currentPage === 'analytics' ? 'page' : undefined}>Analytics</Link>
          <Link to="/admin/feedback" className={navClass('feedback')} aria-current={currentPage === 'feedback' ? 'page' : undefined}>Feedback</Link>
          <LogoutButton type="button" onConfirm={handleLogout} className="lm-action lm-action-danger sm:shrink-0">
            Logout
          </LogoutButton>
        </nav>
      </div>
    </header>
  )
}

export default AdminHeader
