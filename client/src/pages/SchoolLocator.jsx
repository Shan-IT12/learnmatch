import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { IconAlertCircle, IconArrowLeft, IconBook2, IconMapPin, IconRoute, IconSchool } from '@tabler/icons-react'
import PublicHeader from '../components/PublicHeader'
import SchoolLocatorMap from '../components/SchoolLocatorMap'
import CourseName from '../components/CourseName'
import { getDisplayCourseAbbreviation } from '../utils/courseName'
import { getSchoolLocatorBackNavigation } from '../utils/schoolLocatorNavigation'
import {
  directionsErrorMessage,
  getCurrentLocation,
  hasValidCoordinates,
  routeDistanceLabel,
} from '../utils/schoolDirections'
import { getSchoolOwnershipLabel } from '../utils/schoolOwnership'
import useActiveCollegePhase from '../hooks/useActiveCollegePhase'

const apiUrl = import.meta.env.VITE_API_URL || ''

function SchoolLocator() {
  const { courseCode } = useParams()
  const location = useLocation()
  const hasActiveCollegePhase = useActiveCollegePhase()
  const source = new URLSearchParams(location.search).get('source')
  const fromDashboard = source === 'dashboard'
  const resultsContext = hasActiveCollegePhase || source === 'results' || location.state?.source === 'results'
  const [result, setResult] = useState(null)
  const [status, setStatus] = useState('loading')
  const [retryCount, setRetryCount] = useState(0)
  const [resolvedCourseCode, setResolvedCourseCode] = useState(null)
  const [selectedSchoolId, setSelectedSchoolId] = useState(null)
  const [directions, setDirections] = useState({ status: 'idle' })
  const [coverageResetKey, setCoverageResetKey] = useState(0)
  const displayStatus = resolvedCourseCode === courseCode ? status : 'loading'

  useEffect(() => {
    const controller = new AbortController()
    fetch(`${apiUrl}/api/public/courses/${encodeURIComponent(courseCode)}/schools`, { signal: controller.signal })
      .then(async (response) => {
        if (response.status === 404) return null
        if (!response.ok) throw new Error('School locator request failed')
        return response.json()
      })
      .then((data) => {
        if (!data) {
          setStatus('not-found')
          setResolvedCourseCode(courseCode)
          document.title = 'Course Not Found | LearnMatch'
          return
        }
        setResult(data)
        setSelectedSchoolId(null)
        setDirections({ status: 'idle' })
        setStatus('success')
        setResolvedCourseCode(courseCode)
        document.title = `Schools for ${getDisplayCourseAbbreviation(data.course.course_name, data.course.course_abbreviation) || data.course.course_name} | LearnMatch`
      })
      .catch((error) => {
        if (error.name !== 'AbortError') {
          setStatus('error')
          setResolvedCourseCode(courseCode)
        }
      })

    return () => controller.abort()
  }, [courseCode, retryCount])

  const backNavigation = getSchoolLocatorBackNavigation(
    resultsContext
      ? 'results'
      : location.state?.source === 'course-overview'
      ? {
          name: location.state.source,
          returnTo: location.state.returnTo,
          returnState: location.state.returnState,
        }
      : {
          name: 'course-overview',
          returnTo: `/courses/${encodeURIComponent(courseCode)}${fromDashboard ? '?source=dashboard' : source === 'public-search' ? '?source=public-search' : ''}`,
          returnState: fromDashboard ? { entryContext: 'dashboard' } : { entryContext: 'public-search' },
        },
  )

  const showSchoolOnMap = (schoolId) => {
    setSelectedSchoolId(schoolId)
    setDirections({ status: 'idle' })
  }

  const getDirections = async (school) => {
    setSelectedSchoolId(school.school_id)
    if (!hasValidCoordinates(school)) {
      setDirections({
        status: 'error',
        schoolId: school.school_id,
        message: 'Directions are unavailable because this school does not have reviewed map coordinates.',
      })
      return
    }

    setDirections({ status: 'loading', schoolId: school.school_id })
    try {
      const userLocation = await getCurrentLocation()
      const response = await fetch(`${apiUrl}/api/public/directions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin: userLocation,
          destination: { latitude: school.latitude, longitude: school.longitude },
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.code || 'DIRECTIONS_UNAVAILABLE')

      setDirections({
        status: 'success',
        schoolId: school.school_id,
        schoolName: school.school_name,
        userLocation,
        route: data,
      })
    } catch (error) {
      setDirections({
        status: 'error',
        schoolId: school.school_id,
        message: directionsErrorMessage(error.message),
      })
    }
  }

  return (
    <div className="min-h-screen bg-[#fcfaf7] text-gray-900">
      <PublicHeader activeCollegePhase={hasActiveCollegePhase} showDashboard={fromDashboard} />
      <main className="max-w-6xl mx-auto px-5 sm:px-8 lg:px-10 py-8 sm:py-12">
        {hasActiveCollegePhase === null ? (
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-400" aria-live="polite">Resolving return destination…</span>
        ) : (
          <Link to={backNavigation.path} state={backNavigation.state} className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-orange-600 transition">
            <IconArrowLeft size={17} stroke={2} /> {backNavigation.label}
          </Link>
        )}

        {displayStatus === 'loading' && (
          <section className="motion-swap mt-8 bg-white border border-gray-100 rounded-3xl p-8 sm:p-12 shadow-sm" aria-live="polite">
            <div className="h-3 w-28 bg-orange-100 rounded-full animate-pulse" />
            <div className="h-8 max-w-xl bg-gray-100 rounded-xl animate-pulse mt-5" />
            <div className="h-4 max-w-2xl bg-gray-100 rounded-lg animate-pulse mt-4" />
            <p className="text-sm text-gray-400 mt-7">Finding schools in San Jose del Monte...</p>
          </section>
        )}

        {displayStatus === 'error' && (
          <section className="mt-8 bg-white border border-red-100 rounded-3xl p-8 sm:p-10 shadow-sm text-center">
            <div className="mx-auto w-12 h-12 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center"><IconAlertCircle size={25} stroke={1.8} /></div>
            <h1 className="text-2xl font-bold mt-5">We couldn’t load the School Locator</h1>
            <p className="text-sm text-gray-500 mt-2">Please check your connection and try again.</p>
            <button type="button" onClick={() => { setResolvedCourseCode(null); setRetryCount((count) => count + 1) }} className="mt-6 bg-orange-500 text-white px-5 py-3 rounded-xl text-sm font-semibold hover:bg-orange-600 transition">Try again</button>
          </section>
        )}

        {displayStatus === 'not-found' && (
          <section className="mt-8 bg-white border border-gray-100 rounded-3xl p-8 sm:p-12 shadow-sm text-center">
            <div className="mx-auto w-12 h-12 rounded-2xl bg-orange-50 text-orange-500 flex items-center justify-center"><IconBook2 size={25} stroke={1.8} /></div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-600 mt-5">School Locator</p>
            <h1 className="text-2xl sm:text-3xl font-bold mt-2">Course not found</h1>
            <p className="text-sm text-gray-500 mt-3 max-w-lg mx-auto">The course code may be invalid, inactive, or unavailable.</p>
            {hasActiveCollegePhase === null ? (
              <span className="inline-flex mt-6 bg-gray-200 text-gray-500 px-5 py-3 rounded-xl text-sm font-semibold">Resolving return destination…</span>
            ) : (
              <Link to={backNavigation.path} state={backNavigation.state} className="inline-flex mt-6 bg-orange-500 text-white px-5 py-3 rounded-xl text-sm font-semibold hover:bg-orange-600 transition">{backNavigation.label}</Link>
            )}
          </section>
        )}

        {displayStatus === 'success' && result && (
          <>
            <header className="mt-8 rounded-3xl border border-orange-200 bg-gradient-to-br from-orange-50 via-orange-100 to-amber-50 p-7 sm:p-10 overflow-hidden relative">
              <div className="absolute -right-12 -top-16 w-56 h-56 rounded-full border-[34px] border-white/35" aria-hidden="true" />
              <div className="relative max-w-3xl">
                <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-orange-700"><IconSchool size={17} stroke={1.8} /> School Locator</div>
                <h1 className="text-2xl sm:text-4xl font-bold leading-tight mt-4">
                  <span className="block text-base font-semibold text-orange-800 sm:text-lg">Schools associated with</span>
                  <CourseName name={result.course.course_name} className="mt-1 block" secondaryClassName="mt-1 text-base font-medium text-orange-900/70 sm:text-lg" />
                </h1>
                <div className="flex flex-wrap gap-2.5 mt-5">
                  {result.course.course_abbreviation && <span className="bg-white/80 border border-white text-gray-700 text-xs font-semibold px-3 py-1.5 rounded-full">{getDisplayCourseAbbreviation(result.course.course_name, result.course.course_abbreviation)}</span>}
                  <span className="inline-flex items-center gap-1.5 bg-white/80 border border-white text-gray-700 text-xs font-semibold px-3 py-1.5 rounded-full"><IconMapPin size={14} /> {result.location_scope}</span>
                </div>
                <p className="text-sm sm:text-base text-amber-950/70 leading-relaxed mt-5">Explore schools in San Jose del Monte that offer this course based on available program information.</p>
              </div>
            </header>

            {result.schools.length === 0 ? (
              <section className="mt-7 bg-white border border-gray-100 rounded-3xl p-8 sm:p-12 shadow-sm text-center">
                <div className="mx-auto w-14 h-14 rounded-2xl bg-orange-50 text-orange-500 flex items-center justify-center"><IconMapPin size={28} stroke={1.7} /></div>
                <h2 className="text-xl sm:text-2xl font-bold mt-5">No school match is currently available for this course.</h2>
                <p className="text-sm text-gray-500 leading-6 mt-3 max-w-2xl mx-auto">This does not necessarily mean the course is unavailable in San Jose del Monte. Some school program information may not yet be available in LearnMatch.</p>
                <div className="flex flex-col sm:flex-row justify-center gap-3 mt-7">
                  {hasActiveCollegePhase === null ? (
                    <span className="cursor-wait bg-gray-200 text-gray-500 px-5 py-3 rounded-xl text-sm font-semibold">Resolving return destination…</span>
                  ) : (
                    <Link to={backNavigation.path} state={backNavigation.state} className="bg-gray-900 text-white px-5 py-3 rounded-xl text-sm font-semibold hover:bg-gray-800 transition">{backNavigation.label}</Link>
                  )}
                </div>
              </section>
            ) : (
              <section className="mt-8">
                <div className="mb-5">
                  <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-orange-600">Available matches</p><h2 className="text-xl sm:text-2xl font-bold mt-1">{result.schools.length} {result.schools.length === 1 ? 'school' : 'schools'} available</h2></div>
                </div>
                <SchoolLocatorMap
                  schools={result.schools}
                  selectedSchoolId={selectedSchoolId}
                  route={directions.status === 'success' ? directions.route : null}
                  userLocation={directions.status === 'success' ? directions.userLocation : null}
                  coverageResetKey={coverageResetKey}
                  onRecenterCoverage={() => setCoverageResetKey((key) => key + 1)}
                />
                <div className="motion-swap min-h-0" aria-live="polite">
                  {directions.status === 'loading' && (
                    <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 px-5 py-4 text-sm text-blue-800">
                      Requesting your location and calculating a driving route...
                    </div>
                  )}
                  {directions.status === 'error' && (
                    <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 px-5 py-4 text-sm text-red-700">
                      {directions.message}
                    </div>
                  )}
                  {directions.status === 'success' && (
                    <div className="mt-4 rounded-2xl border border-blue-100 bg-white px-5 py-4 shadow-sm">
                      <p className="text-sm font-semibold text-gray-900">Driving route to {directions.schoolName}</p>
                      <p className="mt-2 text-sm text-gray-600">Route distance: <strong className="text-gray-900">{routeDistanceLabel(directions.route.distanceMeters)}</strong></p>
                    </div>
                  )}
                </div>
                <div className="grid md:grid-cols-2 gap-5">
                  {result.schools.map((school) => {
                    const ownershipLabel = getSchoolOwnershipLabel(school.hei_type)
                    return (
                      <article key={school.school_id} className="bg-white border border-gray-100 rounded-2xl p-6 sm:p-7 shadow-sm hover:shadow-md hover:border-orange-100 transition">
                        <div className="flex items-start gap-4">
                          <div className="w-11 h-11 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center shrink-0"><IconSchool size={23} stroke={1.7} /></div>
                          <div className="min-w-0"><h3 className="font-bold text-lg leading-snug text-gray-900">{school.school_name}</h3>{ownershipLabel && <p className="text-xs text-gray-500 mt-1">{ownershipLabel}</p>}</div>
                        </div>
                        {school.address && <p className="flex items-start gap-2 text-sm text-gray-600 leading-6 mt-5"><IconMapPin size={18} stroke={1.7} className="text-orange-500 shrink-0 mt-0.5" /><span>{school.address}</span></p>}
                        {hasValidCoordinates(school) ? (
                          <div className="mt-4 flex flex-wrap items-center gap-3">
                            <button
                              type="button"
                              onClick={() => showSchoolOnMap(school.school_id)}
                              className="inline-flex items-center gap-1.5 text-sm font-semibold text-orange-700 hover:text-orange-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500"
                            >
                              <IconMapPin size={17} stroke={1.8} /> Show on map
                            </button>
                            <button
                              type="button"
                              onClick={() => getDirections(school)}
                              disabled={directions.status === 'loading' && directions.schoolId === school.school_id}
                              className="inline-flex items-center gap-1.5 rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:cursor-wait disabled:opacity-60 transition"
                            >
                              <IconRoute size={17} stroke={1.8} /> {directions.status === 'loading' && directions.schoolId === school.school_id ? 'Calculating...' : 'Get Directions'}
                            </button>
                          </div>
                        ) : (
                          <p className="mt-4 text-xs text-gray-400">Directions unavailable: reviewed map coordinates are not available.</p>
                        )}
                      </article>
                    )
                  })}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  )
}

export default SchoolLocator
