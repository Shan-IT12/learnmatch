import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  IconArrowLeft,
  IconBook2,
  IconBrain,
  IconCheck,
  IconClipboardCheck,
  IconMail,
  IconSchool,
  IconUser,
  IconX,
} from '@tabler/icons-react'
import AdminHeader from '../../components/AdminHeader'

const alignmentStyles = {
  'On Track': 'border-emerald-200 bg-emerald-50 text-emerald-700',
  Monitor: 'border-amber-200 bg-amber-50 text-amber-700',
  'Needs Attention': 'border-red-200 bg-red-50 text-red-700',
}

function formatDate(value, includeTime = false) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    ...(includeTime ? { hour: 'numeric', minute: '2-digit' } : {}),
  }).format(new Date(value))
}

function readableValue(value) {
  if (!value) return '—'
  return String(value).replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function SectionCard({ title, subtitle, icon: Icon, children, className = '' }) {
  return (
    <section className={`rounded-xl border border-orange-100 bg-white shadow-sm ${className}`}>
      <div className="flex items-start gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orange-50 text-orange-600"><Icon size={19} stroke={1.8} /></span>
        <div>
          <h2 className="font-semibold text-slate-900">{title}</h2>
          {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
        </div>
      </div>
      <div className="p-5 sm:p-6">{children}</div>
    </section>
  )
}

function DetailItem({ label, children }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-1.5 text-sm font-medium text-slate-800">{children || '—'}</dd>
    </div>
  )
}

function ComponentState({ label, complete, detail }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-slate-100 bg-slate-50/60 p-3.5">
      <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${complete ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>
        {complete ? <IconCheck size={14} stroke={2.5} /> : <IconX size={13} stroke={2} />}
      </span>
      <div>
        <p className="text-sm font-semibold text-slate-800">{label}</p>
        <p className="mt-0.5 text-xs leading-5 text-slate-500">{detail}</p>
      </div>
    </div>
  )
}

function AdminUserDetail() {
  const { userId } = useParams()
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    const loadUser = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/users/${userId}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` },
          signal: controller.signal,
        })
        if (response.status === 401 || response.status === 403) {
          localStorage.removeItem('adminToken')
          localStorage.removeItem('adminUsername')
          navigate('/admin/login', { replace: true })
          return
        }
        if (response.status === 404) throw new Error('This user account could not be found.')
        if (!response.ok) throw new Error('Could not load this user account.')
        const data = await response.json()
        setUser(data.user)
        document.title = `${data.user.account.displayName} | LearnMatch Admin`
      } catch (requestError) {
        if (requestError.name !== 'AbortError') setError(requestError.message || 'Could not load this user account.')
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    loadUser()
    return () => controller.abort()
  }, [navigate, userId])

  return (
    <div className="min-h-screen bg-[#fcfaf7]">
      <AdminHeader currentPage="users" />
      <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-10">
        <button type="button" onClick={() => navigate('/admin/users')} className="mb-6 inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-slate-500 hover:text-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500">
          <IconArrowLeft size={16} stroke={2} /> Back to Users
        </button>

        {loading && (
          <div className="rounded-xl border border-orange-100 bg-white py-20 text-center shadow-sm"><p className="text-sm text-slate-500">Loading user details…</p></div>
        )}

        {!loading && error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-5 text-red-700" role="alert">
            <p className="font-semibold">Unable to load user</p>
            <p className="mt-1 text-sm">{error}</p>
          </div>
        )}

        {!loading && user && (
          <div className="space-y-6">
            <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-orange-600">Student Account</p>
                <h1 className="text-3xl font-bold tracking-tight text-slate-950">{user.account.displayName}</h1>
                <p className="mt-2 flex items-center gap-1.5 text-sm text-slate-500"><IconMail size={15} /> {user.account.email}</p>
              </div>
              <span className={`w-fit rounded-md border px-2.5 py-1.5 text-sm font-semibold ${user.account.status === 'Active' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-100 text-slate-600'}`}>{user.account.status}</span>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <SectionCard title="Account" subtitle="Registered LearnMatch account information" icon={IconUser}>
                <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <DetailItem label="Full name">{user.profile.fullName || 'Not provided'}</DetailItem>
                  <DetailItem label="Username">{user.account.username}</DetailItem>
                  <DetailItem label="Email">{user.account.email}</DetailItem>
                  <DetailItem label="Registered">{formatDate(user.account.registeredAt)}</DetailItem>
                </dl>
              </SectionCard>

              <SectionCard title="Assessment" subtitle={user.assessment.status} icon={IconBrain}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <ComponentState label="Profile" complete={user.assessment.components.profile} detail={user.assessment.components.profile ? 'Profile information recorded' : 'Not started'} />
                  <ComponentState label="Interests" complete={user.assessment.components.interests} detail={user.assessment.components.interests ? `${user.assessment.interestCount} interests recorded` : 'Not started'} />
                  <ComponentState label="Skills Quiz" complete={user.assessment.components.skills} detail={user.assessment.skillScore ? `${user.assessment.skillScore.correct} of ${user.assessment.skillScore.total} correct (${user.assessment.skillScore.percent}%)` : 'Not completed'} />
                  <ComponentState label="Personality" complete={user.assessment.components.personality} detail={user.assessment.mbtiType ? `${user.assessment.mbtiType} · ${formatDate(user.assessment.personalityTakenAt)}` : 'Not completed'} />
                </div>
              </SectionCard>
            </div>

            <SectionCard title="Recommendation" subtitle="Latest persisted recommendation result" icon={IconBook2}>
              {user.recommendation.available ? (
                <div>
                  <p className="mb-4 text-sm text-slate-500">Generated {formatDate(user.recommendation.generatedAt, true)}</p>
                  <div className="grid gap-3 md:grid-cols-3">
                    {user.recommendation.courses.map((course) => (
                      <article key={course.courseId} className="rounded-lg border border-slate-200 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-xs font-semibold uppercase tracking-wide text-orange-600">Rank {course.rank}</span>
                          <span className="text-sm font-bold text-slate-800">{course.matchPercent}%</span>
                        </div>
                        <h3 className="mt-2 text-sm font-semibold leading-5 text-slate-900">{course.courseName}</h3>
                        {course.courseCode && <p className="mt-1 text-xs text-slate-500">{course.courseCode}</p>}
                      </article>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-500">No recommendation yet.</p>
              )}
            </SectionCard>

            <SectionCard title="College & Career Alignment" subtitle="Current tracking setup and latest completed check-in" icon={IconSchool}>
              {user.tracking.started ? (
                <div className="space-y-6">
                  <div className="flex flex-col justify-between gap-4 border-b border-slate-100 pb-5 sm:flex-row sm:items-center">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{user.tracking.course.courseName}</p>
                      {user.tracking.course.courseCode && <p className="mt-1 text-xs text-slate-500">{user.tracking.course.courseCode}</p>}
                    </div>
                    <span className={`w-fit rounded-md border px-2.5 py-1.5 text-sm font-semibold ${alignmentStyles[user.tracking.latestAlignment] || 'border-slate-200 bg-slate-50 text-slate-600'}`}>
                      {user.tracking.latestAlignment || 'No completed check-in'}
                    </span>
                  </div>
                  <dl className="grid grid-cols-2 gap-5 md:grid-cols-4">
                    <DetailItem label="Academic year">{user.tracking.academicYear || 'Legacy tracking'}</DetailItem>
                    <DetailItem label="Year level">{user.tracking.yearLevel}</DetailItem>
                    <DetailItem label="Semester">{user.tracking.semester}</DetailItem>
                    <DetailItem label="Timing mode">{readableValue(user.tracking.timingMode)}</DetailItem>
                    <DetailItem label="Timing source">{readableValue(user.tracking.datesSource)}</DetailItem>
                    <DetailItem label="Completed check-ins">{user.tracking.completedCheckins}</DetailItem>
                    <DetailItem label="Latest alignment">{user.tracking.latestAlignmentPercent === null ? '—' : `${user.tracking.latestAlignmentPercent}%`}</DetailItem>
                    <DetailItem label="Latest check-in">{formatDate(user.tracking.latestCheckinAt, true)}</DetailItem>
                  </dl>
                </div>
              ) : (
                <div className="flex items-center gap-3 text-sm text-slate-500"><IconClipboardCheck size={19} className="text-slate-400" /> Tracking not started.</div>
              )}
            </SectionCard>
          </div>
        )}
      </main>
    </div>
  )
}

export default AdminUserDetail
