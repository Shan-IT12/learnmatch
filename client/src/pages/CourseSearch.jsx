import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import PublicHeader from '../components/PublicHeader'

const apiUrl = import.meta.env.VITE_API_URL || ''

function CourseSearch() {
  const navigate = useNavigate()
  const location = useLocation()
  const fromDashboard = location.state?.entryContext === 'dashboard'
  const [searchParams, setSearchParams] = useSearchParams()
  const query = searchParams.get('q')?.trim() || ''
  const [input, setInput] = useState(query)
  const [courses, setCourses] = useState([])
  const [status, setStatus] = useState(query ? 'loading' : 'idle')
  const [resolvedQuery, setResolvedQuery] = useState(query ? null : '')
  const [suggestions, setSuggestions] = useState(null)
  const [suggestionStatus, setSuggestionStatus] = useState('idle')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const displayStatus = !query ? 'idle' : resolvedQuery === query ? status : 'loading'

  useEffect(() => {
    const suggestionQuery = input.trim()
    const controller = new AbortController()
    if (!suggestionQuery) return () => controller.abort()

    const timer = setTimeout(() => {
      setSuggestionStatus('loading')
      fetch(`${apiUrl}/api/public/courses/search?q=${encodeURIComponent(suggestionQuery)}&limit=6`, {
        signal: controller.signal,
      })
        .then(async (response) => {
          if (!response.ok) throw new Error('Suggestion request failed')
          return response.json()
        })
        .then((data) => {
          setSuggestions(data.courses || [])
          setSuggestionStatus('success')
        })
        .catch((error) => {
          if (error.name !== 'AbortError') {
            setSuggestions([])
            setSuggestionStatus('error')
          }
        })
    }, 250)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [input])

  useEffect(() => {
    document.title = query ? `${query} Courses | LearnMatch` : 'Explore Courses | LearnMatch'
    const controller = new AbortController()

    if (!query) {
      return () => controller.abort()
    }

    fetch(`${apiUrl}/api/public/courses/search?q=${encodeURIComponent(query)}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('Search request failed')
        return response.json()
      })
      .then((data) => {
        setCourses(data.courses || [])
        setStatus('success')
        setResolvedQuery(query)
      })
      .catch((error) => {
        if (error.name !== 'AbortError') {
          setStatus('error')
          setResolvedQuery(query)
        }
      })

    return () => controller.abort()
  }, [query])

  const submit = (event) => {
    event.preventDefault()
    setShowSuggestions(false)
    setSearchParams(
      input.trim() ? { q: input.trim() } : {},
      fromDashboard ? { state: { entryContext: 'dashboard' } } : undefined
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PublicHeader />
      <main className="max-w-5xl mx-auto px-5 sm:px-10 py-10 sm:py-14">
        {fromDashboard && (
          <button onClick={() => navigate('/dashboard')} className="text-sm font-medium text-orange-600 hover:text-orange-700 mb-6">
            ← Back to Dashboard
          </button>
        )}
        <p className="text-xs font-semibold text-orange-500 uppercase tracking-widest mb-3">Course explorer</p>
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">Find a course</h1>
        <p className="text-gray-500 mb-7">Search by course name, abbreviation, skill, or career.</p>

        <div className="relative">
          <form onSubmit={submit} className="flex bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden focus-within:border-orange-300">
            <input
              value={input}
              onChange={(event) => {
                setInput(event.target.value)
                setSuggestions(null)
                setSuggestionStatus('idle')
                setShowSuggestions(Boolean(event.target.value.trim()))
              }}
              onFocus={() => setShowSuggestions(Boolean(input.trim()))}
              onBlur={() => setShowSuggestions(false)}
              aria-label="Search courses"
              aria-autocomplete="list"
              aria-expanded={showSuggestions}
              placeholder="Try BSIT, programming, teacher..."
              className="flex-1 min-w-0 px-5 py-4 outline-none text-gray-800"
            />
            <button className="bg-orange-500 text-white px-5 sm:px-7 font-medium hover:bg-orange-600">Search</button>
          </form>

          {showSuggestions && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-100 rounded-xl shadow-xl overflow-hidden z-50" role="listbox">
              {(suggestionStatus === 'idle' || suggestionStatus === 'loading') && (
                <div className="px-5 py-4 text-sm text-gray-400">Finding courses...</div>
              )}
              {suggestionStatus === 'error' && (
                <div className="px-5 py-4 text-sm text-red-500">Course suggestions are unavailable. You can still press Search.</div>
              )}
              {suggestionStatus === 'success' && suggestions?.length === 0 && (
                <div className="px-5 py-4 text-sm text-gray-400">No suggestions for "{input.trim()}"</div>
              )}
              {suggestionStatus === 'success' && suggestions?.length > 0 && (
                <div>
                  <div className="px-5 py-2 bg-gray-50 text-xs font-semibold text-gray-400 uppercase tracking-widest">Courses</div>
                  {suggestions.map((course) => (
                    <button
                      type="button"
                      role="option"
                      aria-selected="false"
                      key={course.course_code}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => navigate(`/courses/${course.course_code}`, fromDashboard ? { state: { entryContext: 'dashboard' } } : undefined)}
                      className="block w-full text-left px-5 py-3 border-t border-gray-50 hover:bg-orange-50 transition group"
                    >
                      <p className="text-sm font-medium text-gray-800 group-hover:text-orange-600 transition">
                        {course.course_name}{course.course_abbreviation ? ` (${course.course_abbreviation})` : ''}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">{course.cluster_category}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <section className="mt-9" aria-live="polite">
          {displayStatus === 'idle' && <p className="text-gray-500">Enter a keyword to explore the 342 validated courses.</p>}
          {displayStatus === 'loading' && <p className="text-gray-500">Searching courses…</p>}
          {displayStatus === 'error' && (
            <div className="bg-red-50 border border-red-100 text-red-700 rounded-xl p-5">We couldn’t load courses. Please try again.</div>
          )}
          {displayStatus === 'success' && courses.length === 0 && (
            <div className="bg-white border border-gray-100 rounded-xl p-7 text-center">
              <h2 className="font-semibold text-gray-900">No courses found</h2>
              <p className="text-sm text-gray-500 mt-1">Try a broader course, skill, or career keyword.</p>
            </div>
          )}
          {displayStatus === 'success' && courses.length > 0 && (
            <>
              <p className="text-sm text-gray-500 mb-4">{courses.length} {courses.length === 1 ? 'course' : 'courses'} found for “{query}”</p>
              <div className="grid gap-4">
                {courses.map((course) => (
                  <Link key={course.course_code} to={`/courses/${course.course_code}`} state={fromDashboard ? { entryContext: 'dashboard' } : undefined} className="block bg-white border border-gray-100 rounded-2xl p-5 sm:p-6 shadow-sm hover:shadow-md hover:border-orange-200 transition group">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      {course.course_abbreviation && <span className="text-xs font-bold text-orange-600 bg-orange-50 px-2.5 py-1 rounded-full">{course.course_abbreviation}</span>}
                      <span className="text-xs text-gray-400 uppercase tracking-wide">{course.cluster_category}</span>
                    </div>
                    <h2 className="text-lg font-semibold text-gray-900 group-hover:text-orange-600 transition">{course.course_name}</h2>
                    {course.description && <p className="text-sm text-gray-500 leading-relaxed mt-2 line-clamp-2">{course.description}</p>}
                  </Link>
                ))}
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  )
}

export default CourseSearch
