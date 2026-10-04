import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import CourseEnrichmentSections from '../components/CourseEnrichmentSections'
import useActiveCollegePhase from '../hooks/useActiveCollegePhase'

const apiUrl = import.meta.env.VITE_API_URL || ''

function CareerPath() {
  const navigate = useNavigate()
  const location = useLocation()
  const { courseCode } = useParams()
  const hasActiveCollegePhase = useActiveCollegePhase()
  const passedRecommendations = location.state?.recommendations
  const cameFromCareerPaths = location.state?.source === 'career-paths'
  const [recommendations, setRecommendations] = useState(() => (
    Array.isArray(passedRecommendations) ? passedRecommendations : []
  ))
  const [course, setCourse] = useState(null)
  const [status, setStatus] = useState(
    courseCode || !Array.isArray(passedRecommendations) ? 'loading' : 'success'
  )

  const topRecommendations = useMemo(() => (
    [...recommendations]
      .sort((left, right) => left.rank_position - right.rank_position)
      .slice(0, 3)
  ), [recommendations])

  useEffect(() => {
    const controller = new AbortController()

    if (courseCode) {
      fetch(`${apiUrl}/api/public/courses/${encodeURIComponent(courseCode)}`, {
        signal: controller.signal,
      })
        .then(async (response) => {
          if (response.status === 404) return null
          if (!response.ok) throw new Error('Course request failed')
          return response.json()
        })
        .then((data) => {
          setCourse(data?.course || null)
          setStatus(data?.course ? 'success' : 'not-found')
        })
        .catch((error) => {
          if (error.name !== 'AbortError') setStatus('error')
        })
      return () => controller.abort()
    }

    if (Array.isArray(passedRecommendations)) return () => controller.abort()

    const token = localStorage.getItem('token')
    if (!token) {
      navigate('/login', { replace: true })
      return () => controller.abort()
    }

    fetch(`${apiUrl}/api/results`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (response.status === 401 || response.status === 403) {
          navigate('/login', { replace: true })
          return null
        }
        if (!response.ok) throw new Error('Recommendation request failed')
        return response.json()
      })
      .then((data) => {
        if (!data) return
        setRecommendations(Array.isArray(data.recommendations) ? data.recommendations : [])
        setStatus('success')
      })
      .catch((error) => {
        if (error.name !== 'AbortError') setStatus('error')
      })

    return () => controller.abort()
  }, [courseCode, navigate, passedRecommendations])

  const openCourse = (recommendation) => {
    navigate(`/results/career-path/${encodeURIComponent(recommendation.course_code)}`, {
      state: { recommendations: topRecommendations, source: 'career-paths' },
    })
  }

  const backToSelector = () => {
    if (hasActiveCollegePhase || !cameFromCareerPaths) {
      navigate('/results')
      return
    }
    navigate('/results/career-path', {
      state: topRecommendations.length ? { recommendations: topRecommendations } : undefined,
    })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-100 px-6 sm:px-8 py-5 flex justify-between items-center">
        {hasActiveCollegePhase === false ? (
          <button onClick={() => navigate('/dashboard')} className="text-lg font-bold text-gray-900 hover:opacity-80 transition">Learn<span className="text-orange-500">Match</span></button>
        ) : (
          <span className="text-lg font-bold text-gray-900">Learn<span className="text-orange-500">Match</span></span>
        )}
        <button onClick={courseCode ? backToSelector : () => navigate('/results')} disabled={hasActiveCollegePhase === null} className="text-sm text-gray-500 hover:text-gray-900 transition disabled:cursor-wait disabled:opacity-50">
          ← {courseCode && cameFromCareerPaths && !hasActiveCollegePhase ? 'Back to Career Paths' : 'Back to Results'}
        </button>
      </nav>

      <main className="max-w-[1320px] mx-auto px-5 sm:px-10 lg:px-14 py-10 sm:py-14">
        {status === 'loading' && <p className="text-sm text-gray-400">{courseCode ? 'Loading course roadmap…' : 'Loading your recommendations…'}</p>}
        {status === 'error' && <p className="bg-red-50 border border-red-100 text-red-700 rounded-xl p-5">We couldn’t load this information. Please try again.</p>}
        {status === 'not-found' && <p className="bg-white border border-gray-100 rounded-xl p-5 text-gray-600">This course is unavailable or inactive.</p>}

        {!courseCode && status === 'success' && (
          <section className="mx-auto max-w-6xl">
            <header className="mb-8 max-w-3xl sm:mb-10">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-orange-500">Your recommendations</p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-950 sm:text-4xl">Choose a career path to explore</h1>
              <p className="mt-3 text-sm leading-6 text-gray-500 sm:text-base">
                Explore the roadmap and career opportunities for any of your Top 3 recommended courses.
              </p>
            </header>

            {topRecommendations.length === 0 ? (
              <div className="bg-white border border-gray-100 rounded-2xl p-7 text-gray-500">No course recommendations are available yet.</div>
            ) : (
              <>
                <div className="grid items-stretch gap-5 md:grid-cols-3 lg:gap-6">
                  {topRecommendations.map((recommendation) => {
                    const isTopRecommendation = recommendation.rank_position === 1
                    return (
                      <article
                        key={recommendation.course_id}
                        className={`flex h-full flex-col rounded-3xl bg-white p-6 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md sm:p-7 ${
                          isTopRecommendation
                            ? 'border-2 border-orange-200 shadow-orange-100/50'
                            : 'border border-gray-200'
                        }`}
                      >
                        <p className="text-xs font-bold uppercase tracking-[0.13em] text-orange-600">
                          #{recommendation.rank_position} Recommendation
                        </p>
                        <h2 className="mt-4 text-xl font-bold leading-snug text-gray-950 sm:text-2xl">
                          {recommendation.course_name}
                        </h2>

                        <div className="mt-6">
                          <div className="flex items-end justify-between gap-3">
                            <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Compatibility</span>
                            <span className="text-2xl font-black tracking-tight text-orange-500">{recommendation.match_score}%</span>
                          </div>
                          <div
                            className="mt-2 h-2 overflow-hidden rounded-full bg-orange-100"
                            role="progressbar"
                            aria-label={`${recommendation.course_name} compatibility`}
                            aria-valuemin="0"
                            aria-valuemax="100"
                            aria-valuenow={recommendation.match_score}
                          >
                            <div
                              className="h-full rounded-full bg-orange-500"
                              style={{ width: `${Math.max(0, Math.min(100, recommendation.match_score))}%` }}
                            />
                          </div>
                        </div>

                        <p className="mt-5 text-sm leading-6 text-gray-500">
                          Explore this course&apos;s academic journey and possible career opportunities.
                        </p>
                        <button
                          type="button"
                          onClick={() => openCourse(recommendation)}
                          className="mt-7 w-full rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-300 focus:ring-offset-2 md:mt-auto md:pt-3"
                        >
                          View Career Path
                        </button>
                      </article>
                    )
                  })}
                </div>

                <aside className="mt-10 rounded-3xl border border-orange-100 bg-white p-6 shadow-sm sm:mt-12 sm:p-8" aria-labelledby="career-path-preview-title">
                  <div className="max-w-2xl">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-orange-500">Explore with context</p>
                    <h2 id="career-path-preview-title" className="mt-1.5 text-xl font-bold text-gray-950">What will you see in the Career Path?</h2>
                  </div>
                  <div className="mt-6 grid gap-4 sm:grid-cols-3">
                    {[
                      ['Year-by-Year Roadmap', 'View the general progression of the selected program.'],
                      ['Career Opportunities', 'Explore possible careers related to the course.'],
                      ['Career Information', 'Review available role descriptions and career details.'],
                    ].map(([title, description], index) => (
                      <div key={title} className="rounded-2xl border border-gray-100 bg-gray-50/70 p-4">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-100 text-xs font-bold text-orange-700">{index + 1}</span>
                        <h3 className="mt-3 text-sm font-bold text-gray-900">{title}</h3>
                        <p className="mt-1.5 text-xs leading-5 text-gray-500">{description}</p>
                      </div>
                    ))}
                  </div>
                  <p className="mt-5 border-t border-gray-100 pt-4 text-xs leading-5 text-gray-400">
                    Career paths are provided for guidance and may vary depending on the school, curriculum, and career opportunities available.
                  </p>
                </aside>
              </>
            )}
          </section>
        )}

        {courseCode && status === 'success' && course && (
          <>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mt-1 mb-1">{course.course_name}</h1>
            <p className="text-sm text-gray-600 leading-7 mb-8 max-w-4xl">{course.description}</p>

            <section className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Obtainable skills</h2>
              <div className="flex flex-wrap gap-2">
                {course.obtainable_skills.map((skill) => <span key={skill} className="text-xs px-3 py-1.5 rounded-full bg-orange-50 text-orange-700 font-medium">{skill}</span>)}
              </div>
            </section>

            <CourseEnrichmentSections course={course} />
          </>
        )}
      </main>
    </div>
  )
}

export default CareerPath
