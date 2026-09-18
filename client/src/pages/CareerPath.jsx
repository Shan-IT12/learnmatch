import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import CourseEnrichmentSections from '../components/CourseEnrichmentSections'

const apiUrl = import.meta.env.VITE_API_URL || ''

function CareerPath() {
  const navigate = useNavigate()
  const location = useLocation()
  const { courseCode } = useParams()
  const passedRecommendations = location.state?.recommendations
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
      state: { recommendations: topRecommendations },
    })
  }

  const backToSelector = () => {
    navigate('/results/career-path', {
      state: topRecommendations.length ? { recommendations: topRecommendations } : undefined,
    })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-100 px-6 sm:px-8 py-5 flex justify-between items-center">
        <button onClick={() => navigate('/dashboard')} className="text-lg font-bold text-gray-900 hover:opacity-80 transition">
          Learn<span className="text-orange-500">Match</span>
        </button>
        <button onClick={courseCode ? backToSelector : () => navigate('/results')} className="text-sm text-gray-500 hover:text-gray-900 transition">
          ← {courseCode ? 'Back to Career Paths' : 'Back to Results'}
        </button>
      </nav>

      <main className="max-w-[1320px] mx-auto px-5 sm:px-10 lg:px-14 py-10 sm:py-11">
        {status === 'loading' && <p className="text-sm text-gray-400">{courseCode ? 'Loading course roadmap…' : 'Loading your recommendations…'}</p>}
        {status === 'error' && <p className="bg-red-50 border border-red-100 text-red-700 rounded-xl p-5">We couldn’t load this information. Please try again.</p>}
        {status === 'not-found' && <p className="bg-white border border-gray-100 rounded-xl p-5 text-gray-600">This course is unavailable or inactive.</p>}

        {!courseCode && status === 'success' && (
          <section>
            <p className="text-xs font-semibold text-orange-500 uppercase tracking-wide">Your recommendations</p>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mt-1">Choose a career path to explore</h1>
            <p className="text-sm text-gray-500 mt-2 mb-8">Select one of your Top 3 recommended courses to view its year-by-year roadmap and career opportunities.</p>

            {topRecommendations.length === 0 ? (
              <div className="bg-white border border-gray-100 rounded-2xl p-7 text-gray-500">No course recommendations are available yet.</div>
            ) : (
              <div className="grid md:grid-cols-3 gap-5">
                {topRecommendations.map((recommendation) => (
                  <article key={recommendation.course_id} className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm flex flex-col">
                    <div className="flex items-center justify-between gap-3 mb-4">
                      <span className="text-xs font-semibold text-orange-600 bg-orange-50 px-3 py-1.5 rounded-full">#{recommendation.rank_position} Recommendation</span>
                      <span className="text-sm font-bold text-orange-500">{recommendation.match_score}% match</span>
                    </div>
                    <h2 className="text-lg font-bold text-gray-900 leading-snug">{recommendation.course_name}</h2>
                    <p className="text-sm font-medium text-gray-500 mt-2">{recommendation.course_code}</p>
                    {recommendation.cluster_category && <p className="text-xs text-gray-400 uppercase tracking-wide mt-2">{recommendation.cluster_category}</p>}
                    <button type="button" onClick={() => openCourse(recommendation)} className="mt-6 md:mt-auto pt-3 w-full bg-orange-500 text-white px-4 py-3 rounded-xl text-sm font-medium hover:bg-orange-600 transition">
                      View Career Path
                    </button>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {courseCode && status === 'success' && course && (
          <>
            <span className="text-xs font-semibold text-orange-500 uppercase tracking-wide">{course.cluster_category}</span>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mt-1 mb-1">{course.course_name}</h1>
            <p className="text-sm font-medium text-gray-400 mb-3">{course.course_code}</p>
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
