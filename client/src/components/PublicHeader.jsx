import HeaderBrand from '../components/HeaderBrand'
import { Link } from 'react-router-dom'

function PublicHeader({ activeCollegePhase = false, showDashboard = false, dashboardPath = '/dashboard' }) {
  const isAuthenticated = Boolean(localStorage.getItem('token'))
  const dashboardNavigation = isAuthenticated && showDashboard && activeCollegePhase === false
  const suppressGenericNavigation = isAuthenticated && activeCollegePhase !== false
  const homePath = dashboardNavigation ? dashboardPath : '/'

  return (
    <nav className="lm-site-header border-b border-gray-100 bg-white">
      <div className="lm-header-inner max-w-7xl mx-auto flex justify-between items-center px-5 sm:px-10 py-5">
        {suppressGenericNavigation ? (
          <span className="text-xl font-bold tracking-tight text-gray-900"><HeaderBrand /></span>
        ) : (
          <Link to={homePath} className="text-xl font-bold tracking-tight text-gray-900"><HeaderBrand /></Link>
        )}
        <div className="flex items-center gap-2">
          {!isAuthenticated && (
            <Link to="/login" className="lm-action">
              Log In
            </Link>
          )}
          {!isAuthenticated && <Link to="/register" className="lm-header-primary">Get Started</Link>}
          {!suppressGenericNavigation && dashboardNavigation && <Link to={dashboardPath} className="lm-header-primary">{dashboardPath === '/dashboard/summary' ? 'Summary Dashboard' : 'Dashboard'}</Link>}
        </div>
      </div>
    </nav>
  )
}

export default PublicHeader
