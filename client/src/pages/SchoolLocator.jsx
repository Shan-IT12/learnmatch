import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { IconAlertCircle, IconArrowLeft, IconBook2, IconMapPin, IconSchool } from '@tabler/icons-react'
import PublicHeader from '../components/PublicHeader'
import SchoolLocatorMap from '../components/SchoolLocatorMap'

const apiUrl = import.meta.env.VITE_API_URL || ''

function SchoolLocator() {
  const { courseCode } = useParams()
  const isAuthenticated = Boolean(localStorage.getItem('token'))
  const [result, setResult] = useState(null)
  const [status, setStatus] = useState('loading')
  const [retryCount, setRetryCount] = useState(0)
  const [resolvedCourseCode, setResolvedCourseCode] = useState(null)
  const [selectedSchoolId, setSelectedSchoolId] = useState(null)
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
        setStatus('success')
        setResolvedCourseCode(courseCode)
        document.title = `Schools for ${data.course.course_abbreviation || data.course.course_name} | LearnMatch`
      })
      .catch((error) => {
        if (error.name !== 'AbortError') {
          setStatus('error')
          setResolvedCourseCode(courseCode)
        }
      })

    return () => controller.abort()
  }, [courseCode, retryCount])

  const backPath = isAuthenticated ? '/results' : '/courses/search'
  const backLabel = isAuthenticated ? 'Back to results' : 'Back to course explorer'

  return (
    <div className="min-h-screen bg-[#fcfaf7] text-gray-900">
      <PublicHeader />
      <main className="max-w-6xl mx-auto px-5 sm:px-8 lg:px-10 py-8 sm:py-12">
        <Link to={backPath} className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-orange-600 transition">
          <IconArrowLeft size={17} stroke={2} /> {backLabel}
        </Link>

        {displayStatus === 'loading' && (
          <section className="mt-8 bg-white border border-gray-100 rounded-3xl p-8 sm:p-12 shadow-sm" aria-live="polite">
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
            <Link to="/courses/search" className="inline-flex mt-6 bg-orange-500 text-white px-5 py-3 rounded-xl text-sm font-semibold hover:bg-orange-600 transition">Explore courses</Link>
          </section>
        )}

        {displayStatus === 'success' && result && (
          <>
            <header className="mt-8 rounded-3xl border border-orange-200 bg-gradient-to-br from-orange-50 via-orange-100 to-amber-50 p-7 sm:p-10 overflow-hidden relative">
              <div className="absolute -right-12 -top-16 w-56 h-56 rounded-full border-[34px] border-white/35" aria-hidden="true" />
              <div className="relative max-w-3xl">
                <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-orange-700"><IconSchool size={17} stroke={1.8} /> School Locator</div>
                <h1 className="text-2xl sm:text-4xl font-bold leading-tight mt-4">Schools associated with {result.course.course_name}</h1>
                <div className="flex flex-wrap gap-2.5 mt-5">
                  {result.course.course_abbreviation && <span className="bg-white/80 border border-white text-gray-700 text-xs font-semibold px-3 py-1.5 rounded-full">{result.course.course_abbreviation}</span>}
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
                  {isAuthenticated && <Link to="/results" className="bg-gray-900 text-white px-5 py-3 rounded-xl text-sm font-semibold hover:bg-gray-800 transition">Back to results</Link>}
                  <Link to="/courses/search" className="border border-orange-200 bg-orange-50 text-orange-700 px-5 py-3 rounded-xl text-sm font-semibold hover:bg-orange-100 transition">Explore other courses</Link>
                </div>
              </section>
            ) : (
              <section className="mt-8">
                <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 mb-5">
                  <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-orange-600">Available matches</p><h2 className="text-xl sm:text-2xl font-bold mt-1">{result.schools.length} {result.schools.length === 1 ? 'school' : 'schools'} available</h2></div>
                  <p className="text-xs text-gray-400">Academic year {result.academic_year}</p>
                </div>
                <SchoolLocatorMap schools={result.schools} selectedSchoolId={selectedSchoolId} />
                <div className="grid md:grid-cols-2 gap-5">
                  {result.schools.map((school) => {
                    const majors = school.offerings.map((offering) => offering.major).filter(Boolean)
                    const hasGeneralOffering = school.offerings.some((offering) => !offering.major)
                    return (
                      <article key={school.school_id} className="bg-white border border-gray-100 rounded-2xl p-6 sm:p-7 shadow-sm hover:shadow-md hover:border-orange-100 transition">
                        <div className="flex items-start gap-4">
                          <div className="w-11 h-11 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center shrink-0"><IconSchool size={23} stroke={1.7} /></div>
                          <div className="min-w-0"><h3 className="font-bold text-lg leading-snug text-gray-900">{school.school_name}</h3>{(school.hei_type || school.hei_type2) && <p className="text-xs text-gray-500 mt-1">{[school.hei_type, school.hei_type2].filter(Boolean).join(' · ')}</p>}</div>
                        </div>
                        {school.address && <p className="flex items-start gap-2 text-sm text-gray-600 leading-6 mt-5"><IconMapPin size={18} stroke={1.7} className="text-orange-500 shrink-0 mt-0.5" /><span>{school.address}</span></p>}
                        {Number.isFinite(school.latitude) && Number.isFinite(school.longitude) && (
                          <button
                            type="button"
                            onClick={() => setSelectedSchoolId(school.school_id)}
                            className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-orange-700 hover:text-orange-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500"
                          >
                            <IconMapPin size={17} stroke={1.8} /> Show on map
                          </button>
                        )}
                        {(hasGeneralOffering || majors.length > 0) && (
                          <div className="mt-5 pt-5 border-t border-gray-100">
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2.5">Offering variants</p>
                            <div className="flex flex-wrap gap-2">
                              {hasGeneralOffering && <span className="text-xs font-medium text-gray-700 bg-gray-100 px-3 py-1.5 rounded-full">General program</span>}
                              {majors.map((major) => <span key={major} className="text-xs font-medium text-orange-700 bg-orange-50 px-3 py-1.5 rounded-full">{major}</span>)}
                            </div>
                          </div>
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
