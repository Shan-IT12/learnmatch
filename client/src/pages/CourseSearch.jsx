import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { getCourseCatalogUrl } from '../utils/courseCatalog'
import useActiveCollegePhase from '../hooks/useActiveCollegePhase'
import PublicHeader from '../components/PublicHeader'
import CourseName from '../components/CourseName'
import { getDisplayCourseAbbreviation } from '../utils/courseName'

const apiUrl = import.meta.env.VITE_API_URL || ''
const COURSES_PER_PAGE = 18

function CourseSearch() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const fromDashboard = searchParams.get('source') === 'dashboard' || location.state?.entryContext === 'dashboard'
  const hasActiveCollegePhase = useActiveCollegePhase()
  const contextSearch = fromDashboard ? '?source=dashboard' : ''
  const courseDetailsState = {
    entryContext: fromDashboard ? 'dashboard' : 'public-search',
    returnTo: `${location.pathname}${location.search}`,
  }
  const query = searchParams.get('q')?.trim() || ''
  const [input, setInput] = useState(query)
  const [courses, setCourses] = useState([])
  const [status, setStatus] = useState('idle')
  const [resolvedQuery, setResolvedQuery] = useState(null)
  const [sort, setSort] = useState('asc')
  const [page, setPage] = useState(1)
  const [suggestions, setSuggestions] = useState(null)
  const [suggestionStatus, setSuggestionStatus] = useState('idle')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const displayStatus = !query ? 'idle' : resolvedQuery === query ? status : 'loading'
  const sortedCourses = useMemo(() => [...courses].sort((left, right) => {
    const comparison = left.course_name.localeCompare(right.course_name)
    return sort === 'desc' ? -comparison : comparison
  }), [courses, sort])
  const pageCount = Math.ceil(sortedCourses.length / COURSES_PER_PAGE)
  const visibleCourses = useMemo(() => (
    sortedCourses.slice((page - 1) * COURSES_PER_PAGE, page * COURSES_PER_PAGE)
  ), [page, sortedCourses])

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

    fetch(getCourseCatalogUrl(apiUrl, query), {
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
    setPage(1)
    setShowSuggestions(false)
    setSearchParams(
      Object.fromEntries([
        ...(input.trim() ? [['q', input.trim()]] : []),
        ...(fromDashboard ? [['source', 'dashboard']] : []),
      ]),
      fromDashboard ? { state: { entryContext: 'dashboard' } } : undefined
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PublicHeader activeCollegePhase={hasActiveCollegePhase} showDashboard={fromDashboard} />
      <main className="max-w-5xl mx-auto px-5 sm:px-10 py-10 sm:py-14">
        {fromDashboard ? (
          <button onClick={() => navigate('/dashboard')} className="text-sm font-medium text-orange-600 hover:text-orange-700 mb-6">
            ← Back to Dashboard
          </button>
        ) : (
          <Link to="/" className="inline-block text-sm font-medium text-orange-600 hover:text-orange-700 mb-6">
            ← Back to Landing Page
          </Link>
        )}
        <p className="text-xs font-semibold text-orange-500 uppercase tracking-widest mb-3">Course explorer</p>
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">Find a course</h1>
        <p className="text-gray-500 mb-7">Search by course name, abbreviation, skill, or career.</p>

        <div>
          <div className="relative">
          <form onSubmit={submit} className="flex min-w-0 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm focus-within:border-orange-300">
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
                      onClick={() => navigate(`/courses/${course.course_code}${contextSearch}`, { state: courseDetailsState })}
                      className="block w-full text-left px-5 py-3 border-t border-gray-50 hover:bg-orange-50 transition group"
                    >
                      <CourseName name={course.course_name} abbreviation={course.course_abbreviation} className="text-sm font-medium text-gray-800 transition group-hover:text-orange-600" secondaryClassName="mt-1 text-sm font-normal text-gray-500" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          </div>
        </div>

        <section className="mt-9" aria-live="polite">
          {displayStatus === 'loading' && <p className="text-gray-500">Loading courses…</p>}
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
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-gray-500">
                  {`${courses.length} ${courses.length === 1 ? 'course' : 'courses'} found for “${query}”`}
                </p>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-600">
                  Sort
                  <select value={sort} onChange={(event) => {
                    setSort(event.target.value)
                    setPage(1)
                  }} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400" aria-label="Sort courses">
                    <option value="asc">A–Z</option>
                    <option value="desc">Z–A</option>
                  </select>
                </label>
              </div>
              <div className="grid gap-4">
                {visibleCourses.map((course) => (
                  <article key={course.course_code} className="flex flex-col bg-white border border-gray-100 rounded-2xl p-5 sm:p-6 shadow-sm hover:shadow-md hover:border-orange-200 transition">
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      {course.course_abbreviation && <span className="text-xs font-bold text-orange-600 bg-orange-50 px-2.5 py-1 rounded-full">{getDisplayCourseAbbreviation(course.course_name, course.course_abbreviation)}</span>}
                      {course.cluster_category && <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2.5 py-1 rounded-full">{course.cluster_category}</span>}
                    </div>
                    <CourseName as="h2" name={course.course_name} className="text-lg font-semibold text-gray-900" secondaryClassName="mt-1 text-base font-medium text-gray-500" />
                    {course.description && <p className="text-sm text-gray-500 leading-relaxed mt-2 line-clamp-2">{course.description}</p>}
                    <Link to={`/courses/${course.course_code}${contextSearch}`} state={courseDetailsState} className="mt-4 inline-flex w-fit items-center text-sm font-semibold text-orange-600 hover:text-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 rounded">
                      View course details <span aria-hidden="true" className="ml-1">→</span>
                    </Link>
                  </article>
                ))}
              </div>
              {pageCount > 1 && (
                <nav className="mt-7 flex flex-wrap items-center justify-between gap-3" aria-label="Course catalog pages">
                  <p className="text-sm text-gray-500">Page {page} of {pageCount}</p>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1} className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:border-orange-300 hover:text-orange-700 disabled:cursor-not-allowed disabled:opacity-40">Previous</button>
                    <button type="button" onClick={() => setPage((current) => Math.min(pageCount, current + 1))} disabled={page === pageCount} className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:border-orange-300 hover:text-orange-700 disabled:cursor-not-allowed disabled:opacity-40">Next</button>
                  </div>
                </nav>
              )}
            </>
          )}
        </section>
      </main>
    </div>
  )
}

export default CourseSearch
