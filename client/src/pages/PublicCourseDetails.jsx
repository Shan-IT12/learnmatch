import SkeletonContent from '../components/SkeletonContent'
import { coursePlaceholder } from '../data/loadingPlaceholders'
import { useEffect } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import PublicHeader from '../components/PublicHeader'
import CourseName from '../components/CourseName'
import { getDisplayCourseAbbreviation } from '../utils/courseName'
import { getCourseOverviewBackNavigation } from '../utils/courseOverviewNavigation'
import useActiveCollegePhase from '../hooks/useActiveCollegePhase'
import { useWorkflowData } from '../hooks/useCourseValidation'
import { SITE_URL } from '../seo'

function setMetaDescription(content) {
  let meta = document.querySelector('meta[name="description"]')
  if (!meta) {
    meta = document.createElement('meta')
    meta.name = 'description'
    document.head.appendChild(meta)
  }
  meta.content = content
}

function PublicCourseDetails() {
  const { courseCode } = useParams()
  const location = useLocation()
  const isAuthenticated = Boolean(localStorage.getItem('token'))
  const source = new URLSearchParams(location.search).get('source')
  const fromDashboard = source === 'dashboard' || location.state?.entryContext === 'dashboard'
  const fromSummary = source === 'summary' || location.state?.entryContext === 'summary'
  const hasActiveCollegePhase = useActiveCollegePhase()
  const resultsContext = !fromSummary && (hasActiveCollegePhase || source === 'results' || location.state?.entryContext === 'results')
  const backNavigation = getCourseOverviewBackNavigation(location.state, location.search, hasActiveCollegePhase)
  const locatorSourceSearch = fromSummary ? '?source=summary' : resultsContext ? '?source=results' : fromDashboard ? '?source=dashboard' : '?source=public-search'
  const { data, error, loading } = useWorkflowData(`public/courses/${encodeURIComponent(courseCode)}`, undefined, { interval: 10000 })
  const savedCourse = data?.course
  const displayStatus = loading ? 'loading' : savedCourse ? 'success' : error?.status === 404 ? 'not-found' : 'error'
  const course = displayStatus === 'loading' ? coursePlaceholder : savedCourse

  useEffect(() => {
    if (displayStatus === 'not-found') document.title = 'Course Not Found | LearnMatch'
    if (!savedCourse) return
    document.title = `${getDisplayCourseAbbreviation(savedCourse.course_name, savedCourse.course_abbreviation) || savedCourse.course_name} | LearnMatch`
    setMetaDescription((savedCourse.description || `Explore ${savedCourse.course_name} on LearnMatch`).slice(0, 160))
    document.querySelector('meta[name="robots"]').content = 'index, follow'
    const canonical = document.createElement('link')
    canonical.rel = 'canonical'
    canonical.href = `${SITE_URL}/courses/${encodeURIComponent(courseCode)}`
    document.querySelector('link[rel="canonical"]')?.remove()
    document.head.append(canonical)
    document.querySelector('meta[property="og:title"]').content = document.title
    document.querySelector('meta[property="og:description"]').content = document.querySelector('meta[name="description"]').content
    document.querySelector('meta[property="og:url"]').content = canonical.href
  }, [courseCode, displayStatus, savedCourse])

  return (
    <div className="min-h-screen bg-gray-50">
      <PublicHeader activeCollegePhase={hasActiveCollegePhase} showDashboard={fromDashboard || fromSummary} dashboardPath={fromSummary ? '/dashboard/summary' : '/dashboard'} />
      <main className="max-w-5xl mx-auto px-5 sm:px-10 py-10 sm:py-14">
        {displayStatus === 'error' && <div role="alert" className="bg-red-50 border border-red-100 text-red-700 rounded-xl p-5">We couldn’t load this course. We’ll try again shortly.</div>}
        {displayStatus === 'not-found' && (
          <div className="bg-white border border-gray-100 rounded-2xl p-8 text-center">
            <h1 className="text-2xl font-bold text-gray-900">Course not found</h1>
            <p className="text-gray-500 mt-2 mb-5">The course code may be invalid or unavailable.</p>
            {hasActiveCollegePhase === null ? (
              <span className="text-sm text-gray-400">Resolving return destination…</span>
            ) : (
              <Link to={backNavigation.path} state={backNavigation.state} className="lm-action">{backNavigation.label}</Link>
            )}
          </div>
        )}
        {(displayStatus === 'success' || displayStatus === 'loading') && course && (
          <SkeletonContent loading={displayStatus === 'loading'} label="Loading course..."><article>
            {hasActiveCollegePhase === null ? (
              <span className="text-sm text-gray-400">Resolving return destination…</span>
            ) : (
              <Link to={backNavigation.path} state={backNavigation.state} className="lm-action">← {backNavigation.label}</Link>
            )}
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 sm:p-9 mt-5">
              <div className="flex flex-wrap items-center gap-2 mb-4">
                {course.course_abbreviation && <span className="text-xs font-bold text-orange-700 bg-orange-50 px-3 py-1.5 rounded-full">{getDisplayCourseAbbreviation(course.course_name, course.course_abbreviation)}</span>}
              </div>
              <CourseName as="h1" name={course.course_name} className="text-3xl sm:text-4xl font-bold text-gray-900 leading-tight" secondaryClassName="mt-2 text-lg font-medium text-gray-500" />
              {course.validation && <p className="mt-3 inline-block rounded-full border border-orange-100 bg-orange-50 px-3 py-1 text-xs font-medium text-orange-900">
                {course.validation.status === 'validated' ? <>Expert Validated{course.validation.validated_on && <> · <time dateTime={course.validation.validated_on}>{new Date(course.validation.validated_on).toLocaleDateString(undefined, { timeZone: 'UTC' })}</time></>}</> :
                  course.validation.status === 'needs_changes' ? 'Under Review · Updates Requested' :
                  course.validation.status === 'under_review' ? 'Under Review' : 'Pending Validation'}
              </p>}
              {course.description && <p className="text-gray-600 leading-7 whitespace-pre-line mt-6">{course.description}</p>}

              {hasActiveCollegePhase === null ? (
                <span className="inline-flex mt-6 cursor-wait bg-gray-200 text-gray-500 px-5 py-3 rounded-xl text-sm font-semibold">
                  Resolving return destination…
                </span>
              ) : (
                <Link
                  to={`/schools/${encodeURIComponent(course.course_code)}${locatorSourceSearch}`}
                  state={{
                    source: 'course-overview',
                    returnTo: `${location.pathname}${location.search}`,
                    returnState: resultsContext ? { entryContext: 'results' } : location.state || null,
                  }}
                  className="inline-flex mt-6 bg-orange-700 text-white px-5 py-3 rounded-xl text-sm font-semibold hover:bg-orange-800 transition"
                >
                  Find Schools in SJDM
                </Link>
              )}

              <div className="grid md:grid-cols-2 gap-8 mt-10 pt-8 border-t border-gray-100">
                <section>
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Skills you can develop</h2>
                  {course.obtainable_skills.length ? <ul className="space-y-2">{course.obtainable_skills.map((skill) => <li key={skill} className="text-sm text-gray-600 flex gap-2"><span className="text-orange-700">•</span>{skill}</li>)}</ul> : <p className="text-sm text-gray-600">No skills listed.</p>}
                </section>
                <section>
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Possible career paths</h2>
                  {course.career_paths.length ? <ul className="space-y-2">{course.career_paths.map((career) => <li key={career} className="text-sm text-gray-600 flex gap-2"><span className="text-orange-700">•</span>{career}</li>)}</ul> : <p className="text-sm text-gray-600">No career paths listed.</p>}
                </section>
              </div>

            </div>
            <div className="bg-gray-900 rounded-2xl p-7 sm:p-9 mt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
              <div><h2 className="text-xl font-semibold text-white">Is this course right for you?</h2><p className="text-sm text-gray-400 mt-1">Get recommendations based on your skills, interests, and personality.</p></div>
              <Link to={fromSummary ? '/dashboard/summary' : isAuthenticated ? '/dashboard' : '/register'} className="shrink-0 text-center bg-orange-700 text-white px-5 py-3 rounded-xl font-medium hover:bg-orange-800">{fromSummary ? 'Back to Summary Dashboard' : 'Take the LearnMatch Assessment'}</Link>
            </div>
          </article></SkeletonContent>
        )}
      </main>
    </div>
  )
}

export default PublicCourseDetails
