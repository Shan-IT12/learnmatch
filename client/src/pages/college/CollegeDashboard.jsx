import { useNavigate } from 'react-router-dom'

function CollegeDashboard() {
  const navigate = useNavigate()
  const username = localStorage.getItem('username')
  const enrolledCourse = localStorage.getItem('enrolledCourse')
  const yearLevel = localStorage.getItem('yearLevel')
  const semester = localStorage.getItem('semester')

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-100 px-8 py-5 flex justify-between items-center">
        <span className="text-lg font-bold">
          Learn<span className="text-orange-500">Match</span>
        </span>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">Welcome, <strong>{username}</strong></span>
          <button
            onClick={() => navigate('/dashboard')}
            className="text-sm text-gray-500 hover:text-gray-900 transition"
          >
            Dashboard
          </button>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">College Phase</h1>
        <p className="text-gray-500 text-sm mb-8">
          Track your academic alignment and career roadmap.
        </p>

        {/* Enrollment info card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
          <p className="text-xs font-semibold text-orange-500 uppercase tracking-widest mb-3">
            Currently Enrolled
          </p>
          <h2 className="text-lg font-bold text-gray-900 mb-1">{enrolledCourse}</h2>
          <p className="text-sm text-gray-500">{yearLevel} · {semester}</p>
        </div>

        {/* Feature cards */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { title: 'Semester Check-in', desc: 'Rate your alignment this semester', icon: '📋' },
            { title: 'Career Roadmap', desc: 'See your year-by-year academic path', icon: '🗺️' },
            { title: 'Mismatch Detection', desc: 'AI analysis of your alignment score', icon: '🤖' },
          ].map((card) => (
            <div key={card.title} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <span className="text-2xl mb-3 block">{card.icon}</span>
              <h3 className="text-sm font-semibold text-gray-900 mb-1">{card.title}</h3>
              <p className="text-xs text-gray-400">{card.desc}</p>
              <p className="text-xs text-orange-400 mt-3">Coming soon</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default CollegeDashboard
