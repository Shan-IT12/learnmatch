import HeaderBrand from '../components/HeaderBrand'
import SkeletonContent from '../components/SkeletonContent'
import { coursePlaceholder, recommendationPlaceholders } from '../data/loadingPlaceholders'
import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import CourseEnrichmentSections from '../components/CourseEnrichmentSections'
import CourseName from '../components/CourseName'
import { CourseDescription, CourseSkills } from '../components/CareerPathExpandable'
import { IconArrowDown, IconBook2, IconBriefcase, IconRoute, IconSparkles } from '@tabler/icons-react'
import useActiveCollegePhase from '../hooks/useActiveCollegePhase'
import {
  cameFromCareerPathChooser,
  careerPathChooserSearch,
  careerPathDetailSearch,
  getCareerPathReturnDestination,
} from '../utils/careerPathNavigation'

const apiUrl = import.meta.env.VITE_API_URL || ''

function scrollToCareerSection(event) {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  const section = document.getElementById(event.currentTarget.hash.slice(1))
  if (!section) return
  event.preventDefault()
  section.scrollIntoView({
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
    block: 'start',
  })
}

function CareerPath() {
  const navigate = useNavigate()
  const location = useLocation()
  const { courseCode } = useParams()
  const hasActiveCollegePhase = useActiveCollegePhase()
  const passedRecommendations = location.state?.recommendations
  const cameFromCareerPaths = cameFromCareerPathChooser(location.search, location.state)
  const returnDestination = getCareerPathReturnDestination(location.search, hasActiveCollegePhase)
  const [recommendations, setRecommendations] = useState(() => (
    Array.isArray(passedRecommendations) ? passedRecommendations : []
  ))
  const [savedCourse, setCourse] = useState(null)
  const [status, setStatus] = useState(
    courseCode || !Array.isArray(passedRecommendations) ? 'loading' : 'success'
  )

  const course = status === 'loading' ? coursePlaceholder : savedCourse

  const topRecommendations = useMemo(() => (
    [...(status === 'loading' ? recommendationPlaceholders : recommendations)]
      .sort((left, right) => left.rank_position - right.rank_position)
      .slice(0, 3)
  ), [recommendations, status])

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
    navigate(`/results/career-path/${encodeURIComponent(recommendation.course_code)}${careerPathDetailSearch(location.search)}`, {
      state: { recommendations: topRecommendations, source: 'career-paths' },
    })
  }

  const backToSelector = () => {
    if (hasActiveCollegePhase || !cameFromCareerPaths) {
      navigate('/results')
      return
    }
    navigate(`/results/career-path${careerPathChooserSearch(location.search)}`, {
      state: topRecommendations.length ? { recommendations: topRecommendations } : undefined,
    })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="lm-site-header relative z-20 bg-white/95 backdrop-blur border-b border-gray-100 px-6 sm:px-8 py-5 flex justify-between items-center gap-4">
        {hasActiveCollegePhase === false ? (
          <button onClick={() => navigate('/dashboard')} className="text-lg font-bold text-gray-900 hover:opacity-80 transition"><HeaderBrand /></button>
        ) : (
          <span className="text-lg font-bold text-gray-900"><HeaderBrand /></span>
        )}
        <button onClick={courseCode ? backToSelector : () => navigate(returnDestination.path)} disabled={hasActiveCollegePhase === null} className="lm-action disabled:cursor-wait disabled:opacity-50">
          ← {courseCode && cameFromCareerPaths && !hasActiveCollegePhase ? 'Back to Career Paths' : returnDestination.label}
        </button>
      </nav>

      <SkeletonContent loading={status === 'loading'} label="Loading career path..."><main className="max-w-[1320px] mx-auto px-5 sm:px-10 lg:px-14 py-10 sm:py-14">
        {status === 'error' && <p className="bg-red-50 border border-red-100 text-red-700 rounded-xl p-5">We couldn’t load this information. Please try again.</p>}
        {status === 'not-found' && <p className="bg-white border border-gray-100 rounded-xl p-5 text-gray-600">This course is unavailable or inactive.</p>}

        {!courseCode && (status === 'success' || status === 'loading') && (
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
                        <CourseName as="h2" name={recommendation.course_name} abbreviation={recommendation.course_abbreviation} className="mt-4 text-xl font-bold leading-snug text-gray-950 sm:text-2xl" secondaryClassName="mt-1 text-base font-medium text-gray-500" />

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

        {courseCode && (status === 'success' || status === 'loading') && course && (
          <>
            <header className="relative mb-7 overflow-hidden rounded-[28px] border border-orange-100 bg-white shadow-[0_20px_60px_-45px_rgba(120,53,15,.35)]">
              <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(251,146,60,.12),transparent_60%)]" />
              <div className="relative grid gap-8 p-6 sm:p-9 lg:grid-cols-[minmax(0,1fr)_15rem] lg:gap-12 lg:p-10">
                <div className="min-w-0">
                  <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-orange-100 bg-orange-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-orange-700"><IconRoute size={14} stroke={1.8} /> Your career explorer</div>
                  <CourseName as="h1" name={course.course_name} abbreviation={course.course_abbreviation} className="max-w-4xl text-2xl font-bold leading-tight tracking-tight text-gray-950 sm:text-3xl lg:text-4xl" secondaryClassName="mt-2 text-lg font-medium tracking-normal text-gray-500" />
                  <CourseDescription key={course.course_code} text={course.description} />
                  <div className="mt-6 flex flex-wrap gap-3">
                    <a href="#program-roadmap" onClick={scrollToCareerSection} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-orange-500 px-5 py-3 text-xs font-semibold text-white shadow-sm shadow-orange-200 hover:bg-orange-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500">Explore the roadmap <IconArrowDown size={15} /></a>
                    <a href="#career-opportunities" onClick={scrollToCareerSection} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-xs font-semibold text-gray-600 hover:border-orange-200 hover:text-orange-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500">Discover careers <IconArrowDown size={15} /></a>
                  </div>
                </div>
                <aside className="relative hidden flex-col justify-between overflow-hidden rounded-2xl border border-orange-100 bg-gradient-to-br from-orange-50 via-amber-50/70 to-white lg:flex p-6 text-gray-800">
                  <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full border-[22px] border-orange-200/25" />
                  <div className="relative"><IconBook2 size={25} stroke={1.4} className="mb-5 text-orange-600" /><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-orange-700">Your potential journey</p><p className="mt-2 text-3xl font-bold tracking-tight text-orange-600">{course.program_duration_years ? <>{course.program_duration_years}<span className="ml-2 text-lg font-medium text-gray-600">years</span></> : 'Explore'}</p><p className="mt-2 text-xs leading-5 text-gray-600">From the classroom to the possibilities ahead.</p></div>
                  <div className="relative mt-6 flex items-center gap-2 border-t border-orange-200/60 pt-4 text-xs text-gray-700"><IconBriefcase size={15} className="text-orange-600" />{course.career_opportunities?.length || 0} career {course.career_opportunities?.length === 1 ? 'opportunity' : 'opportunities'}</div>
                </aside>
              </div>
            </header>

            <section className="mb-10 flex flex-col gap-5 rounded-2xl border border-gray-200/80 bg-white px-5 py-5 sm:px-7 lg:flex-row lg:items-center lg:gap-8" aria-labelledby="career-skills-heading">
              <div className="flex shrink-0 items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-600"><IconSparkles size={20} stroke={1.6} /></span><div><p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Along the way</p><h2 id="career-skills-heading" className="mt-0.5 text-sm font-bold text-gray-900">Skills you can build</h2></div></div>
              <CourseSkills key={course.course_code} skills={course.obtainable_skills || []} />
            </section>

            <CourseEnrichmentSections key={course.course_code} course={course} />
          </>
        )}
      </main></SkeletonContent>
    </div>
  )
}

export default CareerPath
