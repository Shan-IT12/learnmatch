import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconSearch, IconX } from '@tabler/icons-react'

const semesterProgressOptions = [
  { label: "Just starting / early in the semester", phase: 'Early' },
  { label: "I'm around the middle of the semester", phase: 'Mid' },
  { label: "The semester is almost over", phase: 'End' },
]

function CollegeSetup() {
  const navigate = useNavigate()
  const token = localStorage.getItem('token')

  const [courses, setCourses] = useState([])
  const [savedRecommendations, setSavedRecommendations] = useState([])
  const [search, setSearch] = useState('')
  const [searchStatus, setSearchStatus] = useState('idle')
  const [selectedCourse, setSelectedCourse] = useState(null)
  const [yearLevel, setYearLevel] = useState('')
  const [semester, setSemester] = useState('')
  const [startingPhase, setStartingPhase] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!token) navigate('/login')
  }, [token, navigate])

  useEffect(() => {
    if (!token) return undefined

    const controller = new AbortController()
    const loadSavedRecommendations = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/recommendations/latest`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        })
        if (response.status === 401 || response.status === 403) {
          navigate('/login', { replace: true })
          return
        }
        if (!response.ok) return

        const data = await response.json()
        setSavedRecommendations(Array.isArray(data.recommendations) ? data.recommendations : [])
      } catch (requestError) {
        if (requestError.name !== 'AbortError') setSavedRecommendations([])
      }
    }

    loadSavedRecommendations()
    return () => controller.abort()
  }, [token, navigate])

  useEffect(() => {
    const query = search.trim().replace(/\s+/g, ' ')
    if (selectedCourse || query.length < 2) return undefined

    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setSearchStatus('loading')
      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_URL}/api/search?q=${encodeURIComponent(query)}`,
          { signal: controller.signal }
        )
        if (!response.ok) throw new Error('Course search failed')
        const data = await response.json()
        setCourses(data.courses || [])
        setSearchStatus('success')
      } catch (requestError) {
        if (requestError.name !== 'AbortError') {
          setCourses([])
          setSearchStatus('error')
        }
      }
    }, 200)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [search, selectedCourse])

  const selectCourse = (course) => {
    setSelectedCourse(course)
    setSearch(course.course_name)
    setCourses([])
    setSearchStatus('idle')
  }

  const handleSearchChange = (event) => {
    setSearch(event.target.value)
    setSelectedCourse(null)
    setCourses([])
    setSearchStatus('idle')
  }

  const clearSearch = () => {
    setSearch('')
    setCourses([])
    setSearchStatus('idle')
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
    if (!startingPhase) {
      setError('Please tell us where you are in the semester.')
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/college/setup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          courseId: selectedCourse.course_id,
          courseName: selectedCourse.course_name,
          yearLevel,
          semester,
          startingPhase,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.message)
        return
      }

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

          {savedRecommendations.length > 0 && (
            <section className="bg-white border border-orange-100 rounded-2xl p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-900">Based on your LearnMatch recommendations</h2>
              <p className="text-xs text-gray-500 mt-1 mb-4">Choose one of your recommended courses or search for another course.</p>
              <div className="space-y-3">
                {savedRecommendations.map((recommendation) => (
                  <div key={recommendation.course_id} className="border border-gray-100 rounded-xl p-4 sm:flex sm:items-center sm:justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-orange-600">#{recommendation.rank_position}</span>
                        {recommendation.course_abbreviation && (
                          <span className="text-xs text-gray-400">{recommendation.course_abbreviation}</span>
                        )}
                      </div>
                      <p className="text-sm font-medium text-gray-800">{recommendation.course_name}</p>
                      <p className="text-xs text-gray-400 mt-1">{recommendation.match_score}% compatibility</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => selectCourse(recommendation)}
                      className="mt-3 sm:mt-0 shrink-0 text-xs font-medium text-orange-600 border border-orange-200 px-3 py-2 rounded-lg hover:bg-orange-50 focus:outline-none focus:ring-2 focus:ring-orange-400"
                    >
                      {selectedCourse?.course_id === recommendation.course_id ? 'Selected' : 'Choose this course'}
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Course search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              What course are you enrolled in?
            </label>
            <div className="relative">
              <IconSearch size={18} stroke={1.75} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                type="search"
                value={search}
                onChange={handleSearchChange}
                placeholder="Search by course name, abbreviation, or code..."
                aria-label="Search active courses by name, abbreviation, or code"
                className="w-full border border-gray-200 rounded-xl pl-10 pr-10 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
              {search && !selectedCourse && (
                <button
                  type="button"
                  onClick={clearSearch}
                  aria-label="Clear course search"
                  className="absolute right-1 top-1/2 -translate-y-1/2 w-10 h-10 inline-flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-400"
                >
                  <IconX size={17} stroke={1.75} />
                </button>
              )}
            </div>

            {/* Search results dropdown */}
            {searchStatus === 'loading' && !selectedCourse && (
              <p className="mt-2 text-xs text-gray-400">Finding courses...</p>
            )}
            {searchStatus === 'success' && courses.length > 0 && !selectedCourse && (
              <div className="border border-gray-100 rounded-xl shadow-sm mt-2 overflow-hidden">
                {courses.map((course) => (
                  <button
                    key={course.course_id}
                    type="button"
                    onClick={() => selectCourse(course)}
                    className="block w-full text-left px-4 py-3 hover:bg-orange-50 border-t border-gray-50 first:border-t-0 focus:outline-none focus:bg-orange-50"
                  >
                    <p className="text-sm font-medium text-gray-800">
                      {course.course_name}
                      {course.course_abbreviation && ` (${course.course_abbreviation})`}
                    </p>
                    <p className="text-xs text-orange-500 mt-0.5">
                      {[course.course_code, course.cluster_category].filter(Boolean).join(' · ')}
                    </p>
                  </button>
                ))}
              </div>
            )}
            {searchStatus === 'success' && courses.length === 0 && !selectedCourse && (
              <p className="mt-2 text-xs text-gray-400">No active courses found.</p>
            )}
            {searchStatus === 'error' && !selectedCourse && (
              <p className="mt-2 text-xs text-red-500">Course search is unavailable. Please try again.</p>
            )}

            {selectedCourse && (
              <div className="mt-2 bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 flex justify-between items-center">
                <div>
                  <p className="text-sm font-medium text-gray-800">
                    {selectedCourse.course_name}
                    {selectedCourse.course_abbreviation && ` (${selectedCourse.course_abbreviation})`}
                  </p>
                  <p className="text-xs text-orange-500 mt-0.5">
                    {[selectedCourse.course_code, selectedCourse.cluster_category].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCourse(null)
                    clearSearch()
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

          {/* Where are you in the semester right now */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Where are you in the semester right now?
            </label>
            <p className="text-xs text-gray-400 mb-3">
              This helps us time your alignment check-ins correctly.
            </p>
            <div className="space-y-2">
              {semesterProgressOptions.map((option) => (
                <button
                  key={option.phase}
                  type="button"
                  onClick={() => setStartingPhase(option.phase)}
                  className={`w-full text-left py-3 px-4 rounded-xl text-sm font-medium border transition ${
                    startingPhase === option.phase
                      ? 'bg-orange-500 text-white border-orange-500'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-orange-300'
                  }`}
                >
                  {option.label}
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
