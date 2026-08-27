import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

// Placeholder data — replace once CAREER_ROADMAP / CAREER_OPPORTUNITY are populated
const placeholderSkills = [
  'Problem Solving', 'Technical Communication', 'Analytical Thinking',
  'Project Management', 'Research Methods',
]

const placeholderTimeline = [
  {
    year: 'Year 1',
    focus: 'Foundation courses to build core knowledge in the field.',
    subjects: ['Introduction to the Field', 'General Education', 'Basic Mathematics'],
  },
  {
    year: 'Year 2',
    focus: 'Core major subjects begin, building on your foundation.',
    subjects: ['Core Major Subject 1', 'Core Major Subject 2', 'Related Elective'],
  },
  {
    year: 'Year 3',
    focus: 'Specialization and more advanced, hands-on coursework.',
    subjects: ['Advanced Major Subject', 'Practicum/Lab Work', 'Specialization Track'],
  },
  {
    year: 'Year 4',
    focus: 'Capstone project, internship, and preparation for licensure/employment.',
    subjects: ['Capstone / Thesis', 'On-the-Job Training', 'Licensure Review (if applicable)'],
  },
]

const placeholderOpportunities = [
  { title: 'Entry-Level Role in the Field', salary: '₱18,000 - ₱28,000/month' },
  { title: 'Mid-Level Specialist', salary: '₱30,000 - ₱50,000/month' },
  { title: 'Related Career Path', salary: '₱25,000 - ₱40,000/month' },
]

function CareerPath() {
  const navigate = useNavigate()
  const { courseId } = useParams()
  const [course, setCourse] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/api/courses/${courseId}`)
      .then((res) => res.json())
      .then((data) => {
        setCourse(data.course || null)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [courseId])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-400">Loading...</p>
      </div>
    )
  }

    return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-100 px-8 py-5 flex justify-between items-center">
        <button
          onClick={() => navigate('/dashboard')}
          className="text-lg font-bold text-gray-900 hover:opacity-80 transition"
        >
          Learn<span className="text-orange-500">Match</span>
        </button>
        <button
          onClick={() => navigate('/results')}
          className="text-sm text-gray-500 hover:text-gray-900 transition"
        >
          ← Back to Results
        </button>
      </nav>

      <div className="max-w-[1320px] mx-auto px-14 py-11">

        {/* Course title + description */}
        <span className="text-xs font-semibold text-orange-500 uppercase tracking-wide">
          {course?.cluster_category}
        </span>
        <h1 className="text-2xl font-bold text-gray-900 mt-1 mb-3">
          {course?.course_name || 'Course'}
        </h1>
        <p className="text-sm text-gray-600 leading-relaxed mb-8 max-w-3xl">
          {course?.description || 'Course description not yet available.'}
        </p>

        {/* Two-column layout */}
        <div className="grid grid-cols-[1.5fr_1fr] gap-5 items-start">

          {/* Left: Timeline */}
          <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
            <h2 className="text-sm font-bold text-gray-900 mb-1">Your Path Through the Program</h2>
            <p className="text-xs text-orange-400 mb-5">Placeholder — actual roadmap coming soon</p>

            <div className="relative pl-6">
              <div className="absolute left-[7px] top-2 bottom-2 w-px bg-gray-200" />
              {placeholderTimeline.map((item) => (
                <div key={item.year} className="relative mb-7 last:mb-0">
                  <div className="absolute -left-6 top-1 w-3.5 h-3.5 rounded-full bg-orange-500 border-2 border-white shadow" />
                  <p className="text-xs font-bold text-orange-500 uppercase tracking-wide mb-1">
                    {item.year}
                  </p>
                  <p className="text-sm text-gray-700 mb-2">{item.focus}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {item.subjects.map((subj) => (
                      <span
                        key={subj}
                        className="text-xs px-2.5 py-1 rounded-lg bg-gray-100 text-gray-600"
                      >
                        {subj}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Skills + Career Opportunities stacked */}
          <div className="flex flex-col gap-5">

            <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
              <h2 className="text-sm font-bold text-gray-900 mb-1">Obtainable Skills</h2>
              <p className="text-xs text-orange-400 mb-4">Placeholder — actual skills coming soon</p>
              <div className="flex flex-wrap gap-2">
                {placeholderSkills.map((skill) => (
                  <span
                    key={skill}
                    className="text-xs px-3 py-1.5 rounded-full bg-orange-50 text-orange-700 font-medium"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>

            <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
              <h2 className="text-sm font-bold text-gray-900 mb-1">Career Opportunities</h2>
              <p className="text-xs text-orange-400 mb-4">Placeholder — actual opportunities coming soon</p>
              <div className="space-y-3">
                {placeholderOpportunities.map((job) => (
                  <div key={job.title} className="flex justify-between items-center border-b border-gray-50 pb-3 last:border-0 last:pb-0">
                    <span className="text-sm text-gray-700">{job.title}</span>
                    <span className="text-xs text-gray-400 shrink-0 ml-3">{job.salary}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>

        </div>

      </div>
    </div>
  )
}

export default CareerPath