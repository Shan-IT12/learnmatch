import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import PublicHeader from '../components/PublicHeader'
import CourseEnrichmentSections from '../components/CourseEnrichmentSections'

const apiUrl = import.meta.env.VITE_API_URL || ''

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
  const fromDashboard = location.state?.entryContext === 'dashboard'
  const [course, setCourse] = useState(null)
  const [status, setStatus] = useState('loading')
  const [resolvedCourseCode, setResolvedCourseCode] = useState(null)
  const displayStatus = resolvedCourseCode === courseCode ? status : 'loading'

  useEffect(() => {
    const controller = new AbortController()
    fetch(`${apiUrl}/api/public/courses/${encodeURIComponent(courseCode)}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (response.status === 404) return null
        if (!response.ok) throw new Error('Course request failed')
        return response.json()
      })
      .then((data) => {
        if (!data) {
          document.title = 'Course Not Found | LearnMatch'
          setStatus('not-found')
          setResolvedCourseCode(courseCode)
          return
        }
        setCourse(data.course)
        setStatus('success')
        setResolvedCourseCode(courseCode)
        document.title = `${data.course.course_abbreviation || data.course.course_name} | LearnMatch`
        setMetaDescription((data.course.description || `Explore ${data.course.course_name} on LearnMatch`).slice(0, 160))
      })
      .catch((error) => {
        if (error.name !== 'AbortError') {
          setStatus('error')
          setResolvedCourseCode(courseCode)
        }
      })
    return () => controller.abort()
  }, [courseCode])

  return (
    <div className="min-h-screen bg-gray-50">
      <PublicHeader />
      <main className="max-w-5xl mx-auto px-5 sm:px-10 py-10 sm:py-14">
        {displayStatus === 'loading' && <p className="text-gray-500">Loading course…</p>}
        {displayStatus === 'error' && <div className="bg-red-50 border border-red-100 text-red-700 rounded-xl p-5">We couldn’t load this course. Please try again.</div>}
        {displayStatus === 'not-found' && (
          <div className="bg-white border border-gray-100 rounded-2xl p-8 text-center">
            <h1 className="text-2xl font-bold text-gray-900">Course not found</h1>
            <p className="text-gray-500 mt-2 mb-5">The course code may be invalid or unavailable.</p>
            <Link to="/courses/search" state={fromDashboard ? { entryContext: 'dashboard' } : undefined} className="text-orange-600 font-medium hover:text-orange-700">Explore courses</Link>
          </div>
        )}
        {displayStatus === 'success' && course && (
          <article>
            <Link to="/courses/search" state={fromDashboard ? { entryContext: 'dashboard' } : undefined} className="text-sm text-orange-600 hover:text-orange-700">← Back to course search</Link>
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 sm:p-9 mt-5">
              <div className="flex flex-wrap items-center gap-2 mb-4">
                {course.course_abbreviation && <span className="text-xs font-bold text-orange-600 bg-orange-50 px-3 py-1.5 rounded-full">{course.course_abbreviation}</span>}
                <span className="text-xs text-gray-400 uppercase tracking-wide">{course.cluster_category}</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 leading-tight">{course.course_name}</h1>
              {course.description && <p className="text-gray-600 leading-7 whitespace-pre-line mt-6">{course.description}</p>}

              <div className="grid md:grid-cols-2 gap-8 mt-10 pt-8 border-t border-gray-100">
                <section>
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Skills you can develop</h2>
                  {course.obtainable_skills.length ? <ul className="space-y-2">{course.obtainable_skills.map((skill) => <li key={skill} className="text-sm text-gray-600 flex gap-2"><span className="text-orange-500">•</span>{skill}</li>)}</ul> : <p className="text-sm text-gray-400">No skills listed.</p>}
                </section>
                <section>
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Possible career paths</h2>
                  {course.career_paths.length ? <ul className="space-y-2">{course.career_paths.map((career) => <li key={career} className="text-sm text-gray-600 flex gap-2"><span className="text-orange-500">•</span>{career}</li>)}</ul> : <p className="text-sm text-gray-400">No career paths listed.</p>}
                </section>
              </div>

            </div>
            <div className="mt-6">
              <CourseEnrichmentSections course={course} />
            </div>
            <div className="bg-gray-900 rounded-2xl p-7 sm:p-9 mt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
              <div><h2 className="text-xl font-semibold text-white">Is this course right for you?</h2><p className="text-sm text-gray-400 mt-1">Get recommendations based on your skills, interests, and personality.</p></div>
              <Link to={isAuthenticated ? '/dashboard' : '/register'} className="shrink-0 text-center bg-orange-500 text-white px-5 py-3 rounded-xl font-medium hover:bg-orange-600">Take the LearnMatch Assessment</Link>
            </div>
          </article>
        )}
      </main>
    </div>
  )
}

export default PublicCourseDetails
