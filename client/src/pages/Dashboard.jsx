import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

function Dashboard() {
  const [username, setUsername] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
  const token = localStorage.getItem('token')

  if (!token) {
    navigate('/login')
    return
  }

  const storedUsername = localStorage.getItem('username')
  setUsername(storedUsername)
}, [navigate])

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
            onClick={handleLogout}
            className="bg-red-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-red-600 transition"
          >
            Logout
          </button>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto py-16 px-4 text-center">
        <h2 className="text-3xl font-bold mb-4">Welcome back, {username}! 👋</h2>
        <p className="text-gray-600 mb-8">You're now logged in to LearnMatch.</p>

        <div className="bg-white rounded-xl shadow p-8">
          <p className="text-gray-500">Your dashboard is being built. Check back soon!</p>
        </div>
      </div>
    </div>
  )
}

export default Dashboard