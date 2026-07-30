import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

function CollegeSetup() {
  const navigate = useNavigate()
  const token = localStorage.getItem('token')
  const userId = localStorage.getItem('userId')

  const [courses, setCourses] = useState([])
  const [search, setSearch] = useState('')
  const [selectedCourse, setSelectedCourse] = useState(null)
  const [yearLevel, setYearLevel] = useState('')
  const [semester, setSemester] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!token) navigate('/login')
  }, [token, navigate])

  // Search courses from your database
  const handleSearch = async (e) => {
    const query = e.target.value
    setSearch(query)
    setSelectedCourse(null)

    if (query.length < 2) {
      setCourses([])
      return
    }

    try {
      const response = await fetch(
        `http://localhost:5000/api/search?q=${encodeURIComponent(query)}`
      )
      const data = await response.json()
      setCourses(data.courses || [])
    } catch {
      setCourses([])
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!selectedCourse) {
      setError('Please select a course from the list.')
      return
    }
    if (!yearLevel) {
      setError('Please select your year level.')
      return
    }
    if (!semester) {
      setError('Please select your current semester.')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('http://localhost:5000/api/college/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          courseId: selectedCourse.course_id,
          courseName: selectedCourse.course_name,
          yearLevel,
          semester,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.message)
        return
      }

      // Save to localStorage for easy access
      localStorage.setItem('enrolledCourse', selectedCourse.course_name)
      localStorage.setItem('yearLevel', yearLevel)
      localStorage.setItem('semester', semester)

      navigate('/college')
    } catch {
      setError('Cannot connect to server. Please try again.')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav */}
      <nav className="bg-white border-b border-gray-100 px-8 py-5 flex justify-between items-center">
        <span className="text-lg font-bold">
          Learn<span className="text-orange-500">Match</span>
        </span>
        <button
          onClick={() => navigate('/dashboard')}
          className="text-sm text-gray-500 hover:text-gray-900 transition"
        >
          ← Back to Dashboard
        </button>
      </nav>

      <div className="max-w-lg mx-auto px-6 py-12">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Set up your College Phase
        </h1>
        <p className="text-gray-500 text-sm mb-8">
          Tell us about your current enrollment so we can track your academic alignment.
        </p>

        {error && (
          <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Course search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              What course are you enrolled in?
            </label>
            <input
              type="text"
              value={search}
              onChange={handleSearch}
              placeholder="Search course name..."
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />

            {/* Search results dropdown */}
            {courses.length > 0 && !selectedCourse && (
              <div className="border border-gray-100 rounded-xl shadow-sm mt-2 overflow-hidden">
                {courses.map((course, i) => (
                  <div
                    key={i}
                    onClick={() => {
                      setSelectedCourse(course)
                      setSearch(course.course_name)
                      setCourses([])
                    }}
                    className="px-4 py-3 hover:bg-orange-50 cursor-pointer border-t border-gray-50 first:border-t-0"
                  >
                    <p className="text-sm font-medium text-gray-800">
                      {course.course_name}
                    </p>
                    <p className="text-xs text-orange-500 mt-0.5">
                      {course.cluster_category}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {selectedCourse && (
              <div className="mt-2 bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 flex justify-between items-center">
                <div>
                  <p className="text-sm font-medium text-gray-800">
                    {selectedCourse.course_name}
                  </p>
                  <p className="text-xs text-orange-500 mt-0.5">
                    {selectedCourse.cluster_category}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCourse(null)
                    setSearch('')
                  }}
                  className="text-xs text-gray-400 hover:text-gray-600"
                >
                  Change
                </button>
              </div>
            )}
          </div>

          {/* Year level */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              What year level are you in?
            </label>
            <div className="grid grid-cols-5 gap-2">
              {['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year'].map((year) => (
                <button
                  key={year}
                  type="button"
                  onClick={() => setYearLevel(year)}
                  className={`py-3 rounded-xl text-sm font-medium border transition ${
                    yearLevel === year
                      ? 'bg-orange-500 text-white border-orange-500'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-orange-300'
                  }`}
                >
                  {year.replace(' Year', '')}
                </button>
              ))}
            </div>
          </div>

          {/* Semester */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              What semester are you currently in?
            </label>
            <div className="grid grid-cols-2 gap-2">
              {['1st Semester', '2nd Semester', '3rd Semester', 'Summer'].map((sem) => (
                <button
                  key={sem}
                  type="button"
                  onClick={() => setSemester(sem)}
                  className={`py-3 rounded-xl text-sm font-medium border transition ${
                    semester === sem
                      ? 'bg-orange-500 text-white border-orange-500'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-orange-300'
                  }`}
                >
                  {sem}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-orange-500 text-white py-3 rounded-xl font-medium hover:bg-orange-600 transition text-sm disabled:opacity-50"
          >
            {loading ? 'Setting up...' : 'Continue to College Phase →'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default CollegeSetup