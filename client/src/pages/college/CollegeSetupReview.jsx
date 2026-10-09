import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { IconArrowRight, IconCalendarEvent, IconCircleCheck, IconSchool } from '@tabler/icons-react'
import CourseName from '../../components/CourseName'
import { ACADEMIC_CALENDARS } from '../../constants/academicCalendars'
import { createCollegePhaseConfirmer, getCollegeSetupEditNavigation, getCollegeSetupScheduleReview } from '../../utils/collegeSetupReview'
import SuccessConfirmation from '../../components/SuccessConfirmation'
import { waitForSuccessConfirmation } from '../../utils/successConfirmation'

export function CollegeSetupReviewContent({ draft, onEdit, onConfirm, submitting = false, success = false, error = '' }) {
  const schedule = getCollegeSetupScheduleReview(draft)
  const details = [
    ['Academic Year', draft.academicYear.replace('-', '–')],
    ['Year Level', draft.yearLevel],
    ['Academic Calendar', ACADEMIC_CALENDARS[draft.calendarType]?.label || draft.calendarType],
    ['Current Term', draft.semester],
    [schedule.label, schedule.value],
  ]

  return (
    <main className="relative z-0 mx-auto max-w-4xl px-5 pb-16 pt-7 sm:px-8 sm:pt-10">
      <div className="motion-enter mb-8 text-center">
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-orange-600">Review College Phase</p>
        <h1 className="text-3xl font-bold tracking-[-0.03em] text-gray-950 sm:text-4xl">Your College Phase</h1>
        <p className="mt-3 text-sm text-gray-500 sm:text-base">Review these details before tracking begins.</p>
      </div>

      {error && <div role="alert" className="mb-6 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}

      <section className="motion-enter motion-delay-1 overflow-hidden rounded-[26px] border border-orange-100 bg-white shadow-sm">
        <div className="border-b border-orange-100 bg-orange-50/60 p-5 sm:p-7">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-orange-100 text-orange-600"><IconSchool size={22} /></span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-orange-600">Enrolled Course</p>
              <CourseName name={draft.selectedCourse.course_name} abbreviation={draft.selectedCourse.course_abbreviation} className="mt-2 block text-xl font-bold leading-snug text-gray-950 sm:text-2xl" secondaryClassName="mt-1 text-base font-medium text-gray-500" />
            </div>
          </div>
        </div>
        <dl className="grid gap-px bg-gray-100 sm:grid-cols-2">
          {details.map(([label, value]) => (
            <div key={label} className={`bg-white p-5 sm:p-6 ${label.includes('Schedule') ? 'sm:col-span-2' : ''}`}>
              <dt className="text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</dt>
              <dd className="mt-2 text-sm font-semibold leading-6 text-gray-900 sm:text-base">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="motion-enter motion-delay-2 mt-6 rounded-[26px] border border-slate-800 bg-slate-950 p-5 text-white sm:p-7">
        <div className="flex items-start gap-3"><IconCalendarEvent className="mt-0.5 shrink-0 text-orange-400" size={22} /><div><h2 className="font-bold">How tracking works</h2><p className="mt-1 text-sm leading-6 text-slate-300">LearnMatch uses three short check-ins during your term to track how your course continues to align with your academic experience and career direction.</p></div></div>
        <div className="mt-5 flex flex-wrap items-center gap-2 text-sm font-semibold"><span className="rounded-full bg-white/10 px-3 py-2">Early Check-in</span><IconArrowRight size={16} className="text-orange-400" /><span className="rounded-full bg-white/10 px-3 py-2">Mid Check-in</span><IconArrowRight size={16} className="text-orange-400" /><span className="rounded-full bg-white/10 px-3 py-2">End Check-in</span></div>
      </section>

      <div className="motion-enter motion-delay-3 mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        {!success && <button type="button" onClick={onEdit} disabled={submitting} className="rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-700 hover:border-orange-200 hover:bg-orange-50 disabled:opacity-50">Edit Setup</button>}
        {success ? <SuccessConfirmation compact message="College Phase Started" /> : <button type="button" onClick={onConfirm} disabled={submitting} className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-6 py-3 text-sm font-semibold text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"><IconCircleCheck size={18} />{submitting ? 'Starting College Phase...' : 'Confirm & Start College Phase'}</button>}
      </div>
    </main>
  )
}

function CollegeSetupReview() {
  const navigate = useNavigate()
  const location = useLocation()
  const draft = location.state?.setupDraft
  const token = localStorage.getItem('token')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const confirmerRef = useRef(null)

  useEffect(() => {
    if (!token) navigate('/login', { replace: true })
    else if (!draft) navigate('/college/setup', { replace: true })
  }, [draft, navigate, token])

  if (!draft || !token) return null

  const editNavigation = getCollegeSetupEditNavigation(draft)

  const confirm = async () => {
    if (!confirmerRef.current) {
      confirmerRef.current = createCollegePhaseConfirmer({
        apiUrl: import.meta.env.VITE_API_URL || '',
        token,
        draft,
        onSuccess: async () => {
          setSuccess(true)
          await waitForSuccessConfirmation()
          navigate('/college', { replace: true })
        },
      })
    }
    setSubmitting(true)
    setError('')
    try {
      await confirmerRef.current()
    } catch (requestError) {
      setError(requestError.message || 'Cannot connect to server. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <div className="relative min-h-screen bg-[#fbf8f3] text-gray-900">
      <CollegeSetupReviewContent draft={draft} onEdit={() => navigate(editNavigation.to, editNavigation.options)} onConfirm={confirm} submitting={submitting} success={success} error={error} />
    </div>
  )
}

export default CollegeSetupReview
