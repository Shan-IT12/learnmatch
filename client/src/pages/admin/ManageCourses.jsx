import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconPlus, IconEdit, IconArrowLeft, IconSearch, IconX } from '@tabler/icons-react'
import AdminHeader from '../../components/AdminHeader'
import { FieldError, RequiredMark } from '../../components/FormValidation'
import { scrollToFirstInvalidField } from '../../utils/formValidation'

const emptyCourseForm = {
  course_name: '',
  cluster_category: '',
  description: '',
  obtainable_skills: '',
}

const clusterOptions = [
  ['HEALTHCARE SCIENCE CLUSTER', 'Healthcare Science'],
  ['HUMANITIES & SOCIAL SCIENCE CLUSTER', 'Humanities & Social Science'],
  ['BUSINESS CLUSTER', 'Business'],
  ['HOSPITALITY & TOURISM CLUSTER', 'Hospitality & Tourism'],
  ['AVIATION & MARITIME CLUSTER', 'Aviation & Maritime'],
  ['LEGAL & PUBLIC SERVICE CLUSTER', 'Legal & Public Service'],
  ['EDUCATION CLUSTER', 'Education'],
  ['ARTS & MULTIMEDIA CLUSTER', 'Arts & Multimedia'],
  ['CRIMINOLOGY CLUSTER', 'Criminology'],
  ['AGRICULTURE & ENVIRONMENTAL CLUSTER', 'Agriculture & Environmental'],
  ['SCIENCE & MATHEMATICS CLUSTER', 'Science & Mathematics'],
  ['SPORTS & PHYSICAL EDUCATION CLUSTER', 'Sports & Physical Education'],
  ['ENGINEERING / STEM CLUSTER', 'Engineering / STEM'],
]

function handleUnauthorized(response, navigate) {
  if (response.status !== 401 && response.status !== 403) return false
  localStorage.removeItem('adminToken')
  localStorage.removeItem('adminUsername')
  navigate('/admin/login', { replace: true })
  return true
}

function isCourseActive(course) {
  return course.is_active === true || Number(course.is_active) === 1
}

function CourseStatus({ active }) {
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium ${
      active
        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
        : 'border-gray-200 bg-gray-100 text-gray-600'
    }`}>
      {active ? 'Active' : 'Inactive'}
    </span>
  )
}

function CourseActions({ course, active, openEditCourseForm, handleStatusChange, updatingStatusId }) {
  return (
    <div className="flex items-center justify-end gap-2">
      <button
        type="button"
        onClick={() => openEditCourseForm(course.course_id)}
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-500 transition hover:bg-orange-50 hover:text-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500"
        aria-label={`Edit ${course.course_name}`}
      >
        <IconEdit size={16} stroke={1.75} />
      </button>
      <button
        type="button"
        onClick={() => handleStatusChange(course)}
        disabled={updatingStatusId === course.course_id}
        aria-label={`${active ? 'Deactivate' : 'Reactivate'} ${course.course_name}`}
        className={`min-w-24 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium transition focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50 ${
          active ? 'text-red-600 hover:bg-red-50' : 'text-emerald-700 hover:bg-emerald-50'
        }`}
      >
        {updatingStatusId === course.course_id
          ? 'Updating...'
          : active ? 'Deactivate' : 'Reactivate'}
      </button>
    </div>
  )
}

function CourseTable({ courses, openEditCourseForm, handleStatusChange, updatingStatusId }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-orange-100 bg-white shadow-sm">
      <div className="hidden md:block">
        <table className="w-full table-fixed text-sm">
          <colgroup>
            <col className="w-[58%]" />
            <col className="w-[16%]" />
            <col className="w-[26%]" />
          </colgroup>
          <thead>
            <tr className="border-b border-gray-100 bg-orange-50/50 text-left text-xs uppercase tracking-wide text-gray-500">
              <th scope="col" className="px-6 py-3.5 font-semibold">Course</th>
              <th scope="col" className="px-5 py-3.5 font-semibold">Status</th>
              <th scope="col" className="px-6 py-3.5 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {courses.map((course) => {
              const active = isCourseActive(course)
              const courseIdentifiers = [course.course_code, course.course_abbreviation].filter(Boolean).join(' · ')

              return (
                <tr key={course.course_id} className="transition hover:bg-orange-50/30">
                  <td className="px-6 py-4 align-middle">
                    <p className="break-words font-medium leading-5 text-gray-900">{course.course_name}</p>
                    {courseIdentifiers && <p className="mt-1 break-words text-xs text-gray-500">{courseIdentifiers}</p>}
                  </td>
                  <td className="px-5 py-4 align-middle">
                    <CourseStatus active={active} />
                  </td>
                  <td className="px-6 py-4 align-middle">
                    <CourseActions course={course} active={active} openEditCourseForm={openEditCourseForm} handleStatusChange={handleStatusChange} updatingStatusId={updatingStatusId} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="divide-y divide-gray-100 md:hidden">
        {courses.map((course) => {
          const active = isCourseActive(course)
          const courseIdentifiers = [course.course_code, course.course_abbreviation].filter(Boolean).join(' · ')

          return (
            <article key={course.course_id} className="px-4 py-4 sm:px-5">
              <p className="break-words text-sm font-medium leading-5 text-gray-900">{course.course_name}</p>
              {courseIdentifiers && <p className="mt-1 break-words text-xs text-gray-500">{courseIdentifiers}</p>}
              <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4">
                <div>
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Status</p>
                  <CourseStatus active={active} />
                </div>
                <div>
                  <p className="mb-1.5 text-right text-[11px] font-semibold uppercase tracking-wide text-gray-400">Actions</p>
                  <CourseActions course={course} active={active} openEditCourseForm={openEditCourseForm} handleStatusChange={handleStatusChange} updatingStatusId={updatingStatusId} />
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}

function ManageCourses() {
  const navigate = useNavigate()
  const adminToken = localStorage.getItem('adminToken')

  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('list')
  const [editingCourseId, setEditingCourseId] = useState(null)
  const [courseForm, setCourseForm] = useState(emptyCourseForm)
  const [canonicalCareers, setCanonicalCareers] = useState([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [fieldErrors, setFieldErrors] = useState({})
  const [updatingStatusId, setUpdatingStatusId] = useState(null)
  const [search, setSearch] = useState('')
  const [clusterFilter, setClusterFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortBy, setSortBy] = useState('name-asc')

  const availableClusterOptions = useMemo(() => (
    [...new Set(courses.map(({ cluster_category }) => cluster_category).filter(Boolean))]
      .sort((first, second) => first.localeCompare(second))
  ), [courses])

  const visibleCourses = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase()
    const matchesSearch = (course) => !normalizedSearch || [
      course.course_name,
      course.course_abbreviation,
      course.course_code,
    ].some((value) => value?.toLocaleLowerCase().includes(normalizedSearch))
    const compareNames = (first, second) => (
      (first.course_name || '').localeCompare(second.course_name || '', undefined, { sensitivity: 'base' })
    )
    const compareCodes = (first, second) => (
      (first.course_code || '').localeCompare(second.course_code || '', undefined, { numeric: true, sensitivity: 'base' })
    )

    return courses
      .filter((course) => (
        matchesSearch(course)
        && (clusterFilter === 'all' || course.cluster_category === clusterFilter)
        && (statusFilter === 'all'
          || (statusFilter === 'active' ? isCourseActive(course) : !isCourseActive(course)))
      ))
      .sort((first, second) => {
        if (sortBy === 'name-desc') return compareNames(second, first)
        if (sortBy === 'code-asc') return compareCodes(first, second)
        if (sortBy === 'code-desc') return compareCodes(second, first)
        if (sortBy === 'active-first') return Number(isCourseActive(second)) - Number(isCourseActive(first)) || compareNames(first, second)
        if (sortBy === 'inactive-first') return Number(isCourseActive(first)) - Number(isCourseActive(second)) || compareNames(first, second)
        return compareNames(first, second)
      })
  }, [courses, search, clusterFilter, statusFilter, sortBy])

  const groupedCourses = useMemo(() => {
    if (clusterFilter !== 'all') return []

    return Object.entries(visibleCourses.reduce((groups, course) => {
      const cluster = course.cluster_category || 'Uncategorized'
      groups[cluster] = [...(groups[cluster] || []), course]
      return groups
    }, {})).sort(([first], [second]) => first.localeCompare(second))
  }, [visibleCourses, clusterFilter])

  const hasActiveFilters = Boolean(search) || clusterFilter !== 'all' || statusFilter !== 'all' || sortBy !== 'name-asc'

  const clearFilters = () => {
    setSearch('')
    setClusterFilter('all')
    setStatusFilter('all')
    setSortBy('name-asc')
  }

  useEffect(() => {
    document.title = 'Manage Courses | LearnMatch Admin'
  }, [])

  const fetchCourses = async () => {
    setLoading(true)

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/courses`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      })
      if (handleUnauthorized(res, navigate)) return

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
        if (handleUnauthorized(res, navigate)) return

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
    setCanonicalCareers([])
    setView('form')
  }

  const openEditCourseForm = async (courseId) => {
    setError('')
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/courses/${courseId}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      })
      if (handleUnauthorized(res, navigate)) return
      const data = await res.json()

      setEditingCourseId(courseId)
      setCourseForm({
        course_name: data.course.course_name || '',
        cluster_category: data.course.cluster_category || '',
        description: data.course.description || '',
        obtainable_skills: data.course.obtainable_skills || '',
      })
      setCanonicalCareers(data.canonicalCareers || [])
      setView('form')
    } catch {
      setError('Could not load course details.')
    }
  }

  const handleCourseFormChange = (e) => {
    const { name, value } = e.target
    setCourseForm({ ...courseForm, [name]: value })
    setFieldErrors((current) => ({ ...current, [name]: undefined }))
  }

  const handleSaveCourse = async (e) => {
    e.preventDefault()
    setError('')

    const nextErrors = {}
    if (!courseForm.course_name.trim()) nextErrors.course_name = 'Please enter a course name.'
    if (!courseForm.cluster_category) nextErrors.cluster_category = 'Please select a cluster category.'
    if (Object.keys(nextErrors).length) { setFieldErrors(nextErrors); scrollToFirstInvalidField(Object.keys(nextErrors)); return }
    setFieldErrors({})

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

      if (handleUnauthorized(res, navigate)) {
        setSaving(false)
        return
      }

      if (!res.ok) {
        setError(data.message || 'Something went wrong.')
        setSaving(false)
        return
      }

      if (!editingCourseId) setEditingCourseId(data.courseId)

      await fetchCourses()
      setSaving(false)
    } catch {
      setError('Cannot connect to server.')
      setSaving(false)
    }
  }

  const handleStatusChange = async (course) => {
    const nextStatus = !isCourseActive(course)
    if (!nextStatus && !window.confirm(`Deactivate ${course.course_name}? It will be hidden from public course discovery and recommendations.`)) return

    setError('')
    setUpdatingStatusId(course.course_id)
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/courses/${course.course_id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ is_active: nextStatus }),
      })
      if (handleUnauthorized(response, navigate)) return
      const data = await response.json()
      if (!response.ok) {
        const reasons = Array.isArray(data.reasons)
          ? data.reasons.map((reason) => reason.message).join(' · ')
          : ''
        setError([data.message || 'Could not update course status.', reasons].filter(Boolean).join(' '))
        return
      }
      setCourses((current) => current.map((item) =>
        item.course_id === course.course_id ? { ...item, is_active: nextStatus } : item
      ))
    } catch {
      setError('Could not update course status.')
    } finally {
      setUpdatingStatusId(null)
    }
  }

  if (view === 'list') {
    return (
      <div className="min-h-screen bg-orange-50/40">
        <AdminHeader currentPage="courses" />

        <main className="max-w-6xl mx-auto px-5 sm:px-8 py-10 sm:py-12">
          <button type="button" onClick={() => navigate('/admin')} className="text-sm text-gray-500 hover:text-orange-600 transition mb-6 focus:outline-none focus:ring-2 focus:ring-orange-500 rounded">
            ← Back to Dashboard
          </button>
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-1">Manage Courses</h1>
              <p className="text-sm text-gray-500">Manage the validated LearnMatch course catalog.</p>
            </div>
            <button
              onClick={openNewCourseForm}
              className="inline-flex items-center gap-2 bg-orange-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-orange-600 transition"
            >
              <IconPlus size={16} stroke={2} /> Add Course
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl text-sm mb-6" role="alert">
              {error}
            </div>
          )}

          {loading ? (
            <div className="bg-white border border-orange-100 rounded-2xl shadow-sm">
              <p className="text-center text-gray-500 text-sm py-12">Loading courses...</p>
            </div>
          ) : (
            <>
              <div className="bg-white border border-orange-100 rounded-2xl p-4 sm:p-5 shadow-sm mb-5">
                <div className="flex flex-col lg:flex-row gap-3">
                  <div className="relative flex-1 min-w-0">
                    <IconSearch size={18} stroke={1.75} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    <input
                      type="search"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search courses..."
                      aria-label="Search courses by name, abbreviation, or code"
                      className="w-full border border-gray-200 rounded-xl pl-10 pr-10 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                    {search && (
                      <button
                        type="button"
                        onClick={() => setSearch('')}
                        aria-label="Clear course search"
                        className="absolute right-1 top-1/2 -translate-y-1/2 w-10 h-10 inline-flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-500"
                      >
                        <IconX size={17} stroke={1.75} />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 lg:w-[540px]">
                    <select
                      value={clusterFilter}
                      onChange={(event) => setClusterFilter(event.target.value)}
                      aria-label="Filter by cluster"
                      className="w-full bg-white border border-gray-200 rounded-xl px-3 py-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    >
                      <option value="all">All Clusters</option>
                      {availableClusterOptions.map((cluster) => <option key={cluster} value={cluster}>{cluster}</option>)}
                    </select>
                    <select
                      value={statusFilter}
                      onChange={(event) => setStatusFilter(event.target.value)}
                      aria-label="Filter by status"
                      className="w-full bg-white border border-gray-200 rounded-xl px-3 py-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    >
                      <option value="all">All Status</option>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                    <select
                      value={sortBy}
                      onChange={(event) => setSortBy(event.target.value)}
                      aria-label="Sort courses"
                      className="w-full bg-white border border-gray-200 rounded-xl px-3 py-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    >
                      <option value="name-asc">Course Name: A-Z</option>
                      <option value="name-desc">Course Name: Z-A</option>
                      <option value="code-asc">Course Code: Ascending</option>
                      <option value="code-desc">Course Code: Descending</option>
                      <option value="active-first">Active First</option>
                      <option value="inactive-first">Inactive First</option>
                    </select>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
                  <p className="text-sm text-gray-500">
                    {hasActiveFilters ? `${visibleCourses.length} of ${courses.length} courses` : `${courses.length} courses`}
                  </p>
                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="text-sm font-medium text-orange-600 hover:text-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 rounded"
                    >
                      Clear filters
                    </button>
                  )}
                </div>
              </div>

              {visibleCourses.length === 0 ? (
                <div className="bg-white border border-orange-100 rounded-2xl p-10 text-center shadow-sm">
                  <h2 className="text-lg font-semibold text-gray-900">No courses found.</h2>
                  <p className="text-sm text-gray-500 mt-2">Try changing your search or filters.</p>
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="mt-5 text-sm font-medium text-orange-600 hover:text-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 rounded"
                  >
                    Clear filters
                  </button>
                </div>
              ) : clusterFilter === 'all' ? (
                <div className="space-y-8">
                  {groupedCourses.map(([cluster, clusterCourses]) => (
                    <section key={cluster} aria-labelledby={`cluster-${cluster}`}>
                      <div className="mb-3 flex items-start justify-between gap-4 px-1 sm:items-baseline">
                        <h2 id={`cluster-${cluster}`} className="min-w-0 break-words text-base font-semibold text-gray-900">{cluster}</h2>
                        <p className="text-xs text-gray-500 shrink-0">{clusterCourses.length} {clusterCourses.length === 1 ? 'course' : 'courses'}</p>
                      </div>
                      <CourseTable
                        courses={clusterCourses}
                        openEditCourseForm={openEditCourseForm}
                        handleStatusChange={handleStatusChange}
                        updatingStatusId={updatingStatusId}
                      />
                    </section>
                  ))}
                </div>
              ) : (
                <CourseTable
                  courses={visibleCourses}
                  openEditCourseForm={openEditCourseForm}
                  handleStatusChange={handleStatusChange}
                  updatingStatusId={updatingStatusId}
                />
              )}
            </>
          )}
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-orange-50/40">
      <AdminHeader currentPage="courses" />

      <main className="max-w-3xl mx-auto px-5 sm:px-8 py-10 sm:py-12">
        <button type="button" onClick={() => navigate('/admin')} className="text-sm text-gray-500 hover:text-orange-600 transition mb-5 focus:outline-none focus:ring-2 focus:ring-orange-500 rounded">
          ← Back to Dashboard
        </button>
        <button
          type="button"
          onClick={() => setView('list')}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-orange-600 transition mb-6 focus:outline-none focus:ring-2 focus:ring-orange-500 rounded"
        >
          <IconArrowLeft size={16} stroke={2} /> Back to Courses
        </button>
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          {editingCourseId ? 'Edit Course' : 'Add New Course'}
        </h1>

        {error && (
          <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl text-sm mb-6" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSaveCourse} noValidate className="space-y-5 mb-8 bg-white border border-orange-100 rounded-2xl p-5 sm:p-7 shadow-sm">
          <div data-validation-field="course_name">
            <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wide">
              Course Name <RequiredMark />
            </label>
            <input
              type="text"
              name="course_name"
              value={courseForm.course_name}
              onChange={handleCourseFormChange}
              className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
              required
              aria-required="true" aria-invalid={fieldErrors.course_name ? 'true' : undefined} aria-describedby={fieldErrors.course_name ? 'course-name-error' : undefined}
            />
            <FieldError id="course-name-error">{fieldErrors.course_name}</FieldError>
          </div>

          <div data-validation-field="cluster_category">
            <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wide">
              Cluster Category <RequiredMark />
            </label>
            <select
              name="cluster_category"
              value={courseForm.cluster_category}
              onChange={handleCourseFormChange}
              className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
              required
              aria-required="true" aria-invalid={fieldErrors.cluster_category ? 'true' : undefined} aria-describedby={fieldErrors.cluster_category ? 'cluster-category-error' : undefined}
            >
              <option value="" disabled>Select a cluster</option>
              {clusterOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <FieldError id="cluster-category-error">{fieldErrors.cluster_category}</FieldError>
            {editingCourseId && (
              <p className="mt-2 text-xs leading-5 text-amber-700">
                Changing the cluster affects future recommendation behavior. Review the course matching profile after reclustering.
              </p>
            )}
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
              className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
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
              className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="bg-orange-500 text-white px-6 py-3 rounded-xl font-medium hover:bg-orange-600 transition text-sm disabled:opacity-50"
          >
            {saving ? 'Saving...' : editingCourseId ? 'Save Changes' : 'Create Course'}
          </button>
        </form>

        {editingCourseId && (
          <div className="bg-white border border-orange-100 rounded-2xl p-5 sm:p-7 shadow-sm">
            <div className="mb-4">
              <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
                Career Opportunities
              </h2>
              <p className="mt-2 text-xs leading-5 text-gray-500">
                Read-only information from the canonical course enrichment catalog. Career data is not managed from this form.
              </p>
            </div>

            <div className="space-y-3">
              {canonicalCareers.length > 0 ? (
                canonicalCareers.map((career) => (
                  <article key={career.career_id || career.career_title} className="rounded-xl border border-gray-100 px-4 py-3">
                    <p className="text-sm font-medium text-gray-900">{career.career_title}</p>
                    {career.estimated_monthly_salary_php?.display && (
                      <p className="mt-1 text-xs font-medium text-orange-600">{career.estimated_monthly_salary_php.display}</p>
                    )}
                    {career.philippines_description && (
                      <p className="mt-2 text-xs leading-5 text-gray-500">{career.philippines_description}</p>
                    )}
                  </article>
                ))
              ) : (
                <p className="rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-500">
                  No canonical career information is available for this course.
                </p>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default ManageCourses
