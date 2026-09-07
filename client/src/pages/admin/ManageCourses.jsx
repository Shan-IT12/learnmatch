import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconPlus, IconEdit, IconTrash, IconArrowLeft, IconX } from '@tabler/icons-react'

const emptyCourseForm = {
  course_name: '',
  program_type: '',
  cluster_category: '',
  psced_group: '',
  description: '',
  obtainable_skills: '',
  is_active: true,
}

const emptyCareerForm = { job_title: '', salary_range: '', description: '' }

function ManageCourses() {
  const navigate = useNavigate()
  const adminToken = localStorage.getItem('adminToken')

  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('list')
  const [editingCourseId, setEditingCourseId] = useState(null)
  const [courseForm, setCourseForm] = useState(emptyCourseForm)
  const [careers, setCareers] = useState([])
  const [careerForm, setCareerForm] = useState(emptyCareerForm)
  const [showCareerForm, setShowCareerForm] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchCourses = async () => {
    setLoading(true)

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/courses`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      })

      const data = await res.json()
      setCourses(data.courses || [])
    } catch {
      setError('Could not load courses.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!adminToken) {
      navigate('/admin/login')
      return
    }

    const loadCourses = async () => {
      setLoading(true)

      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/courses`, {
          headers: { Authorization: `Bearer ${adminToken}` },
        })

        const data = await res.json()
        setCourses(data.courses || [])
      } catch {
        setError('Could not load courses.')
      } finally {
        setLoading(false)
      }
    }

    loadCourses()
  }, [adminToken, navigate])

  const openNewCourseForm = () => {
    setEditingCourseId(null)
    setCourseForm(emptyCourseForm)
    setCareers([])
    setView('form')
  }

  const openEditCourseForm = async (courseId) => {
    setError('')
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/courses/${courseId}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      })
      const data = await res.json()

      setEditingCourseId(courseId)
      setCourseForm({
        course_name: data.course.course_name || '',
        program_type: data.course.program_type || '',
        cluster_category: data.course.cluster_category || '',
        psced_group: data.course.psced_group || '',
        description: data.course.description || '',
        obtainable_skills: data.course.obtainable_skills || '',
        is_active: !!data.course.is_active,
      })
      setCareers(data.careers || [])
      setView('form')
    } catch {
      setError('Could not load course details.')
    }
  }

  const handleCourseFormChange = (e) => {
    const { name, value, type, checked } = e.target
    setCourseForm({ ...courseForm, [name]: type === 'checkbox' ? checked : value })
  }

  const handleSaveCourse = async (e) => {
    e.preventDefault()
    setError('')

    if (!courseForm.course_name || !courseForm.cluster_category) {
      setError('Course name and cluster category are required.')
      return
    }

    setSaving(true)
    try {
      const url = editingCourseId
        ? `${import.meta.env.VITE_API_URL}/api/admin/courses/${editingCourseId}`
        : `${import.meta.env.VITE_API_URL}/api/admin/courses`
      const method = editingCourseId ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify(courseForm),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.message || 'Something went wrong.')
        setSaving(false)
        return
      }

      if (!editingCourseId) {
        setEditingCourseId(data.courseId)
      }

      await fetchCourses()
      setSaving(false)
    } catch {
      setError('Cannot connect to server.')
      setSaving(false)
    }
  }

  const handleDeleteCourse = async (courseId) => {
    if (!window.confirm('Delete this course? This cannot be undone.')) return

    try {
      await fetch(`${import.meta.env.VITE_API_URL}/api/admin/courses/${courseId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      })
      fetchCourses()
    } catch {
      setError('Could not delete course.')
    }
  }

  const handleAddCareer = async (e) => {
    e.preventDefault()
    if (!careerForm.job_title) return

    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/admin/courses/${editingCourseId}/careers`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify(careerForm),
        }
      )
      const data = await res.json()

      setCareers([...careers, { opportunity_id: data.opportunityId, ...careerForm }])
      setCareerForm(emptyCareerForm)
      setShowCareerForm(false)
    } catch {
      setError('Could not add career opportunity.')
    }
  }

  const handleDeleteCareer = async (opportunityId) => {
    try {
      await fetch(`${import.meta.env.VITE_API_URL}/api/admin/careers/${opportunityId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      })
      setCareers(careers.filter((c) => c.opportunity_id !== opportunityId))
    } catch {
      setError('Could not delete career opportunity.')
    }
  }

  if (view === 'list') {
    return (
      <div className="min-h-screen bg-gray-950">
        <nav className="bg-gray-900 border-b border-gray-800 px-8 py-5 flex justify-between items-center">
          <button
            onClick={() => navigate('/admin')}
            className="text-lg font-bold text-white hover:opacity-80 transition"
          >
            Learn<span className="text-orange-500">Match</span> <span className="text-gray-500 text-sm font-normal">Admin</span>
          </button>
          <button
            onClick={() => navigate('/admin')}
            className="text-sm text-gray-400 hover:text-white transition"
          >
            ← Dashboard
          </button>
        </nav>

        <div className="max-w-5xl mx-auto px-6 py-12">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-2xl font-bold text-white mb-1">Manage Courses</h1>
              <p className="text-sm text-gray-400">{courses.length} courses total</p>
            </div>
            <button
              onClick={openNewCourseForm}
              className="inline-flex items-center gap-2 bg-orange-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-orange-600 transition"
            >
              <IconPlus size={16} stroke={2} /> Add Course
            </button>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm mb-6">
              {error}
            </div>
          )}

          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            {loading ? (
              <p className="text-center text-gray-500 text-sm py-12">Loading courses...</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-left text-gray-500 text-xs uppercase tracking-wide">
                    <th className="px-6 py-3 font-medium">Course Name</th>
                    <th className="px-6 py-3 font-medium">Cluster</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                    <th className="px-6 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {courses.map((course) => (
                    <tr key={course.course_id} className="border-b border-gray-800 last:border-0 hover:bg-gray-800/50 transition">
                      <td className="px-6 py-4 text-white font-medium">{course.course_name}</td>
                      <td className="px-6 py-4 text-gray-400">{course.cluster_category}</td>
                      <td className="px-6 py-4">
                        <span
                          className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                            course.is_active
                              ? 'bg-green-500/10 text-green-400'
                              : 'bg-gray-700 text-gray-400'
                          }`}
                        >
                          {course.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => openEditCourseForm(course.course_id)}
                            className="text-gray-400 hover:text-orange-400 transition p-1.5"
                          >
                            <IconEdit size={16} stroke={1.75} />
                          </button>
                          <button
                            onClick={() => handleDeleteCourse(course.course_id)}
                            className="text-gray-400 hover:text-red-400 transition p-1.5"
                          >
                            <IconTrash size={16} stroke={1.75} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <nav className="bg-gray-900 border-b border-gray-800 px-8 py-5 flex justify-between items-center">
        <button
          onClick={() => navigate('/admin')}
          className="text-lg font-bold text-white hover:opacity-80 transition"
        >
          Learn<span className="text-orange-500">Match</span> <span className="text-gray-500 text-sm font-normal">Admin</span>
        </button>
        <button
          onClick={() => setView('list')}
          className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition"
        >
          <IconArrowLeft size={16} stroke={2} /> Back to Courses
        </button>
      </nav>

      <div className="max-w-2xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-bold text-white mb-8">
          {editingCourseId ? 'Edit Course' : 'Add New Course'}
        </h1>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSaveCourse} className="space-y-5 mb-10">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wide">
              Course Name *
            </label>
            <input
              type="text"
              name="course_name"
              value={courseForm.course_name}
              onChange={handleCourseFormChange}
              className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wide">
                Cluster Category *
              </label>
              <input
                type="text"
                name="cluster_category"
                value={courseForm.cluster_category}
                onChange={handleCourseFormChange}
                className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wide">
                Program Type
              </label>
              <input
                type="text"
                name="program_type"
                value={courseForm.program_type}
                onChange={handleCourseFormChange}
                className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wide">
              PSCED Group
            </label>
            <input
              type="text"
              name="psced_group"
              value={courseForm.psced_group}
              onChange={handleCourseFormChange}
              className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wide">
              Description
            </label>
            <textarea
              name="description"
              value={courseForm.description}
              onChange={handleCourseFormChange}
              rows={4}
              className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wide">
              Obtainable Skills
            </label>
            <textarea
              name="obtainable_skills"
              value={courseForm.obtainable_skills}
              onChange={handleCourseFormChange}
              rows={3}
              placeholder="Separate each skill with a comma, e.g. Programming, Database Design, Project Management"
              className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
            />
          </div>

          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              name="is_active"
              checked={courseForm.is_active}
              onChange={handleCourseFormChange}
              className="w-4 h-4 accent-orange-500"
            />
            <span className="text-sm text-gray-300">Active (visible to students)</span>
          </label>

          <button
            type="submit"
            disabled={saving}
            className="bg-orange-500 text-white px-6 py-3 rounded-xl font-medium hover:bg-orange-600 transition text-sm disabled:opacity-50"
          >
            {saving ? 'Saving...' : editingCourseId ? 'Save Changes' : 'Create Course'}
          </button>
        </form>

        {editingCourseId && (
          <div className="border-t border-gray-800 pt-8">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-sm font-semibold text-white uppercase tracking-wide">
                Career Opportunities
              </h2>
              <button
                onClick={() => setShowCareerForm(!showCareerForm)}
                className="text-xs text-orange-400 hover:text-orange-300 transition font-medium inline-flex items-center gap-1"
              >
                <IconPlus size={14} stroke={2} /> Add
              </button>
            </div>

            {showCareerForm && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-4">
                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="Job title"
                    value={careerForm.job_title}
                    onChange={(e) => setCareerForm({ ...careerForm, job_title: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                  <input
                    type="text"
                    placeholder="Salary range, e.g. ₱25,000 - ₱40,000/month"
                    value={careerForm.salary_range}
                    onChange={(e) => setCareerForm({ ...careerForm, salary_range: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                  <textarea
                    placeholder="Short description (optional)"
                    value={careerForm.description}
                    onChange={(e) => setCareerForm({ ...careerForm, description: e.target.value })}
                    rows={2}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                  />
                  <button
                    onClick={handleAddCareer}
                    className="bg-orange-500 text-white px-4 py-2 rounded-lg text-xs font-medium hover:bg-orange-600 transition"
                  >
                    Add Career
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {careers.length > 0 ? (
                careers.map((career) => (
                  <div
                    key={career.opportunity_id}
                    className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 flex justify-between items-center"
                  >
                    <div>
                      <p className="text-sm text-white font-medium">{career.job_title}</p>
                      {career.salary_range && (
                        <p className="text-xs text-gray-500 mt-0.5">{career.salary_range}</p>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteCareer(career.opportunity_id)}
                      className="text-gray-500 hover:text-red-400 transition p-1"
                    >
                      <IconX size={16} stroke={1.75} />
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500">No career opportunities added yet.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default ManageCourses