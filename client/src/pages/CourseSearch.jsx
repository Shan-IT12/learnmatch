import SkeletonContent from '../components/SkeletonContent'
import { recommendationPlaceholders } from '../data/loadingPlaceholders'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
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
  const [input, setInput] = useState(searchParams.get('q') || '')
  const query = input.trim()
  const returnSearch = new URLSearchParams({ ...(query ? { q: query } : {}), ...(fromDashboard ? { source: 'dashboard' } : {}) }).toString()
  const courseDetailsState = {
    entryContext: fromDashboard ? 'dashboard' : 'public-search',
    returnTo: `${location.pathname}${returnSearch ? `?${returnSearch}` : ''}`,
  }
  const [courses, setCourses] = useState([])
  const [status, setStatus] = useState('idle')
  const [resolvedQuery, setResolvedQuery] = useState(null)
  const [sort, setSort] = useState('asc')
  const [page, setPage] = useState(1)
  const resultsRef = useRef(null)
  const paginationScrollRef = useRef(false)
  const displayStatus = resolvedQuery === query ? status : resolvedQuery === null ? 'loading' : 'success'
  const sortedCourses = useMemo(() => [...courses].sort((left, right) => {
    const comparison = left.course_name.localeCompare(right.course_name)
    return sort === 'desc' ? -comparison : comparison
  }), [courses, sort])
  const pageCount = Math.ceil(sortedCourses.length / COURSES_PER_PAGE)
  const visibleCourses = useMemo(() => (
    sortedCourses.slice((page - 1) * COURSES_PER_PAGE, page * COURSES_PER_PAGE)
  ), [page, sortedCourses])

  useLayoutEffect(() => {
    if (!paginationScrollRef.current) return
    paginationScrollRef.current = false
    if (displayStatus === 'success' && visibleCourses.length > 0) {
      // Scroll the actual ancestors, including the body on mobile.
      resultsRef.current?.scrollIntoView({ block: 'start', inline: 'nearest', behavior: 'instant' })
    }
  }, [page, displayStatus, visibleCourses])

  const changePage = (nextPage) => {
    const targetPage = Math.max(1, Math.min(pageCount, nextPage))
    if (targetPage === page) return
    paginationScrollRef.current = true
    setPage(targetPage)
  }

  useEffect(() => {
    document.title = query ? `${query} Courses | LearnMatch` : 'Explore Courses | LearnMatch'
    const controller = new AbortController()

    fetch(getCourseCatalogUrl(apiUrl, query), {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('Search request failed')
        return response.json()
      })
      .then((data) => {
        if (controller.signal.aborted) return
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

    return () => {
      controller.abort()
    }
  }, [query])

  const updateSearch = (value) => {
    setPage(1)
    setSearchParams(
      Object.fromEntries([
        ...(value ? [['q', value]] : []),
        ...(fromDashboard ? [['source', 'dashboard']] : []),
      ]),
      { replace: true, ...(fromDashboard ? { state: { entryContext: 'dashboard' } } : {}) }
    )
  }

  const submit = (event) => {
    event.preventDefault()
    updateSearch(input.trim())
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PublicHeader activeCollegePhase={hasActiveCollegePhase} showDashboard={fromDashboard} />
      <main className="max-w-5xl mx-auto px-5 sm:px-10 py-10 sm:py-14">
        {fromDashboard ? (
          <button onClick={() => navigate('/dashboard')} className="lm-action mb-6">
            ← Back to Dashboard
          </button>
        ) : (
          <Link to="/" className="lm-action mb-6">
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
                setPage(1)
              }}
              aria-label="Search courses"
              placeholder="Try BSIT, programming, teacher..."
              className="flex-1 min-w-0 px-5 py-4 outline-none text-gray-800"
            />
            <button className="bg-orange-500 text-white px-5 sm:px-7 font-medium hover:bg-orange-600">Search</button>
          </form>

          </div>
        </div>

        <SkeletonContent loading={displayStatus === 'loading'} label="Loading courses..."><section ref={resultsRef} className="motion-swap mt-9" aria-live="polite">
          {displayStatus === 'error' && (
            <div className="bg-red-50 border border-red-100 text-red-700 rounded-xl p-5">We couldn’t load courses. Please try again.</div>
          )}
          {displayStatus === 'success' && courses.length === 0 && (
            <div className="bg-white border border-gray-100 rounded-xl p-7 text-center">
              <h2 className="font-semibold text-gray-900">No courses found</h2>
              <p className="text-sm text-gray-500 mt-1">{query ? 'Try a broader course, skill, or career keyword.' : 'Please check back later for available courses.'}</p>
            </div>
          )}
          {(displayStatus === 'loading' || (displayStatus === 'success' && courses.length > 0)) && (
            <>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                {query && resolvedQuery === query && <p className="text-sm text-gray-500">
                  {`${courses.length} ${courses.length === 1 ? 'course' : 'courses'} found for “${query}”`}
                </p>}
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
              <div className="motion-stagger grid gap-4">
                {(displayStatus === 'loading' ? recommendationPlaceholders : visibleCourses).map((course) => (
                  <article key={course.course_code} className="flex flex-col bg-white border border-gray-100 rounded-2xl p-5 sm:p-6 shadow-sm hover:shadow-md hover:border-orange-200 transition">
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      {course.course_abbreviation && <span className="text-xs font-bold text-orange-600 bg-orange-50 px-2.5 py-1 rounded-full">{getDisplayCourseAbbreviation(course.course_name, course.course_abbreviation)}</span>}
                    </div>
                    <CourseName as="h2" name={course.course_name} className="text-lg font-semibold text-gray-900" secondaryClassName="mt-1 text-base font-medium text-gray-500" />
                    {course.description && <p className="text-sm text-gray-500 leading-relaxed mt-2 line-clamp-2">{course.description}</p>}
                    <Link to={`/courses/${course.course_code}${contextSearch}`} state={courseDetailsState} className="lm-action mt-4 w-fit">
                      View course details <span aria-hidden="true" className="ml-1">→</span>
                    </Link>
                  </article>
                ))}
              </div>
              {pageCount > 1 && (
                <nav className="mt-7 flex flex-wrap items-center justify-between gap-3" aria-label="Course catalog pages">
                  <p className="text-sm text-gray-500">Page {page} of {pageCount}</p>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => changePage(page - 1)} disabled={page === 1} className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:border-orange-300 hover:text-orange-700 disabled:cursor-not-allowed disabled:opacity-40">Previous</button>
                    <button type="button" onClick={() => changePage(page + 1)} disabled={page === pageCount} className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:border-orange-300 hover:text-orange-700 disabled:cursor-not-allowed disabled:opacity-40">Next</button>
                  </div>
                </nav>
              )}
            </>
          )}
        </section></SkeletonContent>
      </main>
    </div>
  )
}

export default CourseSearch
