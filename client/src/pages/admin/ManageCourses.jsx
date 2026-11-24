import SkeletonContent from '../../components/SkeletonContent'
import { recommendationPlaceholders } from '../../data/loadingPlaceholders'
import { useState, useEffect, useMemo, useCallback, useRef, useEffectEvent } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { IconAlertTriangle, IconArrowLeft, IconEye, IconFileUpload, IconPlus, IconSearch, IconSparkles, IconX } from '@tabler/icons-react'
import CourseDraftFields from '../../components/admin/CourseDraftFields'
import DraftCareerFields from '../../components/admin/DraftCareerFields'
import CatalogCourseSources from '../../components/admin/CatalogCourseSources'
import SavedDraftCourseView from '../../components/admin/SavedDraftCourseView'
import DraftDisclosure, { DraftGuidance } from '../../components/admin/DraftDisclosure'
import DraftCourseSources from '../../components/admin/DraftCourseSources'
import SourceFirstDraftSources from '../../components/admin/SourceFirstDraftSources'
import CourseValidationPanel from '../../components/admin/CourseValidationPanel'
import CoursePublicationPanel from '../../components/admin/CoursePublicationPanel'
import { createDraftSource, enteredDraftSources, invalidatePendingReviews } from '../../utils/draftSourceCheckForm'
import { validateApprovedCourseSource, hasInvalidSourceUrls } from '../../../../shared/sourceUrlPolicy'
import { archivedCourseIdentity, archivedCourseLabel, matchesCatalogScope, courseCatalogCounts } from '../../utils/courseCatalogScope'
import { courseListLocation, readCourseListLocation, matchesCourseStatus } from '../../utils/courseListNavigation'
import { emptyDraftFields, draftFormFromCourse, buildDraftPayload } from '../../utils/courseDraftForm'
import { newCourseDraftSessionKey, readNewCourseDraftSession, writeNewCourseDraftSession, clearNewCourseDraftSession } from '../../utils/newCourseDraftSession'
import AdminHeader from '../../components/AdminHeader'
import { FieldError, RequiredMark, PublicationRequiredMark } from '../../components/FormValidation'
import { scrollToFirstInvalidField } from '../../utils/formValidation'
import CourseName from '../../components/CourseName'
import { getDisplayCourseAbbreviation } from '../../utils/courseName'
import SuccessConfirmation from '../../components/SuccessConfirmation'
import { waitForSuccessConfirmation } from '../../utils/successConfirmation'
import { useWorkflowData } from '../../hooks/useCourseValidation'

const noCourses = []

const emptyCourseForm = {
  ...emptyDraftFields,
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

function CourseStatus({ active, draft, archived }) {
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium ${
      active && !archived
        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
        : 'border-gray-200 bg-gray-100 text-gray-600'
    }`}>
      {archived ? 'Archived' : draft ? 'Draft' : active ? 'Active' : 'Inactive'}
    </span>
  )
}

function CourseActions({ course, active, openEditCourseForm, handleStatusChange, updatingStatusId }) {
  return (
    <div className="ml-auto grid w-max grid-cols-[4rem_6.5rem] items-center gap-2">
      <button
        type="button"
        onClick={() => openEditCourseForm(course.course_id)}
        className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg px-2 text-xs text-gray-500 transition hover:bg-orange-50 hover:text-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500"
        aria-label={`View ${course.course_name}`}
      >
        <IconEye size={16} stroke={1.75} /> View
      </button>
      <button
        type="button"
        onClick={() => handleStatusChange(course)}
        disabled={updatingStatusId === course.course_id || Boolean(course.is_draft) || Boolean(archivedCourseIdentity(course))}
        aria-label={archivedCourseIdentity(course) ? `Archived record ${course.course_name}` : `${active ? 'Deactivate' : 'Reactivate'} ${course.course_name}`}
        className={`inline-flex h-9 w-full items-center justify-center whitespace-nowrap rounded-lg px-3 text-xs font-medium transition focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50 ${
          active ? 'text-red-600 hover:bg-red-50' : 'text-emerald-700 hover:bg-emerald-50'
        }`}
      >
        {archivedCourseIdentity(course) ? 'Archived' : course.is_draft ? 'Draft' : updatingStatusId === course.course_id
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
            <col />
            <col className="w-32" />
            <col className="w-56" />
          </colgroup>
          <thead>
            <tr className="border-b border-gray-100 bg-orange-50/50 text-left text-xs uppercase tracking-wide text-gray-500">
              <th scope="col" className="px-6 py-3.5 font-semibold">Course</th>
              <th scope="col" className="px-5 py-3.5 font-semibold">Status</th>
              <th scope="col" className="px-6 py-3.5 font-semibold"><span className="ml-auto block w-44 text-center">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {courses.map((course) => {
              const active = isCourseActive(course)
              const courseIdentifiers = [course.course_code, getDisplayCourseAbbreviation(course.course_name, course.course_abbreviation)].filter(Boolean).join(' · ')

              return (
                <tr key={course.course_id} className="h-24 transition hover:bg-orange-50/30">
                  <td className="px-6 py-4 align-middle">
                    <CourseName name={course.course_name} as="div" className="break-words font-medium leading-5 text-gray-900" secondaryClassName="mt-1 text-sm font-normal leading-5 text-gray-500" />
                    {courseIdentifiers && <p className="mt-1 break-words text-xs text-gray-500">{courseIdentifiers}</p>}
                    {archivedCourseIdentity(course) && <p className="mt-1 break-words text-xs text-amber-800">{archivedCourseLabel(course)}</p>}
                  </td>
                  <td className="px-5 py-4 align-middle">
                    <CourseStatus active={active} draft={Number(course.is_draft) === 1} archived={Boolean(archivedCourseIdentity(course))} />
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
          const courseIdentifiers = [course.course_code, getDisplayCourseAbbreviation(course.course_name, course.course_abbreviation)].filter(Boolean).join(' · ')

          return (
            <article key={course.course_id} className="px-4 py-4 sm:px-5">
              <CourseName name={course.course_name} className="break-words text-sm font-medium leading-5 text-gray-900" secondaryClassName="mt-1 text-sm font-normal text-gray-500" />
              {courseIdentifiers && <p className="mt-1 break-words text-xs text-gray-500">{courseIdentifiers}</p>}
                    {archivedCourseIdentity(course) && <p className="mt-1 break-words text-xs text-amber-800">{archivedCourseLabel(course)}</p>}
              <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Status</p>
                  <CourseStatus active={active} draft={Number(course.is_draft) === 1} archived={Boolean(archivedCourseIdentity(course))} />
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
  const location = useLocation()
  const initialLocation = readCourseListLocation(location.search)
  const adminToken = localStorage.getItem('adminToken')
  const draftSessionKey = newCourseDraftSessionKey(adminToken)
  const [restoredDraft] = useState(() => readNewCourseDraftSession(sessionStorage, draftSessionKey, emptyCourseForm))

  const courseLoadSequence = useRef(0)
  const [editingDraft, setEditingDraft] = useState(Boolean(restoredDraft?.active))
  const [publication, setPublication] = useState(null)
  const [batchOpen, setBatchOpen] = useState(false)
  const [validationManaged, setValidationManaged] = useState(false)
  const [editingCourseActive, setEditingCourseActive] = useState(false)
  const [view, setView] = useState(restoredDraft?.active ? 'form' : 'list')
  const courseList = useWorkflowData(adminToken ? 'admin/courses' : null, adminToken, { interval: view === 'list' ? 10000 : 0 })
  const { loading, error: courseListError, refresh: refreshCourses } = courseList
  const courses = courseList.data?.courses || noCourses
  const draftOptions = courseList.data?.draftOptions || null
  const [editingCourseId, setEditingCourseId] = useState(null)
  const [editingCourseCode, setEditingCourseCode] = useState(null)
  const [courseForm, setCourseForm] = useState(restoredDraft?.active ? restoredDraft.form : emptyCourseForm)
  const [courseFormRevision, setCourseFormRevision] = useState(0)
  const [draftSourceCheckAllowed, setDraftSourceCheckAllowed] = useState(false)
  const [savedDraftEditing, setSavedDraftEditing] = useState(false)
  const courseFormRef = useRef(restoredDraft?.active ? restoredDraft.form : emptyCourseForm)
  const [pendingSources, setPendingSources] = useState(restoredDraft?.active ? restoredDraft.sources : [])
  const [sessionSaveFailed, setSessionSaveFailed] = useState(false)
  const [sourceWorking, setSourceWorking] = useState(false)
  const [sourceEditorOpen, setSourceEditorOpen] = useState(false)
  const setSourcesForCurrentForm = useCallback((update) => setPendingSources((current) => invalidatePendingReviews(typeof update === 'function' ? update(current) : update, courseFormRef.current)), [])
  const updateCourseForm = (update) => {
    const next = typeof update === 'function' ? update(courseFormRef.current) : update
    courseFormRef.current = next
    setCourseFormRevision(current => current + 1)
    setCourseForm(next)
    setPendingSources((current) => invalidatePendingReviews(current, next))
  }
  const [initialCourseForm, setInitialCourseForm] = useState(null)
  const [sourceRefreshKey, setSourceRefreshKey] = useState(0)
  const onSourceUnauthorized = useCallback((response) => handleUnauthorized(response, navigate), [navigate])
  const [canonicalCareers, setCanonicalCareers] = useState([])
  const [catalogReferences, setCatalogReferences] = useState(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [updatingStatusId, setUpdatingStatusId] = useState(null)
  const [pendingStatusCourse, setPendingStatusCourse] = useState(null)
  const [duplicateCheck, setDuplicateCheck] = useState(null)
  const [checkingDuplicate, setCheckingDuplicate] = useState(false)
  const [autoFillOpen, setAutoFillOpen] = useState(false)
  const [autoFillText, setAutoFillText] = useState('')
  const [autoFillFile, setAutoFillFile] = useState(null)
  const [autoFilling, setAutoFilling] = useState(false)
  const [autoFillError, setAutoFillError] = useState('')
  const [autoFillSuccess, setAutoFillSuccess] = useState('')
  const [search, setSearch] = useState(initialLocation.search)
  const [clusterFilter, setClusterFilter] = useState(initialLocation.cluster)
  const [statusFilter, setStatusFilter] = useState(initialLocation.status)
  const [sortBy, setSortBy] = useState(initialLocation.sort)
  const [catalogScope, setCatalogScope] = useState(initialLocation.scope)
  const listFilters = { search, cluster: clusterFilter, status: statusFilter, sort: sortBy, scope: catalogScope }
  const draftsView = statusFilter === 'draft'
  const archivedView = catalogScope === 'archived'
  const catalogCounts = courseCatalogCounts(courses)
  const scopeTotal = courses.filter(course => matchesCatalogScope(course, catalogScope, statusFilter)).length
  const draftCount = courses.filter(course => Number(course.is_draft) === 1).length
  const activeCourseCount = courses.filter(course => Number(course.is_draft) !== 1 && !archivedCourseIdentity(course) && isCourseActive(course)).length
  const inactiveCourseCount = courses.filter(course => Number(course.is_draft) !== 1 && !archivedCourseIdentity(course) && !isCourseActive(course)).length
  const backToList = () => {
    if (!editingCourseId && editingDraft) writeNewCourseDraftSession(sessionStorage, draftSessionKey, courseForm, pendingSources, false)
    navigate(courseListLocation(listFilters))
    setView('list')
  }
  const backToSavedCourse = () => {
    if (saving || sourceWorking || sourceEditorOpen) { setError('Save or cancel the open source edit and wait for any running action before returning to the course.'); return }
    if (JSON.stringify(courseForm) !== JSON.stringify(initialCourseForm) && !window.confirm('Discard unsaved course changes and return to the saved course?')) return
    setCourseForm(initialCourseForm)
    courseFormRef.current = initialCourseForm
    setSavedDraftEditing(false)
    setFieldErrors({})
    setError('')
  }
  const goToCourse = courseId => navigate(courseListLocation(listFilters, { courseId }))
  const goToNewCourse = () => navigate(courseListLocation(listFilters, { add: true }))
  const goToDrafts = () => navigate(courseListLocation({ status: 'draft' }))
  const updateListFilters = updates => navigate(courseListLocation({ ...listFilters, ...updates }), { replace: true })

  useEffect(() => {
    if (view !== 'form' || editingCourseId || !editingDraft) return
    const persist = () => {
      setSessionSaveFailed(!writeNewCourseDraftSession(sessionStorage, draftSessionKey, courseForm, pendingSources, true))
    }
    persist()
    window.addEventListener('pagehide', persist)
    return () => window.removeEventListener('pagehide', persist)
  }, [view, editingCourseId, editingDraft, draftSessionKey, courseForm, pendingSources])

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
        && matchesCourseStatus(course, statusFilter)
        && matchesCatalogScope(course, catalogScope, statusFilter)
      ))
      .sort((first, second) => {
        if (sortBy === 'name-desc') return compareNames(second, first)
        if (sortBy === 'code-asc') return compareCodes(first, second)
        if (sortBy === 'code-desc') return compareCodes(second, first)
        if (sortBy === 'active-first') return Number(isCourseActive(second)) - Number(isCourseActive(first)) || compareNames(first, second)
        if (sortBy === 'inactive-first') return Number(isCourseActive(first)) - Number(isCourseActive(second)) || compareNames(first, second)
        return compareNames(first, second)
      })
  }, [courses, search, clusterFilter, statusFilter, sortBy, catalogScope])

  const groupedCourses = useMemo(() => {
    if (clusterFilter !== 'all') return []

    return Object.entries(visibleCourses.reduce((groups, course) => {
      const cluster = course.cluster_category || 'Uncategorized'
      groups[cluster] = [...(groups[cluster] || []), course]
      return groups
    }, {})).sort(([first], [second]) => first.localeCompare(second))
  }, [visibleCourses, clusterFilter])

  const hasActiveFilters = Boolean(search) || clusterFilter !== 'all' || (statusFilter !== 'all' && !draftsView) || sortBy !== 'name-asc'

  const clearFilters = () => navigate(courseListLocation({ status: draftsView ? 'draft' : 'all', scope: catalogScope }), { replace: true })

  useEffect(() => {
    document.title = 'Manage Courses | LearnMatch Admin'
  }, [])

  useEffect(() => {
    if (courseListError) handleUnauthorized(courseListError, navigate)
  }, [courseListError, navigate])

  const openNewCourseForm = () => {
    const saved = readNewCourseDraftSession(sessionStorage, draftSessionKey, emptyCourseForm)
    setError('')
    setFieldErrors({})
    setInitialCourseForm(null)
    setEditingCourseId(null)
    setDraftSourceCheckAllowed(false)
    setEditingCourseCode(null)
    setEditingDraft(true)
    setPublication(null)
    setSavedDraftEditing(false)
    setCourseForm(saved?.form || emptyCourseForm)
    courseFormRef.current = saved?.form || emptyCourseForm
    setPendingSources(saved?.sources || [createDraftSource()])
    setCanonicalCareers([])
    setCatalogReferences(null)
    setView('form')
  }

  const openEditCourseForm = async (courseId) => {
    const requestSequence = ++courseLoadSequence.current
    setError('')
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/courses/${courseId}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      })
      if (handleUnauthorized(res, navigate)) return
      const data = await res.json()
      if (requestSequence !== courseLoadSequence.current) return
      if (!res.ok) { setError(data.message || 'Could not load course details.'); return }
      setEditingDraft(Number(data.course.is_draft) === 1)
      setEditingCourseActive(isCourseActive(data.course))
      setDraftSourceCheckAllowed(Number(data.course.is_draft) === 1 && Number(data.course.is_active) === 0 && !data.publication)
      setPublication(data.publication || null)
      setValidationManaged(Boolean(data.validationManaged))
      setSavedDraftEditing(false)
      setEditingCourseId(courseId)
      setEditingCourseCode(data.course.course_code)
      const loadedForm = {
        ...draftFormFromCourse(data),
        course_name: data.course.course_name || '',
        cluster_category: data.course.cluster_category || '',
        description: data.course.description || '',
        obtainable_skills: data.course.obtainable_skills || '',
      }
      setCourseForm(loadedForm)
      courseFormRef.current = loadedForm
      setPendingSources([])
      setInitialCourseForm(loadedForm)
      setFieldErrors({})
      setCanonicalCareers(data.canonicalCareers || [])
      setCatalogReferences(data.catalogReferences || null)
      setView('form')
    } catch {
      if (requestSequence !== courseLoadSequence.current) return
      setError('Could not load course details.')
    }
  }

  const locationInitialized = useRef(false)
  const syncCourseLocation = useEffectEvent(() => {
    courseLoadSequence.current++
    const firstVisit = !locationInitialized.current
    locationInitialized.current = true
    const route = readCourseListLocation(location.search)
    setSearch(route.search)
    setClusterFilter(route.cluster)
    setStatusFilter(route.status)
    setSortBy(route.sort)
    setCatalogScope(route.scope)
    if (route.courseId) {
      if (view !== 'form' || editingCourseId !== route.courseId) openEditCourseForm(route.courseId)
    } else if (route.add) {
      if (view !== 'form' || editingCourseId) openNewCourseForm()
    } else if (firstVisit && restoredDraft?.active && view === 'form' && !editingCourseId && !location.search) {
      // Keep existing refresh recovery, then give the recovered form a Back/Forward location.
      navigate(courseListLocation({}, { add: true }), { replace: true })
    } else {
      if (!editingCourseId && editingDraft && view === 'form') writeNewCourseDraftSession(sessionStorage, draftSessionKey, courseForm, pendingSources, false)
      setView('list')
    }
  })
  // Synchronize this screen with external router navigation, including browser Back/Forward.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { syncCourseLocation() }, [location.key, location.search])

  const handleCourseFormChange = (e) => {
    const { name, value } = e.target
    updateCourseForm({ ...courseForm, [name]: value })
    setFieldErrors((current) => ({ ...current, [name]: undefined }))
  }

  const duplicateCheckName = String(courseForm.course_name || '').trim()
  const duplicateCheckAbbr = String(courseForm.course_abbreviation || '').trim()
  const shouldCheckDuplicate = view === 'form' && !publication && Boolean(adminToken)
    && (duplicateCheckName.length >= 2 || duplicateCheckAbbr.length >= 2)
  const activeDuplicateCheck = shouldCheckDuplicate ? duplicateCheck : null
  const isCheckingDuplicate = shouldCheckDuplicate && checkingDuplicate

  useEffect(() => {
    if (!shouldCheckDuplicate) return undefined
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setCheckingDuplicate(true)
      try {
        const params = new URLSearchParams()
        if (duplicateCheckName) params.set('name', duplicateCheckName)
        if (duplicateCheckAbbr) params.set('abbreviation', duplicateCheckAbbr)
        if (editingCourseId) params.set('excludeCourseId', String(editingCourseId))
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/courses/check-duplicate?${params}`, {
          headers: { Authorization: `Bearer ${adminToken}` },
          signal: controller.signal,
        })
        if (!response.ok) return
        const data = await response.json()
        if (!controller.signal.aborted) setDuplicateCheck(data)
      } catch {
        // Non-blocking real-time check; backend still enforces on save.
      } finally {
        if (!controller.signal.aborted) setCheckingDuplicate(false)
      }
    }, 350)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [adminToken, duplicateCheckAbbr, duplicateCheckName, editingCourseId, shouldCheckDuplicate])

  const handleAutoFillFileSelect = (event) => {
    const file = event.target.files?.[0]
    setAutoFillError('')
    if (!file) return
    const allowed = ['application/pdf', 'text/plain', 'text/markdown', 'text/csv']
    const extAllowed = /\.(pdf|txt|md)$/i.test(file.name)
    if (!allowed.includes(file.type) && !extAllowed) {
      setAutoFillError('Upload a PDF or plain text (.txt) file.')
      event.target.value = ''
      return
    }
    if (file.size > 20 * 1024 * 1024) {
      setAutoFillError('Source file must be 20 MB or smaller.')
      event.target.value = ''
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setAutoFillFile({
        fileName: file.name,
        mimeType: file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'text/plain'),
        base64: String(reader.result || '').split(',')[1] || '',
      })
    }
    reader.onerror = () => setAutoFillError('Could not read the selected file.')
    reader.readAsDataURL(file)
  }

  const handleAutoFillExtract = async () => {
    setAutoFillError('')
    setAutoFillSuccess('')
    if (!autoFillText.trim() && !autoFillFile) {
      setAutoFillError('Paste course reference text or upload a PDF/text file first.')
      return
    }
    setAutoFilling(true)
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/courses/auto-fill`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          sourceText: autoFillText.trim() || undefined,
          file: autoFillFile || undefined,
        }),
      })
      if (handleUnauthorized(response, navigate)) return
      const data = await response.json().catch(() => ({}))
      if (!response.ok || !data.extracted) {
        setAutoFillError(data.message || 'Could not extract course fields from the provided source.')
        return
      }
      const ex = data.extracted
      updateCourseForm((current) => ({
        ...current,
        course_name: ex.course_name || current.course_name,
        course_abbreviation: ex.course_abbreviation || current.course_abbreviation,
        cluster_category: ex.cluster_category || current.cluster_category,
        description: ex.description || current.description,
        obtainable_skills: ex.obtainable_skills || current.obtainable_skills,
        program_duration_years: ex.program_duration_years || current.program_duration_years,
        year_levels: Array.isArray(ex.year_levels) && ex.year_levels.length ? ex.year_levels : current.year_levels,
        career_opportunities: Array.isArray(ex.career_opportunities) && ex.career_opportunities.length
          ? ex.career_opportunities.map((career) => ({
              client_id: crypto.randomUUID(),
              job_title: career.job_title || '',
              salary_range: career.salary_range || '',
              description: career.description || '',
            }))
          : current.career_opportunities,
      }))
      if (data.duplicateCheck) setDuplicateCheck(data.duplicateCheck)
      setFieldErrors({})
      setAutoFillSuccess(
        `Course fields auto-filled (${data.extractionMethod === 'ai_assisted' ? 'AI-assisted' : 'structured parser'}). Review and edit any field below before saving as a draft for Validator approval.`
      )
    } catch {
      setAutoFillError('Cannot connect to server. Please try again.')
    } finally {
      setAutoFilling(false)
    }
  }

  const handleSaveCourse = async (e) => {
    e.preventDefault()
    if (publication || saving || sourceWorking) return
    if (sourceEditorOpen) { setError('Save or cancel the open source edit before saving draft changes.'); return }
    setError('')

    if (activeDuplicateCheck?.hasExactDuplicate) {
      const match = activeDuplicateCheck.exactMatches[0]
      setFieldErrors((current) => ({
        ...current,
        course_name: `Duplicate course detected: "${match.course_name}" already exists (${match.status}).`,
      }))
      setError(`Duplicate course detected: "${match.course_name}" already exists (${match.status}). Review the existing record or enter a distinct specialization/major name.`)
      scrollToFirstInvalidField(['course_name'])
      return
    }

    const draft = buildDraftPayload(courseForm, !editingCourseId || editingDraft, initialCourseForm)
    const nextErrors = { ...draft.errors }
    if (Object.hasOwn(draft.payload, 'career_opportunities') && (draft.payload.career_opportunities.length || initialCourseForm?.career_opportunities?.length) && !draftOptions?.career_opportunities_supported) nextErrors.career_opportunities = 'Career saving is not available on the connected server yet. Reload after the server is updated. Your inputs are kept.'
    const sourcesToSave = enteredDraftSources(pendingSources)
    if (sourcesToSave.some((source) => Object.keys(validateApprovedCourseSource(source, draftOptions?.source_url_policy).errors).length)) nextErrors.source_details = 'Correct each source URL, title and supported information before saving.'
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
        body: JSON.stringify({ ...draft.payload, ...(!editingCourseId ? { sources: sourcesToSave.map(({ title, url, notes, supported_fields, check_receipt, confirmation_receipt }) => ({ title, url, notes, supported_fields, check_receipt, confirmation_receipt })) } : {}) }),
      })

      const data = await res.json()

      if (handleUnauthorized(res, navigate)) {
        setSaving(false)
        return
      }

      if (!res.ok) {
        const details = data.reasons?.map((reason) => reason.message).join(' ') || data.duplicates?.map((course) => `${course.course_code || 'No code'}: ${course.course_name}`).join('; ')
        setError([data.message || 'Something went wrong.', details].filter(Boolean).join(' '))
        setSaving(false)
        return
      }

      setSaveSuccess(!editingCourseId ? 'Draft saved successfully' : editingDraft ? 'Draft changes saved successfully' : 'Course updated successfully')
      await waitForSuccessConfirmation()

      if (!editingCourseId) {
        clearNewCourseDraftSession(sessionStorage, draftSessionKey)
        setEditingCourseId(data.courseId)
        if (editingDraft) setDraftSourceCheckAllowed(true)
      }
      setEditingCourseCode(data.course_code)
      setInitialCourseForm(courseForm)
      setPendingSources([])
      setSourceRefreshKey((current) => current + 1)
      await openEditCourseForm(data.courseId || editingCourseId)
      navigate(courseListLocation(listFilters, { courseId: data.courseId || editingCourseId }), { replace: true })
      refreshCourses()
      setSaving(false)
    } catch {
      setError('Cannot connect to server.')
      setSaving(false)
    } finally {
      setSaveSuccess('')
    }
  }

  const executeStatusChange = async (course) => {
    const nextStatus = !isCourseActive(course)

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
      setPendingStatusCourse(null)
      refreshCourses()
    } catch {
      setError('Could not update course status.')
    } finally {
      setUpdatingStatusId(null)
    }
  }

  const handleStatusChange = (course) => {
    setError('')
    setPendingStatusCourse(course)
  }

  if (saveSuccess) return <div className="min-h-screen bg-orange-50/40">
    <AdminHeader currentPage="courses" />
    <main className="flex min-h-[70vh] items-center justify-center px-5 py-10">
      <div><SuccessConfirmation message={saveSuccess} />{editingDraft && <p className="mt-4 text-center text-sm text-gray-600">Saved as an inactive draft. Publication is a separate step.</p>}</div>
    </main>
  </div>

  if (view === 'list') {
    return (
      <div className="min-h-screen bg-orange-50/40">
        <AdminHeader currentPage="courses" />

        <main className="max-w-6xl mx-auto px-5 sm:px-8 py-10 sm:py-12">
          {!draftsView && <button type="button" onClick={() => navigate('/admin')} className="lm-action mb-6">
            ← Back to Dashboard
          </button>}
          {draftsView && <button type="button" onClick={() => navigate(courseListLocation())} className="lm-action mb-6"><IconArrowLeft className="mr-1 inline" size={16} /> Back to Courses</button>}
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-1">{draftsView ? 'Saved Drafts' : archivedView ? 'Archived Course Identities' : 'Manage Courses'}</h1>
              <p className="text-sm text-gray-500">{draftsView ? 'Saved drafts stay inactive until explicitly reviewed and published. Select View to reopen a draft.' : archivedView ? 'Excluded legacy identities are retained for historical references. They are not independent student-facing programs.' : 'Manage independent courses and published additions. Saved drafts and archived identities are listed separately.'}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={draftsView ? () => navigate(courseListLocation()) : goToDrafts} className="inline-flex items-center gap-2 rounded-xl border border-orange-200 bg-white px-4 py-2.5 text-sm font-medium text-orange-700 hover:bg-orange-50 focus:outline-none focus:ring-2 focus:ring-orange-500">
              {draftsView ? 'All Courses' : `View Drafts (${draftCount})`}
            </button>
            <button
              type="button"
              onClick={goToNewCourse}
              className="inline-flex items-center gap-2 bg-orange-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-orange-600 transition"
            >
              <IconPlus size={16} stroke={2} /> Add Course
            </button>
            </div>
          </div>

          {(error || courseListError) && (
            <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl text-sm mb-6" role="alert">
              {error || courseListError.message}
            </div>
          )}

          {!draftsView && !archivedView && <div className="mb-5 space-y-3">
            <button type="button" className="lm-action" aria-expanded={batchOpen} onClick={() => setBatchOpen(open => !open)}>{batchOpen ? 'Close cluster validation' : 'Validate a cluster'}</button>
            {batchOpen && <CourseValidationPanel token={adminToken} clusters={clusterOptions} />}
          </div>}
          <SkeletonContent loading={loading} label="Loading courses...">
            <>
              <div className="bg-white border border-orange-100 rounded-2xl p-4 sm:p-5 shadow-sm mb-5">
                <div className="flex flex-col lg:flex-row gap-3">
                  <div className="relative flex-1 min-w-0">
                    <IconSearch size={18} stroke={1.75} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    <input
                      type="text"
                      role="searchbox"
                      enterKeyHint="search"
                      value={search}
                      onChange={(event) => updateListFilters({ search: event.target.value })}
                      placeholder="Search courses..."
                      aria-label="Search courses by name, abbreviation, or code"
                      className="w-full border border-gray-200 rounded-xl pl-10 pr-10 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                    {search && (
                      <button
                        type="button"
                        onClick={() => updateListFilters({ search: '' })}
                        aria-label="Clear course search"
                        className="absolute right-1 top-1/2 -translate-y-1/2 w-10 h-10 inline-flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-500"
                      >
                        <IconX size={17} stroke={1.75} />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 lg:w-[680px]">
                    <select value={catalogScope} onChange={event => updateListFilters({ scope: event.target.value, status: 'all' })} aria-label="Filter course records" className="w-full bg-white border border-gray-200 rounded-xl px-3 py-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-500">
                      <option value="current">Current courses</option>
                      <option value="archived">Archived identities</option>
                      <option value="all">All stored records</option>
                    </select>
                    <select
                      value={clusterFilter}
                      onChange={(event) => updateListFilters({ cluster: event.target.value })}
                      aria-label="Filter by cluster"
                      className="w-full bg-white border border-gray-200 rounded-xl px-3 py-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    >
                      <option value="all">All Clusters</option>
                      {availableClusterOptions.map((cluster) => <option key={cluster} value={cluster}>{cluster}</option>)}
                    </select>
                    <select
                      value={statusFilter}
                      onChange={(event) => updateListFilters({ status: event.target.value })}
                      aria-label="Filter by status"
                      className="w-full bg-white border border-gray-200 rounded-xl px-3 py-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    >
                      <option value="all">All Status</option>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="draft">Drafts only</option>
                    </select>
                    <select
                      value={sortBy}
                      onChange={(event) => updateListFilters({ sort: event.target.value })}
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
                    {draftsView ? `${visibleCourses.length} of ${draftCount} saved drafts` : `${visibleCourses.length} of ${scopeTotal} ${archivedView ? 'archived identities' : catalogScope === 'all' ? 'stored records' : 'current courses'}`}
                  </p>
                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="lm-action"
                    >
                      Clear filters
                    </button>
                  )}
                </div>
              </div>

              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-gray-600">{catalogCounts.original} original independent programs - {catalogCounts.published} published additions - {catalogCounts.drafts} saved drafts</p>
                {!archivedView && (
                  <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => updateListFilters({ scope: 'current', status: statusFilter === 'active' ? 'all' : 'active' })}
                      aria-pressed={statusFilter === 'active'}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 transition ${
                        statusFilter === 'active'
                          ? 'border-emerald-500 bg-emerald-100 text-emerald-900 ring-2 ring-emerald-200'
                          : 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                      }`}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      Active: {activeCourseCount}
                    </button>
                    <button
                      type="button"
                      onClick={() => updateListFilters({ scope: 'current', status: statusFilter === 'inactive' ? 'all' : 'inactive' })}
                      aria-pressed={statusFilter === 'inactive'}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 transition ${
                        statusFilter === 'inactive'
                          ? 'border-slate-500 bg-slate-200 text-slate-900 ring-2 ring-slate-200'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                      Inactive: {inactiveCourseCount}
                    </button>
                    <button
                      type="button"
                      onClick={() => updateListFilters({ scope: 'current', status: statusFilter === 'draft' ? 'all' : 'draft' })}
                      aria-pressed={statusFilter === 'draft'}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 transition ${
                        statusFilter === 'draft'
                          ? 'border-orange-500 bg-orange-100 text-orange-900 ring-2 ring-orange-200'
                          : 'border-orange-200 bg-orange-50 text-orange-800 hover:bg-orange-100'
                      }`}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                      Drafts: {draftCount}
                    </button>
                  </div>
                )}
              </div>
              {!loading && visibleCourses.length === 0 ? (
                <div className="bg-white border border-orange-100 rounded-2xl p-10 text-center shadow-sm">
                  <h2 className="text-lg font-semibold text-gray-900">{draftsView ? 'No saved drafts found.' : 'No courses found.'}</h2>
                  <p className="text-sm text-gray-500 mt-2">{draftsView ? 'Use Add Course and Save Draft to create a saved draft, or adjust your filters.' : 'Try changing your search or filters.'}</p>
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="lm-action mt-5"
                  >
                    Clear filters
                  </button>
                </div>
              ) : loading ? (<CourseTable courses={recommendationPlaceholders} />) : clusterFilter === 'all' ? (
                <div className="space-y-8">
                  {groupedCourses.map(([cluster, clusterCourses]) => (
                    <section key={cluster} aria-labelledby={`cluster-${cluster}`}>
                      <div className="mb-3 flex items-start justify-between gap-4 px-1 sm:items-baseline">
                        <h2 id={`cluster-${cluster}`} className="min-w-0 break-words text-base font-semibold text-gray-900">{cluster}</h2>
                        <p className="text-xs text-gray-500 shrink-0">{clusterCourses.length} {clusterCourses.length === 1 ? 'course' : 'courses'}</p>
                      </div>
                      <CourseTable
                        courses={clusterCourses}
                        openEditCourseForm={goToCourse}
                        handleStatusChange={handleStatusChange}
                        updatingStatusId={updatingStatusId}
                      />
                    </section>
                  ))}
                </div>
              ) : (
                <CourseTable
                  courses={loading ? recommendationPlaceholders : visibleCourses}
                  openEditCourseForm={goToCourse}
                  handleStatusChange={handleStatusChange}
                  updatingStatusId={updatingStatusId}
                />
              )}
            </>
          </SkeletonContent>
        </main>

        {pendingStatusCourse && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-xs"
            role="dialog"
            aria-modal="true"
            aria-labelledby="course-status-modal-title"
            onClick={() => { if (!updatingStatusId) setPendingStatusCourse(null) }}
          >
            <div
              className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3">
                <h2 id="course-status-modal-title" className="text-lg font-bold text-slate-950">
                  {isCourseActive(pendingStatusCourse) ? 'Deactivate Course?' : 'Reactivate Course?'}
                </h2>
                <button
                  type="button"
                  disabled={Boolean(updatingStatusId)}
                  onClick={() => setPendingStatusCourse(null)}
                  aria-label="Close confirmation"
                  className="rounded-lg p-1 text-slate-400 hover:bg-stone-100 hover:text-slate-600"
                >
                  <IconX size={18} />
                </button>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                {isCourseActive(pendingStatusCourse) ? (
                  <>
                    Deactivating <strong className="text-slate-900">{pendingStatusCourse.course_name}</strong> will hide it from public course discovery and new recommendations. Existing student recommendations and active college tracking records will remain safely preserved.
                  </>
                ) : (
                  <>
                    Reactivating <strong className="text-slate-900">{pendingStatusCourse.course_name}</strong> will make it visible again in public course discovery and eligible for new student recommendations.
                  </>
                )}
              </p>
              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  disabled={Boolean(updatingStatusId)}
                  onClick={() => setPendingStatusCourse(null)}
                  className="rounded-xl border border-stone-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-stone-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={Boolean(updatingStatusId)}
                  onClick={() => executeStatusChange(pendingStatusCourse)}
                  className={`rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${
                    isCourseActive(pendingStatusCourse)
                      ? 'bg-red-600 hover:bg-red-700'
                      : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  {updatingStatusId === pendingStatusCourse.course_id
                    ? 'Updating...'
                    : isCourseActive(pendingStatusCourse)
                      ? 'Yes, Deactivate'
                      : 'Yes, Reactivate'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  if (editingCourseId && !savedDraftEditing) return <div className="min-h-screen bg-orange-50/40">
    <AdminHeader currentPage="courses" />
    <main className="mx-auto w-full max-w-6xl space-y-5 px-5 py-10 sm:px-8">
      <button type="button" onClick={backToList} className="lm-action"><IconArrowLeft size={16} /> {draftsView ? 'Back to Drafts' : 'Back to Courses'}</button>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <SavedDraftCourseView form={courseForm} courseCode={editingCourseCode} publication={publication} catalog={!editingDraft && !publication} active={editingCourseActive} validationManaged={validationManaged} canonicalCareers={canonicalCareers} identityNotice={archivedCourseLabel(courses.find(course => Number(course.course_id) === Number(editingCourseId)) || {})} onEdit={() => setSavedDraftEditing(true)} onReview={() => {
        document.getElementById('saved-publication')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        document.querySelector('#saved-publication button')?.focus({ preventScroll: true })
      }}>
        {editingDraft && !publication && <DraftCourseSources readOnly key={`${editingCourseId}-${sourceRefreshKey}`} courseId={editingCourseId} adminToken={adminToken} sourceUrlPolicy={draftOptions?.source_url_policy} courseDirty={false} refreshKey={sourceRefreshKey} onUnauthorized={onSourceUnauthorized} />}
        {!editingDraft && !publication && <CatalogCourseSources catalogReferences={catalogReferences} />}
      </SavedDraftCourseView>
      {(editingDraft || editingCourseActive) && <div id="course-validation"><CourseValidationPanel key={`validation-${editingCourseId}-${sourceRefreshKey}`} token={adminToken} courseId={editingCourseId} onOpenCourse={goToCourse} /></div>}
      {editingDraft && !publication && <div id="saved-publication"><CoursePublicationPanel key={`${editingCourseId}-${sourceRefreshKey}`} courseId={editingCourseId} adminToken={adminToken} courseDirty={false} onUnauthorized={onSourceUnauthorized} onPublished={async (result) => { if (Number(result.course_id) !== Number(editingCourseId)) goToCourse(result.course_id); else await openEditCourseForm(editingCourseId); refreshCourses() }} /></div>}
    </main>
  </div>

  return (
    <div className="min-h-screen bg-orange-50/40">
      <AdminHeader currentPage="courses" />

      <main className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8 sm:py-12">
        <button
          type="button"
          onClick={editingCourseId ? backToSavedCourse : backToList}
          className="lm-action mb-6"
        >
          <IconArrowLeft size={16} stroke={2} /> {editingCourseId ? 'Back to Course' : draftsView ? 'Back to Drafts' : 'Back to Courses'}
        </button>
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          {publication ? 'Published Course' : draftSourceCheckAllowed && editingCourseId ? 'Edit Draft' : editingCourseId ? 'Edit Course' : 'Add Draft Course'}
        </h1>

        {editingCourseId && <p className="mb-5 text-sm text-gray-600">Stable course code: {editingCourseCode || 'Not assigned (legacy record)'}</p>}
        {publication && <p className="mb-5 text-sm text-gray-600">Published by {publication.publisher_label} on {new Date(publication.published_at).toLocaleString('en-US')}. Published new courses are read-only here.</p>}

        {error && (
          <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl text-sm mb-6" role="alert">
            {error}
          </div>
        )}

        {editingDraft && <p className="mb-5 text-sm text-gray-600">{editingCourseId ? "Draft courses stay inactive and unavailable to students. Matching weights must be entered by an administrator." : "Draft courses stay inactive and unavailable to students."}</p>}
        {editingDraft && !editingCourseId && <p className={`mb-5 text-sm ${sessionSaveFailed ? 'text-amber-800' : 'text-gray-600'}`} role={sessionSaveFailed ? 'alert' : undefined}>{sessionSaveFailed ? 'Browser recovery is unavailable. Save Draft before refreshing to avoid losing your inputs.' : 'Unsaved inputs are kept in this browser tab across refreshes. Use Save Draft to save them to LearnMatch.'}</p>}
        {savedDraftEditing && editingDraft && <p className="mb-5 text-sm text-gray-600">Editing a saved draft. Save Draft Changes returns to the read-only view; publication is a separate action.</p>}

        {editingDraft && !editingCourseId && !publication && (
          <section className="mb-6 rounded-2xl border border-orange-200/90 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
                  <IconSparkles size={19} stroke={1.8} aria-hidden="true" />
                </span>
                <div>
                  <h2 className="text-sm font-bold text-gray-900">Auto-Fill from Source</h2>
                  <p className="mt-0.5 text-xs text-gray-500">
                    Paste a CHED PSG/syllabus overview or upload a text/PDF reference to auto-populate editable draft fields. All drafts still go through Course Validator approval.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAutoFillOpen((open) => !open)}
                aria-expanded={autoFillOpen}
                className="inline-flex items-center gap-1.5 rounded-xl border border-orange-200 bg-orange-50 px-3.5 py-2 text-xs font-semibold text-orange-800 hover:bg-orange-100"
              >
                <IconSparkles size={15} aria-hidden="true" />
                {autoFillOpen ? 'Hide Auto-Fill' : 'Open Auto-Fill'}
              </button>
            </div>
            {autoFillOpen && (
              <div className="mt-4 space-y-3 border-t border-orange-100 pt-4">
                <label className="block text-xs font-semibold text-gray-700">
                  Paste course reference text (syllabus, CHED PSG, curriculum overview, or prospectus)
                  <textarea
                    rows={5}
                    value={autoFillText}
                    onChange={(event) => setAutoFillText(event.target.value)}
                    placeholder="Program Name: Bachelor of Science in ...&#10;Description: ...&#10;Core Competencies: ...&#10;Career Opportunities: ..."
                    className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm font-normal text-gray-900 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                  />
                </label>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-stone-300 bg-stone-50 px-3.5 py-2 text-xs font-semibold text-stone-700 hover:border-orange-300 hover:bg-orange-50/50 hover:text-orange-700">
                      <IconFileUpload size={15} aria-hidden="true" />
                      {autoFillFile ? autoFillFile.fileName : 'Upload PDF or .txt (optional, max 20 MB)'}
                      <input
                        type="file"
                        accept=".pdf,.txt,.md,application/pdf,text/plain"
                        onChange={handleAutoFillFileSelect}
                        className="sr-only"
                      />
                    </label>
                    {autoFillFile && (
                      <button
                        type="button"
                        onClick={() => setAutoFillFile(null)}
                        aria-label="Remove uploaded source file"
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                      >
                        <IconX size={15} />
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    disabled={autoFilling}
                    onClick={handleAutoFillExtract}
                    className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-xs font-semibold text-white shadow-xs transition hover:bg-orange-600 disabled:opacity-50"
                  >
                    <IconSparkles size={15} aria-hidden="true" />
                    {autoFilling ? 'Extracting fields…' : 'Extract & Auto-Fill Form'}
                  </button>
                </div>
                {autoFillError && (
                  <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2 text-xs text-red-700">
                    {autoFillError}
                  </p>
                )}
                {autoFillSuccess && (
                  <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-medium text-emerald-800">
                    {autoFillSuccess}
                  </p>
                )}
              </div>
            )}
          </section>
        )}

        <form onSubmit={handleSaveCourse} noValidate className="space-y-5 mb-8 bg-white border border-orange-100 rounded-2xl p-5 sm:p-7 shadow-sm">
          {editingDraft && <p className="text-xs text-gray-600"><RequiredMark /> Required to save. Fields marked “Required to publish” may remain incomplete in a draft, but must be completed before publication. Notes and automated source checks are optional.</p>}
          <fieldset disabled={Boolean(publication) || saving} className="min-w-0 space-y-5">
          <DraftDisclosure title="Course Details" defaultOpen hasError={['course_name', 'cluster_category', 'program_duration_years'].some(key => Boolean(fieldErrors[key]))}>
          {!editingCourseId && <div className="mb-4 space-y-2"><p className="text-sm text-gray-600">Enter the official program identity, source-supported description, skills and year structure.</p><DraftGuidance><p>Use the full official name, including specialization or major when applicable, and a recognized abbreviation. Choose the appropriate existing LearnMatch cluster.</p><p>Use source-supported information for the description and skills. Separate obtainable skills with commas; these are not matching weights.</p><p>Choose the expected source-stated duration in whole years (1-5), keep year levels in order, and describe their subjects or activities. Abbreviation, description, skills and year overviews are required before publication.</p></DraftGuidance></div>}
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div data-validation-field="course_name">
            <label htmlFor={!editingCourseId ? "draft-course-name" : undefined} className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wide">
              Course Name <RequiredMark />
            </label>
            <input
              type="text"
              name="course_name"
              id={!editingCourseId ? "draft-course-name" : undefined}
              placeholder={!editingCourseId ? "Ex. Bachelor of Science in Business Administration, Major in Marketing Management" : undefined}
              value={courseForm.course_name}
              onChange={handleCourseFormChange}
              className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
              required
              aria-required="true" aria-invalid={fieldErrors.course_name ? 'true' : undefined} aria-describedby={[!editingCourseId && "draft-course-name-help", fieldErrors.course_name && "course-name-error"].filter(Boolean).join(" ") || undefined}
            />
            {!editingCourseId && <p id="draft-course-name-help" className="sr-only">Enter the full official program name from your reference, including the specialization or major when applicable.</p>}
            <FieldError id="course-name-error">{fieldErrors.course_name}</FieldError>
            {isCheckingDuplicate && (
              <p className="mt-1.5 text-xs text-gray-400">Checking for duplicate courses…</p>
            )}
            {!isCheckingDuplicate && activeDuplicateCheck?.hasExactDuplicate && (
              <div role="alert" className="mt-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                <p className="flex items-center gap-1.5 font-bold">
                  <IconAlertTriangle size={15} className="shrink-0" aria-hidden="true" />
                  Duplicate course detected — submission blocked
                </p>
                <ul className="mt-1.5 space-y-1">
                  {activeDuplicateCheck.exactMatches.map((match) => (
                    <li key={match.course_id} className="flex flex-wrap items-center justify-between gap-2">
                      <span>
                        <strong>{match.course_name}</strong>
                        {match.course_abbreviation ? ` (${match.course_abbreviation})` : ''} ·{' '}
                        <span className="rounded bg-white px-1.5 py-0.5 font-semibold text-red-700">{match.status}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => goToCourse(match.course_id)}
                        className="font-semibold underline hover:text-red-950"
                      >
                        View existing →
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {!isCheckingDuplicate && !activeDuplicateCheck?.hasExactDuplicate && activeDuplicateCheck?.hasSimilarMatch && (
              <div role="status" className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                <p className="flex items-center gap-1.5 font-bold">
                  <IconAlertTriangle size={15} className="shrink-0" aria-hidden="true" />
                  Similar existing course{activeDuplicateCheck.similarMatches.length > 1 ? 's' : ''} found
                </p>
                <ul className="mt-1.5 space-y-1">
                  {activeDuplicateCheck.similarMatches.map((match) => (
                    <li key={match.course_id} className="flex flex-wrap items-center justify-between gap-2">
                      <span>
                        <strong>{match.course_name}</strong>
                        {match.course_abbreviation ? ` (${match.course_abbreviation})` : ''} ·{' '}
                        <span className="rounded bg-white px-1.5 py-0.5 font-semibold text-amber-800">{match.status}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => goToCourse(match.course_id)}
                        className="font-semibold underline hover:text-amber-950"
                      >
                        Review →
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div data-validation-field="cluster_category">
            <label htmlFor={!editingCourseId ? "draft-cluster" : undefined} className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wide">
              Cluster Category <RequiredMark />
            </label>
            <select
              name="cluster_category"
              id={!editingCourseId ? "draft-cluster" : undefined}
              value={courseForm.cluster_category}
              onChange={handleCourseFormChange}
              className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
              required
              aria-required="true" aria-invalid={fieldErrors.cluster_category ? 'true' : undefined} aria-describedby={[!editingCourseId && "draft-cluster-help", fieldErrors.cluster_category && "cluster-category-error"].filter(Boolean).join(" ") || undefined}
            >
              <option value="" disabled>Select a cluster</option>
              {clusterOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            {!editingCourseId && <p id="draft-cluster-help" className="sr-only">Choose the existing LearnMatch cluster that best fits the program's subject area.</p>}
            <FieldError id="cluster-category-error">{fieldErrors.cluster_category}</FieldError>
            {editingCourseId && (
              <p className="mt-2 text-xs leading-5 text-amber-700">
                Changing the cluster affects future recommendation behavior. Review the course matching profile after reclustering.
              </p>
            )}
          </div>

          <div>
            <label htmlFor={!editingCourseId ? "draft-description" : undefined} className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wide">
              Description {editingDraft && <PublicationRequiredMark />}
            </label>
            <textarea
              name="description"
              id={!editingCourseId ? "draft-description" : undefined}
              aria-describedby={!editingCourseId ? "draft-description-help" : undefined}
              placeholder={!editingCourseId ? "Ex. The program focuses on biological systems through lectures and laboratory study." : undefined}
              value={courseForm.description}
              onChange={handleCourseFormChange}
              rows={4}
              className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
            />
            {!editingCourseId && <p id="draft-description-help" className="sr-only">Explain the program's focus using information supported by your sources.</p>}
          </div>

          <div>
            <label htmlFor={!editingCourseId ? "draft-obtainable-skills" : undefined} className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wide">
              Obtainable Skills {editingDraft && <PublicationRequiredMark />}
            </label>
            <textarea
              name="obtainable_skills"
              id={!editingCourseId ? "draft-obtainable-skills" : undefined}
              aria-describedby={!editingCourseId ? "draft-skills-help" : undefined}
              value={courseForm.obtainable_skills}
              onChange={handleCourseFormChange}
              rows={3}
              placeholder={!editingCourseId ? "Ex. Data analysis, Technical writing, Laboratory techniques" : "Separate each skill with a comma, e.g. Programming, Database Design, Project Management"}
              className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
            />
            {!editingCourseId && <p id="draft-skills-help" className="sr-only">List skills students may develop, separated by commas. Use source-supported skills, not matching weights.</p>}
          </div>

          </div>
          <div className="mt-5"><CourseDraftFields part="details" showGuidance={!editingCourseId || draftSourceCheckAllowed} showRequirements={editingDraft} form={courseForm} setForm={updateCourseForm} options={draftOptions} errors={fieldErrors} /></div>
          </DraftDisclosure>
          <CourseDraftFields part="profiles" collapsible showGuidance={!editingCourseId || draftSourceCheckAllowed} showRequirements={editingDraft} form={courseForm} setForm={updateCourseForm} options={draftOptions} errors={fieldErrors} />

          {editingDraft && (!editingCourseId || draftSourceCheckAllowed) && <DraftCareerFields form={courseForm} setForm={updateCourseForm} error={fieldErrors.career_opportunities} />}

          {editingDraft && editingCourseId && !publication && <DraftCourseSources key={editingCourseId} courseId={editingCourseId} adminToken={adminToken} sourceUrlPolicy={draftOptions?.source_url_policy} courseDirty={JSON.stringify(courseForm) !== JSON.stringify(initialCourseForm)} refreshKey={sourceRefreshKey} onUnauthorized={onSourceUnauthorized} form={courseForm} formRevision={courseFormRevision} allowChecking={draftSourceCheckAllowed} onWorkingChange={setSourceWorking} onEditorChange={setSourceEditorOpen} />}

          {editingDraft && !editingCourseId && <SourceFirstDraftSources sources={pendingSources} setSources={setSourcesForCurrentForm} form={courseForm} sourceUrlPolicy={draftOptions?.source_url_policy} adminToken={adminToken} onUnauthorized={onSourceUnauthorized} saveError={fieldErrors.source_details} saving={saving} onWorkingChange={setSourceWorking} />}

          {!publication && <button
            type="submit"
            disabled={saving || sourceWorking || sourceEditorOpen || hasInvalidSourceUrls(pendingSources, draftOptions?.source_url_policy)}
            className="bg-orange-500 text-white px-6 py-3 rounded-xl font-medium hover:bg-orange-600 transition text-sm disabled:opacity-50"
          >
            {saving ? 'Saving...' : savedDraftEditing && editingDraft ? 'Save Draft Changes' : editingCourseId ? 'Save Changes' : 'Save Draft'}
          </button>}
          {savedDraftEditing && <button type="button" disabled={saving || sourceWorking || sourceEditorOpen} className="ml-3 rounded-lg border border-gray-200 px-4 py-3 text-sm" onClick={() => { setCourseForm(initialCourseForm); courseFormRef.current = initialCourseForm; setSavedDraftEditing(false); setFieldErrors({}); setError('') }}>{JSON.stringify(courseForm) === JSON.stringify(initialCourseForm) ? 'Done Editing' : 'Discard unsaved course changes'}</button>}
          </fieldset>
        </form>

        {editingDraft && editingCourseId && !draftSourceCheckAllowed && <CoursePublicationPanel key={`${editingCourseId}-${sourceRefreshKey}`} courseId={editingCourseId} adminToken={adminToken} courseDirty={JSON.stringify(courseForm) !== JSON.stringify(initialCourseForm)} onUnauthorized={onSourceUnauthorized} onPublished={async (result) => { if (Number(result.course_id) !== Number(editingCourseId)) goToCourse(result.course_id); else await openEditCourseForm(editingCourseId); refreshCourses() }} />}


        {editingCourseId && !draftSourceCheckAllowed && (
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
                      <p className="mt-1 text-xs font-medium text-orange-600">
                        {career.estimated_monthly_salary_php.display}{' '}
                        <span className="ml-1 rounded bg-orange-50 px-1.5 py-0.5 text-[10px] font-semibold text-orange-800">
                          Est. 2025-2026
                        </span>
                      </p>
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
