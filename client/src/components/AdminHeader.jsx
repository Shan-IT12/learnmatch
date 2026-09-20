import { Link, useNavigate } from 'react-router-dom'

function AdminHeader({ currentPage }) {
  const navigate = useNavigate()

  const handleLogout = () => {
    localStorage.removeItem('adminToken')
    localStorage.removeItem('adminUsername')
    navigate('/')
  }

  const navClass = (page) => `text-sm font-medium px-2.5 sm:px-3 py-2 rounded-md transition focus:outline-none focus:ring-2 focus:ring-orange-500 ${
    currentPage === page
      ? 'bg-orange-50 text-orange-700'
      : 'text-slate-600 hover:text-slate-950 hover:bg-slate-50'
  }`

  return (
    <header className="border-b border-orange-100 bg-white shadow-sm">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-8 lg:px-10">
        <Link to="/admin" className="flex items-baseline gap-2 rounded-md text-xl font-bold tracking-tight text-slate-950 focus:outline-none focus:ring-2 focus:ring-orange-500">
          <span>Learn<span className="text-orange-500">Match</span></span>
          <span className="text-sm font-semibold text-slate-500">Admin Portal</span>
        </Link>
        <nav className="w-full sm:w-auto flex items-center justify-between sm:justify-end gap-1 sm:gap-2" aria-label="Admin navigation">
          <Link to="/admin" className={navClass('dashboard')}>Dashboard</Link>
          <Link to="/admin/courses" className={navClass('courses')}>Manage Courses</Link>
          <button type="button" onClick={handleLogout} className="rounded-md px-2.5 py-2 text-sm font-medium text-slate-600 transition hover:bg-orange-50 hover:text-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 sm:px-3">
            Logout
          </button>
        </nav>
      </div>
    </header>
  )
}

export default AdminHeader
