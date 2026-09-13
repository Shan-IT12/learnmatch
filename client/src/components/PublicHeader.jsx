import { Link } from 'react-router-dom'

function PublicHeader() {
  return (
    <nav className="border-b border-gray-100 bg-white">
      <div className="max-w-7xl mx-auto flex justify-between items-center px-5 sm:px-10 py-5">
        <Link to="/" className="text-xl font-bold tracking-tight text-gray-900">
          Learn<span className="text-orange-500">Match</span>
        </Link>
        <div className="flex items-center gap-2">
          <Link to="/login" className="text-sm text-gray-500 hover:text-gray-900 px-3 sm:px-4 py-2">
            Log In
          </Link>
          <Link to="/register" className="text-sm bg-orange-500 text-white px-3 sm:px-4 py-2.5 rounded-lg hover:bg-orange-600 font-medium">
            Get Started
          </Link>
        </div>
      </div>
    </nav>
  )
}

export default PublicHeader
