import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

const clusterCards = [
  { label: 'Engineering / STEM', score: 92, color: 'bg-orange-500', delay: '0s' },
  { label: 'Healthcare Science', score: 78, color: 'bg-gray-800', delay: '0.4s' },
  { label: 'Business', score: 65, color: 'bg-orange-400', delay: '0.8s' },
]

function ClusterCard({ label, score, color, delay }) {
  return (
    <div
      className="bg-white rounded-2xl shadow-lg px-5 py-4 w-56 border border-gray-100"
      style={{
        animation: `float 4s ease-in-out infinite`,
        animationDelay: delay,
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Match
        </span>
        <span className="text-sm font-bold text-gray-900">{score}%</span>
      </div>
      <p className="text-sm font-semibold text-gray-800 mb-3">{label}</p>
      <div className="w-full bg-gray-100 rounded-full h-1.5">
        <div
          className={`${color} h-1.5 rounded-full transition-all`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  )
}

function Landing() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null)
  const [searching, setSearching] = useState(false)
  const navigate = useNavigate()

  const handleSearch = async (e) => {
    e.preventDefault()
    if (!query.trim()) return
    setSearching(true)
    try {
      const response = await fetch(
        `http://localhost:5000/api/search?q=${encodeURIComponent(query)}`
      )
      const data = await response.json()
      setResults(data)
    } catch {
      setResults({ courses: [], schools: [] })
    }
    setSearching(false)
  }

  return (
    <div className="min-h-screen bg-white overflow-hidden">

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
      `}</style>

      {/* Nav */}
      <nav className="flex justify-between items-center px-10 py-5">
        <span className="text-xl font-bold tracking-tight text-gray-900">
          Learn<span className="text-orange-500">Match</span>
        </span>
        <div className="flex items-center gap-2">
          <Link
            to="/login"
            className="text-sm text-gray-500 hover:text-gray-900 transition px-4 py-2 rounded-lg hover:bg-gray-50"
          >
            Log In
          </Link>
          <Link
            to="/register"
            className="text-sm bg-orange-500 text-white px-4 py-2.5 rounded-lg hover:bg-orange-600 transition font-medium"
          >
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero — split layout */}
      <div className="max-w-7xl mx-auto px-10 pt-12 pb-16 grid grid-cols-2 gap-16 items-center min-h-[calc(100vh-80px)]">

        {/* Left side — content */}
        <div className="max-w-lg">
          <div className="inline-flex items-center gap-2 bg-orange-50 text-orange-600 text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
            <span className="w-1.5 h-1.5 bg-orange-500 rounded-full" />
            AI-assisted course recommendation
          </div>

          <h1 className="text-5xl font-bold text-gray-900 leading-tight mb-5">
            Find the right
            <br />
            course for{' '}
            <span className="text-orange-500">your</span>
            <br />
            <span className="text-orange-500">future.</span>
          </h1>

          <p className="text-base text-gray-500 leading-relaxed mb-8">
            Answer a few questions about your skills, interests, and personality.
            Get personalized course recommendations that actually fit who you are.
          </p>

          <div className="flex items-center gap-3 mb-10">
            <Link
              to="/register"
              className="inline-flex items-center gap-2 bg-orange-500 text-white px-6 py-3 rounded-xl font-medium hover:bg-orange-600 transition text-sm"
            >
              Start Assessment
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 text-gray-600 text-sm hover:text-gray-900 transition px-4 py-3"
            >
              Already have an account? Log in
            </Link>
          </div>

          {/* Search */}
          <div className="relative">
            <form
              onSubmit={handleSearch}
              className="flex items-center gap-2 border border-gray-200 rounded-xl px-4 py-3 bg-white shadow-sm hover:shadow-md transition hover:border-orange-200"
            >
              <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  if (!e.target.value.trim()) setResults(null)
                }}
                placeholder="Search courses, schools or interests..."
                className="flex-1 text-sm outline-none text-gray-700 placeholder-gray-400 bg-transparent"
              />
              <button
                type="submit"
                className="text-xs text-orange-500 font-semibold hover:text-orange-600 transition px-2"
              >
                {searching ? '...' : 'Search'}
              </button>
            </form>

            {/* Search results dropdown */}
            {results && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-100 rounded-xl shadow-xl overflow-hidden z-50">
                {results.courses?.length === 0 && results.schools?.length === 0 ? (
                  <div className="px-5 py-4 text-sm text-gray-400">
                    No results for "{query}"
                  </div>
                ) : (
                  <>
                    {results.courses?.length > 0 && (
                      <div>
                        <div className="px-5 py-2 bg-gray-50 text-xs font-semibold text-gray-400 uppercase tracking-widest">
                          Courses
                        </div>
                        {results.courses.map((course, i) => (
                          <div
                            key={i}
                            onClick={() => navigate('/register')}
                            className="px-5 py-3 border-t border-gray-50 hover:bg-orange-50 transition cursor-pointer group"
                          >
                            <p className="text-sm font-medium text-gray-800 group-hover:text-orange-600 transition">
                              {course.course_name}
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {course.cluster_category}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                    {results.schools?.length > 0 && (
                      <div>
                        <div className="px-5 py-2 bg-gray-50 text-xs font-semibold text-gray-400 uppercase tracking-widest border-t border-gray-100">
                          Schools
                        </div>
                        {results.schools.map((school, i) => (
                          <div
                            key={i}
                            onClick={() => navigate('/register')}
                            className="px-5 py-3 border-t border-gray-50 hover:bg-orange-50 transition cursor-pointer group"
                          >
                            <p className="text-sm font-medium text-gray-800 group-hover:text-orange-600 transition">
                              {school.school_name}
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {school.hei_type} · {school.address}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="flex items-center gap-6 mt-8">
            <div>
              <p className="text-xl font-bold text-gray-900">13</p>
              <p className="text-xs text-gray-400">Schools</p>
            </div>
            <div className="w-px h-8 bg-gray-200" />
            <div>
              <p className="text-xl font-bold text-gray-900">74</p>
              <p className="text-xs text-gray-400">Courses</p>
            </div>
            <div className="w-px h-8 bg-gray-200" />
            <div>
              <p className="text-xl font-bold text-gray-900">1</p>
              <p className="text-xs text-gray-400">City</p>
            </div>
          </div>
        </div>

        {/* Right side — visual */}
        <div className="relative flex items-center justify-center h-[500px]">

          {/* Geometric background shapes */}
          <div className="absolute w-80 h-80 bg-orange-100 rounded-full opacity-40 top-10 right-10" />
          <div className="absolute w-48 h-48 bg-orange-200 rounded-full opacity-30 bottom-10 left-10" />
          <div className="absolute w-32 h-32 bg-gray-100 rounded-full opacity-60 top-20 left-20" />
          <div
            className="absolute w-24 h-24 border-2 border-orange-200 rounded-2xl opacity-40 bottom-20 right-20"
            style={{ transform: 'rotate(15deg)' }}
          />
          <div
            className="absolute w-16 h-16 border-2 border-gray-200 rounded-xl opacity-40 top-32 right-32"
            style={{ transform: 'rotate(-10deg)' }}
          />

          {/* Floating cluster cards */}
          <div className="relative flex flex-col gap-4 items-center z-10">
            <div style={{ transform: 'translateX(40px)' }}>
              <ClusterCard {...clusterCards[0]} />
            </div>
            <div style={{ transform: 'translateX(-30px)' }}>
              <ClusterCard {...clusterCards[1]} />
            </div>
            <div style={{ transform: 'translateX(20px)' }}>
              <ClusterCard {...clusterCards[2]} />
            </div>
          </div>

          {/* Small decorative dot grid */}
          <div className="absolute bottom-8 right-8 grid grid-cols-4 gap-2 opacity-20">
            {Array.from({ length: 16 }).map((_, i) => (
              <div key={i} className="w-1.5 h-1.5 bg-orange-400 rounded-full" />
            ))}
          </div>
        </div>
      </div>

      {/* How it works section */}
      <div className="border-t border-gray-100 bg-gray-50 px-10 py-20">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs font-semibold text-orange-500 uppercase tracking-widest mb-3 text-center">
            How it works
          </p>
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-14">
            Three steps to your right course
          </h2>

          <div className="grid grid-cols-3 gap-10">
            {[
              {
                step: '01',
                title: 'Tell us about yourself',
                desc: 'Set up your profile and share your personal factors — things like budget, location, and schedule that affect what courses are realistic for you.',
              },
              {
                step: '02',
                title: 'Take the assessment',
                desc: 'Answer questions about your interests, academic skills, and personality. The whole thing takes about 15 minutes.',
              },
              {
                step: '03',
                title: 'Get your matches',
                desc: 'See your top course cluster matches with a personalized explanation of why each one fits you — and which SJDM schools offer them.',
              },
            ].map((item) => (
              <div key={item.step} className="relative">
                <span className="text-5xl font-bold text-orange-100 select-none">
                  {item.step}
                </span>
                <h3 className="text-base font-semibold text-gray-900 mt-2 mb-2">
                  {item.title}
                </h3>
                <p className="text-sm text-gray-500 leading-relaxed">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-100 px-10 py-6">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <span className="text-sm font-bold text-gray-900">
            Learn<span className="text-orange-500">Match</span>
          </span>
          <p className="text-xs text-gray-400">
            STI College San Jose del Monte · Capstone 2 · 2026
          </p>
        </div>
      </footer>

    </div>
  )
}

export default Landing