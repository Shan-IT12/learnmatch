import { Link, useNavigate } from 'react-router-dom'

function AdminHeader({ currentPage }) {
  const navigate = useNavigate()

  const handleLogout = () => {
    localStorage.removeItem('adminToken')
    localStorage.removeItem('adminUsername')
    navigate('/')
  }

  const navClass = (page) => `text-xs sm:text-sm font-medium px-2 sm:px-3 py-2 rounded-lg transition focus:outline-none focus:ring-2 focus:ring-orange-500 ${
    currentPage === page
      ? 'bg-orange-50 text-orange-600'
      : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
  }`

  return (
    <header className="bg-white border-b border-orange-100 shadow-sm">
      <div className="max-w-6xl mx-auto px-5 sm:px-8 py-4 flex flex-wrap items-center justify-between gap-3">
        <Link to="/admin" className="font-bold tracking-tight text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 rounded-md">
          Learn<span className="text-orange-500">Match</span>{' '}
          <span className="text-xs sm:text-sm font-medium text-gray-400">Admin Portal</span>
        </Link>
        <nav className="w-full sm:w-auto flex items-center justify-between sm:justify-end gap-1 sm:gap-2" aria-label="Admin navigation">
          <Link to="/admin" className={navClass('dashboard')}>Dashboard</Link>
          <Link to="/admin/courses" className={navClass('courses')}>Manage Courses</Link>
          <button type="button" onClick={handleLogout} className="text-xs sm:text-sm font-medium text-gray-500 hover:text-orange-600 px-2 sm:px-3 py-2 rounded-lg hover:bg-orange-50 transition focus:outline-none focus:ring-2 focus:ring-orange-500">
            Logout
          </button>
        </nav>
      </div>
    </header>
  )
}

export default AdminHeader
