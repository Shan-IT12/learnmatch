import SkeletonContent from '../../components/SkeletonContent'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  IconArrowLeft,
  IconBook2,
  IconBrain,
  IconCamera,
  IconCheck,
  IconClipboardCheck,
  IconEye,
  IconMail,
  IconSchool,
  IconShieldCheck,
  IconUser,
  IconX,
} from '@tabler/icons-react'
import AdminHeader from '../../components/AdminHeader'
import CourseName from '../../components/CourseName'
import AdminAttemptLogsSection, { AdminMonitoringBadge } from '../../components/admin/AdminAttemptMonitoringPanel'

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
  const [savedUser, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const user = loading ? {
    account: { displayName: 'Student account name', email: 'student@example.com', username: 'username', status: 'Active', registeredAt: '2026-01-01T00:00:00Z' },
    profile: { fullName: 'Student account name' },
    assessment: { status: 'Assessment status', components: { profile: true, interests: true, skills: true, personality: true }, interestCount: 5, skillScore: { correct: 20, total: 30, percent: 67 }, mbtiType: 'INTP', personalityTakenAt: '2026-01-01T00:00:00Z' },
    recommendation: { available: true, generatedAt: '2026-01-01T00:00:00Z', courses: [1, 2, 3].map(rank => ({ rank, courseId: rank, courseName: 'Recommended course name', matchPercent: 80 })) },
    tracking: { started: true, course: { courseName: 'Current enrolled program' }, lifecycleStatus: 'active', academicYear: '2026-2027', yearLevel: '1st Year', semester: '1st Semester', timingMode: 'manual', datesSource: 'manual', completedCheckins: 1, latestAlignmentPercent: 70 },
  } : savedUser
  const [error, setError] = useState('')
  const [proofPreview, setProofPreview] = useState(null)
  const [proofLoading, setProofLoading] = useState(false)
  const [verifyingProof, setVerifyingProof] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectingProof, setRejectingProof] = useState(false)
  const [proofFeedback, setProofFeedback] = useState('')

  useEffect(() => () => {
    if (proofPreview?.url) URL.revokeObjectURL(proofPreview.url)
  }, [proofPreview])

  const closeProofPreview = () => {
    setProofPreview((current) => {
      if (current?.url) URL.revokeObjectURL(current.url)
      return null
    })
  }

  const handleViewEnrollmentProof = async () => {
    setProofLoading(true)
    setProofFeedback('')
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/users/${userId}/enrollment-proof`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` },
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        setProofFeedback(data.message || 'Could not load enrollment proof.')
        return
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      setProofPreview((current) => {
        if (current?.url) URL.revokeObjectURL(current.url)
        return {
          url,
          mimeType: blob.type || user?.tracking?.enrollmentVerification?.proofMime || 'image/png',
          fileName: user?.tracking?.enrollmentVerification?.proofFileName || 'Enrollment Proof',
        }
      })
    } catch {
      setProofFeedback('Cannot connect to server to load proof.')
    } finally {
      setProofLoading(false)
    }
  }

  const handleMarkProofVerified = async () => {
    setVerifyingProof(true)
    setProofFeedback('')
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/users/${userId}/enrollment-proof/verify`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` },
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        setProofFeedback(data.message || 'Could not verify enrollment proof.')
        return
      }
      setUser((current) => {
        if (!current?.tracking?.enrollmentVerification) return current
        return {
          ...current,
          tracking: {
            ...current.tracking,
            enrollmentVerification: {
              ...current.tracking.enrollmentVerification,
              proofStatus: 'verified',
              verifiedAt: new Date().toISOString(),
              rejectionReason: null,
            },
          },
        }
      })
      setRejectOpen(false)
      setRejectReason('')
      setProofFeedback('Enrollment proof marked as verified.')
    } catch {
      setProofFeedback('Cannot connect to server.')
    } finally {
      setVerifyingProof(false)
    }
  }

  const handleRejectProof = async (event) => {
    event.preventDefault()
    const trimmedReason = rejectReason.trim()
    if (!trimmedReason) {
      setProofFeedback('Please enter a brief reason for rejecting the enrollment proof.')
      return
    }
    setRejectingProof(true)
    setProofFeedback('')
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/users/${userId}/enrollment-proof/reject`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('adminToken')}`,
        },
        body: JSON.stringify({ reason: trimmedReason }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        setProofFeedback(data.message || 'Could not reject enrollment proof.')
        return
      }
      setUser((current) => {
        if (!current?.tracking?.enrollmentVerification) return current
        return {
          ...current,
          tracking: {
            ...current.tracking,
            enrollmentVerification: {
              ...current.tracking.enrollmentVerification,
              proofStatus: 'rejected',
              verifiedAt: null,
              rejectionReason: data.rejectionReason || trimmedReason,
            },
          },
        }
      })
      setRejectOpen(false)
      setRejectReason('')
      setProofFeedback('Enrollment proof rejected and resubmission requested.')
    } catch {
      setProofFeedback('Cannot connect to server.')
    } finally {
      setRejectingProof(false)
    }
  }

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
        <button type="button" onClick={() => navigate('/admin/users')} className="lm-action mb-6">
          <IconArrowLeft size={16} stroke={2} /> Back to Users
        </button>

        {!loading && error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-5 text-red-700" role="alert">
            <p className="font-semibold">Unable to load user</p>
            <p className="mt-1 text-sm">{error}</p>
          </div>
        )}

        {user && (
          <SkeletonContent loading={loading} label="Loading user details..."><div className="space-y-6">
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
                {user.assessment.latestAttempt && (
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/70 px-3.5 py-2.5">
                    <span className="text-xs font-semibold text-slate-600">Latest attempt monitoring</span>
                    <AdminMonitoringBadge
                      cameraEnabled={user.assessment.latestAttempt.cameraEnabled}
                      mode={user.assessment.latestAttempt.mode}
                      flagCount={user.assessment.latestAttempt.flagCount}
                    />
                  </div>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  <ComponentState label="Profile" complete={user.assessment.components.profile} detail={user.assessment.components.profile ? 'Profile information recorded' : 'Not started'} />
                  <ComponentState label="Interests" complete={user.assessment.components.interests} detail={user.assessment.components.interests ? `${user.assessment.interestCount} interests recorded` : 'Not started'} />
                  <ComponentState label="Academic Skills" complete={user.assessment.components.skills} detail={user.assessment.skillScore ? `${user.assessment.skillScore.correct} of ${user.assessment.skillScore.total} correct (${user.assessment.skillScore.percent}%)` : 'Not completed'} />
                  <ComponentState label="Personality" complete={user.assessment.components.personality} detail={user.assessment.mbtiType ? `${user.assessment.mbtiType} · ${formatDate(user.assessment.personalityTakenAt)}` : 'Not completed'} />
                </div>
              </SectionCard>
            </div>

            <SectionCard
              title="Assessment Attempts & Camera Monitoring"
              subtitle="Verified vs. Standard assessment mode and metadata event logs per attempt"
              icon={IconCamera}
            >
              <AdminAttemptLogsSection attempts={user.assessment.attempts || []} />
            </SectionCard>

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
                        <CourseName as="h3" name={course.courseName} className="mt-2 text-sm font-semibold leading-5 text-slate-900" secondaryClassName="mt-0.5 text-sm font-normal text-slate-500" />
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
                      <CourseName name={user.tracking.course.courseName} className="text-sm font-semibold text-slate-900" secondaryClassName="mt-0.5 text-sm font-normal text-slate-500" />
                      {user.tracking.course.courseCode && <p className="mt-1 text-xs text-slate-500">{user.tracking.course.courseCode}</p>}
                    </div>
                    <span className={`w-fit rounded-md border px-2.5 py-1.5 text-sm font-semibold ${alignmentStyles[user.tracking.latestAlignment] || 'border-slate-200 bg-slate-50 text-slate-600'}`}>
                      {user.tracking.latestAlignment || 'No completed check-in'}
                    </span>
                  </div>
                  <dl className="grid grid-cols-2 gap-5 md:grid-cols-4">
                    <DetailItem label="Tracking status">{readableValue(user.tracking.lifecycleStatus)}</DetailItem>
                    <DetailItem label="Academic year">{user.tracking.academicYear || 'Legacy tracking'}</DetailItem>
                    <DetailItem label="Year level">{user.tracking.yearLevel}</DetailItem>
                    <DetailItem label="Current term">{user.tracking.semester}</DetailItem>
                    <DetailItem label="Timing mode">{readableValue(user.tracking.timingMode)}</DetailItem>
                    <DetailItem label="Timing source">{readableValue(user.tracking.datesSource)}</DetailItem>
                    <DetailItem label="Completed check-ins">{user.tracking.completedCheckins}</DetailItem>
                    <DetailItem label="Latest alignment">{user.tracking.latestAlignmentPercent === null ? '—' : `${user.tracking.latestAlignmentPercent}%`}</DetailItem>
                    <DetailItem label="Latest check-in">{formatDate(user.tracking.latestCheckinAt, true)}</DetailItem>
                  </dl>

                  {user.tracking.enrollmentVerification && (
                    <div className="rounded-xl border border-stone-200/90 bg-stone-50/70 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <IconShieldCheck size={17} className="text-orange-600" aria-hidden="true" />
                          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-700">
                            Enrollment Verification
                          </h3>
                        </div>
                        <span
                          className={`inline-flex rounded-md border px-2.5 py-0.5 text-xs font-semibold ${
                            user.tracking.enrollmentVerification.proofStatus === 'verified'
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                              : user.tracking.enrollmentVerification.proofStatus === 'submitted'
                                ? 'border-amber-200 bg-amber-50 text-amber-800'
                                : user.tracking.enrollmentVerification.proofStatus === 'rejected'
                                  ? 'border-rose-200 bg-rose-50 text-rose-800'
                                  : 'border-slate-200 bg-white text-slate-600'
                          }`}
                        >
                          {user.tracking.enrollmentVerification.proofStatus === 'verified'
                            ? 'Enrollment Verified'
                            : user.tracking.enrollmentVerification.proofStatus === 'submitted'
                              ? 'Proof Submitted (Pending Review)'
                              : user.tracking.enrollmentVerification.proofStatus === 'rejected'
                                ? 'Rejected (Resubmission Requested)'
                                : 'Not Submitted'}
                        </span>
                      </div>
                      <dl className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <DetailItem label="School / University">{user.tracking.enrollmentVerification.schoolName || 'Not provided'}</DetailItem>
                        <DetailItem label="Student ID Number">{user.tracking.enrollmentVerification.studentIdNumber || 'Not provided'}</DetailItem>
                        <DetailItem label="Submitted Proof">{user.tracking.enrollmentVerification.proofFileName || 'None uploaded'}</DetailItem>
                      </dl>
                      {user.tracking.enrollmentVerification.proofStatus === 'rejected' && user.tracking.enrollmentVerification.rejectionReason && (
                        <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-900">
                          <span className="font-semibold">Rejection reason: </span>
                          {user.tracking.enrollmentVerification.rejectionReason}
                        </div>
                      )}
                      {proofFeedback && (
                        <p role="status" className="mt-3 text-xs font-medium text-orange-800">{proofFeedback}</p>
                      )}
                      {user.tracking.enrollmentVerification.hasProof && (
                        <div className="mt-4 space-y-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              disabled={proofLoading}
                              onClick={handleViewEnrollmentProof}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-orange-300 hover:text-orange-700 disabled:opacity-50"
                            >
                              <IconEye size={15} aria-hidden="true" />
                              {proofLoading ? 'Loading proof...' : 'View Proof'}
                            </button>
                            {user.tracking.enrollmentVerification.proofStatus !== 'verified' && (
                              <>
                                <button
                                  type="button"
                                  disabled={verifyingProof || rejectingProof}
                                  onClick={handleMarkProofVerified}
                                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                                >
                                  <IconCheck size={15} aria-hidden="true" />
                                  {verifyingProof ? 'Verifying...' : 'Mark as Verified'}
                                </button>
                                <button
                                  type="button"
                                  disabled={verifyingProof || rejectingProof}
                                  onClick={() => {
                                    setRejectOpen((open) => !open)
                                    setProofFeedback('')
                                  }}
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                                >
                                  <IconX size={15} aria-hidden="true" />
                                  Reject / Request Resubmission
                                </button>
                              </>
                            )}
                          </div>
                          {rejectOpen && (
                            <form onSubmit={handleRejectProof} className="rounded-lg border border-rose-200 bg-white p-3.5">
                              <label className="block text-xs font-semibold text-slate-700" htmlFor="enrollment-reject-reason">
                                Reason for rejection / resubmission request
                              </label>
                              <textarea
                                id="enrollment-reject-reason"
                                rows={2}
                                maxLength={500}
                                value={rejectReason}
                                onChange={(event) => setRejectReason(event.target.value)}
                                placeholder="e.g., Document image is blurry. Please upload a clearer photo of your COR or School ID."
                                className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-200"
                              />
                              <div className="mt-2.5 flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => { setRejectOpen(false); setRejectReason('') }}
                                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="submit"
                                  disabled={rejectingProof}
                                  className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
                                >
                                  {rejectingProof ? 'Submitting...' : 'Confirm Rejection'}
                                </button>
                              </div>
                            </form>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-3 text-sm text-slate-500"><IconClipboardCheck size={19} className="text-slate-400" /> Tracking not started.</div>
              )}
            </SectionCard>
          </div></SkeletonContent>
        )}
      </main>

      {proofPreview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="enrollment-proof-preview-title"
          onClick={closeProofPreview}
        >
          <div
            className="w-full max-w-3xl overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-stone-100 px-5 py-3.5">
              <div>
                <h2 id="enrollment-proof-preview-title" className="text-sm font-bold text-slate-950">
                  {proofPreview.fileName}
                </h2>
                <p className="text-xs text-slate-500">
                  Private student enrollment proof — viewed in-memory only.
                </p>
              </div>
              <button
                type="button"
                onClick={closeProofPreview}
                aria-label="Close proof preview"
                className="rounded-lg p-1.5 text-slate-500 hover:bg-stone-100"
              >
                <IconX size={18} />
              </button>
            </div>
            <div className="flex max-h-[75vh] items-center justify-center overflow-auto bg-stone-50 p-4">
              {proofPreview.mimeType === 'application/pdf' ? (
                <iframe
                  title={proofPreview.fileName}
                  src={proofPreview.url}
                  className="h-[70vh] w-full rounded-lg border border-stone-200 bg-white"
                />
              ) : (
                <img
                  src={proofPreview.url}
                  alt={proofPreview.fileName}
                  className="max-h-[70vh] w-auto rounded-lg border border-stone-200 bg-white object-contain"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminUserDetail
