import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

function Dashboard() {
  const navigate = useNavigate()
  const token = localStorage.getItem('token')
  const username = localStorage.getItem('username')

  useEffect(() => {
    if (!token) {
      navigate('/login')
    }
  }, [navigate, token])

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('userId')
    localStorage.removeItem('username')
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow px-8 py-4 flex justify-between items-center">
        <h1 className="text-xl font-bold">
          Learn<span className="text-orange-600">Match</span>
        </h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">Welcome, <strong>{username}</strong></span>
          <button
            onClick={() => navigate('/profile')}
            className="bg-orange-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-orange-700 transition"
          >
            Edit Profile
          </button>
          <button
            onClick={handleLogout}
            className="bg-red-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-red-600 transition"
          >
            Logout
          </button>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto py-12 px-4">
  <h2 className="text-2xl font-bold mb-2">Welcome back, {username}!</h2>
  <p className="text-gray-500 text-sm mb-8">What would you like to do today?</p>

  <div className="grid grid-cols-2 gap-6">
    {/* Card 1 - Assessment */}
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
      <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center mb-4">
        <span className="text-orange-500 text-lg">📝</span>
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        Not sure what to take yet?
      </h3>
      <p className="text-gray-500 text-sm mb-6">
        Take the assessment to get personalized course recommendations based on your skills, interests, and personality.
      </p>
      <button
        onClick={() => navigate('/onboarding/profile')}
        className="w-full bg-orange-500 text-white py-3 rounded-xl font-medium hover:bg-orange-600 transition text-sm"
      >
        Start Assessment →
      </button>
    </div>

          {/* Card 2 - College Student */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
            <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center mb-4">
              <span className="text-gray-500 text-lg">🎓</span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Already enrolled in college?
            </h3>
            <p className="text-gray-500 text-sm mb-6">
              Track your academic alignment, semester progress, and career roadmap.
            </p>
            <button
              onClick={() => navigate('/college/setup')}
              className="w-full bg-gray-900 text-white py-3 rounded-xl font-medium hover:bg-gray-700 transition text-sm"
            >
              I'm a College Student →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard