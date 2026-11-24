import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
} from 'chart.js'
import { Bar, Doughnut } from 'react-chartjs-2'
import {
  IconAlertTriangle,
  IconCamera,
  IconChartBar,
  IconChartDonut3,
  IconChecklist,
  IconDownload,
  IconRefresh,
  IconSchool,
  IconSparkles,
  IconUsers,
} from '@tabler/icons-react'
import AdminHeader from '../../components/AdminHeader'
import { parseCourseName } from '../../utils/courseName'
import { downloadCsv } from '../../utils/csvExport'

ChartJS.register(ArcElement, BarElement, CategoryScale, Legend, LinearScale, Tooltip)

const chartFont = { size: 13 }
const integerTicks = { precision: 0, font: chartFont, color: '#4b5563' }

const horizontalPercentOptions = {
  indexAxis: 'y',
  responsive: true,
  maintainAspectRatio: false,
  animation: false,
  plugins: {
    legend: { display: false },
    tooltip: { displayColors: false, callbacks: { label: ({ parsed }) => `${parsed.x}%` } },
  },
  scales: {
    x: {
      beginAtZero: true,
      max: 100,
      ticks: { ...integerTicks, callback: (value) => `${value}%` },
      grid: { color: '#e2e8f0' },
      border: { display: false },
    },
    y: {
      ticks: { font: chartFont, color: '#374151', autoSkip: false, padding: 8 },
      grid: { display: false },
      border: { display: false },
    },
  },
}

const horizontalCountOptions = {
  indexAxis: 'y',
  responsive: true,
  maintainAspectRatio: false,
  animation: false,
  layout: { padding: { right: 12 } },
  plugins: { legend: { display: false }, tooltip: { displayColors: false } },
  scales: {
    x: {
      beginAtZero: true,
      ticks: integerTicks,
      grid: { color: '#e2e8f0' },
      border: { display: false },
    },
    y: {
      ticks: { font: chartFont, color: '#374151', autoSkip: false, padding: 8 },
      grid: { display: false },
      border: { display: false },
    },
  },
}

const completionOptions = {
  responsive: true,
  maintainAspectRatio: false,
  animation: false,
  cutout: '68%',
  plugins: {
    legend: {
      position: 'bottom',
      labels: {
        usePointStyle: true,
        pointStyle: 'circle',
        boxWidth: 9,
        padding: 16,
        font: chartFont,
        color: '#374151',
      },
    },
  },
}

const metricDefinitions = [
  { key: 'totalUsers', label: 'Total Registered Students', icon: IconUsers, tone: 'bg-orange-50 text-orange-700' },
  { key: 'completedAssessments', label: 'Completed Assessments', icon: IconChecklist, tone: 'bg-emerald-50 text-emerald-700' },
  { key: 'assessmentCompletionRate', label: 'Assessment Completion Rate', icon: IconChartDonut3, tone: 'bg-amber-50 text-amber-700', percent: true },
  { key: 'recommendationsGenerated', label: 'Students With Recommendations', icon: IconSparkles, tone: 'bg-orange-50 text-orange-700' },
]

function wrapLabel(label, maxLength = 24) {
  const lines = []
  for (const word of String(label).split(/\s+/).flatMap((word) => word.match(new RegExp(`.{1,${maxLength}}`, 'gu')) || [])) {
    const current = lines.at(-1)
    if (!current || `${current} ${word}`.length > maxLength) lines.push(word)
    else lines[lines.length - 1] = `${current} ${word}`
  }
  return lines
}

function wrapCourseLabel(courseName) {
  const { baseName, specialization } = parseCourseName(courseName)
  return [...wrapLabel(baseName), ...(specialization ? wrapLabel(specialization) : [])]
}

function ChartCard({ title, subtitle, icon: Icon, children, aside }) {
  return (
    <section className="min-w-0 rounded-xl border border-orange-100 bg-white shadow-sm">
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orange-50 text-orange-600">
            <Icon size={19} stroke={1.8} />
          </span>
          <div>
            <h2 className="text-[17px] font-semibold text-slate-900">{title}</h2>
            <p className="mt-1 text-sm leading-5 text-slate-500">{subtitle}</p>
          </div>
        </div>
        {aside}
      </div>
      <div className="p-5 sm:p-6">{children}</div>
    </section>
  )
}

function EmptyState({ children }) {
  return (
    <div className="flex h-full min-h-56 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/60 px-6 text-center text-sm text-slate-500">
      {children}
    </div>
  )
}

function LoadingState() {
  return (
    <div aria-label="Loading analytics" className="animate-pulse space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metricDefinitions.map(({ key }) => <div key={key} className="h-28 rounded-xl border border-slate-200 bg-white" />)}
      </div>
      <div className="h-[25rem] rounded-xl border border-slate-200 bg-white" />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="h-[25rem] rounded-xl border border-slate-200 bg-white" />
        <div className="h-[25rem] rounded-xl border border-slate-200 bg-white" />
      </div>
    </div>
  )
}

function AdminAnalytics() {
  const navigate = useNavigate()
  const [analytics, setAnalytics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retryKey, setRetryKey] = useState(0)
  const [showAllCourses, setShowAllCourses] = useState(false)

  useEffect(() => {
    document.title = 'Analytics | LearnMatch Admin'
  }, [])

  useEffect(() => {
    const controller = new AbortController()

    const loadAnalytics = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/analytics`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` },
          signal: controller.signal,
        })
        if (response.status === 401 || response.status === 403) {
          localStorage.removeItem('adminToken')
          localStorage.removeItem('adminUsername')
          navigate('/admin/login', { replace: true })
          return
        }
        if (!response.ok) throw new Error('Analytics are temporarily unavailable.')
        setAnalytics(await response.json())
      } catch (requestError) {
        if (requestError.name !== 'AbortError') {
          setError(requestError.message || 'Analytics are temporarily unavailable.')
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    loadAnalytics()
    return () => controller.abort()
  }, [navigate, retryKey])

  const visibleCourses = useMemo(() => {
    const courses = analytics?.topRecommendedCourses || []
    return showAllCourses ? courses : courses.slice(0, 8)
  }, [analytics, showAllCourses])
  // Chart.js category rows are equally spaced: reserve room for the longest
  // multiline label in every row, including on narrow screens.
  const courseLabels = visibleCourses.map(({ courseName }) => wrapCourseLabel(courseName))
  const courseChartHeight = Math.max(320, 40 + visibleCourses.length * Math.max(
    42, ...courseLabels.map((lines) => lines.length * 16 + 16)
  ))

  const chartData = useMemo(() => {
    if (!analytics) return null
    return {
      skills: {
        labels: analytics.averageSkillScores.map(({ domain }) => wrapLabel(domain, 18)),
        datasets: [{
          data: analytics.averageSkillScores.map(({ averagePercent }) => averagePercent),
          backgroundColor: '#f97316',
          borderRadius: 4,
          maxBarThickness: 48,
        }],
      },
      personality: {
        labels: analytics.personalityDistribution.map(({ type }) => type),
        datasets: [{
          data: analytics.personalityDistribution.map(({ count }) => count),
          backgroundColor: '#fb923c',
          borderRadius: 4,
          barThickness: 18,
        }],
      },
      completion: {
        labels: ['Completed', 'In Progress', 'Not Started'],
        datasets: [{
          data: [
            analytics.assessmentCompletion.completed,
            analytics.assessmentCompletion.inProgress,
            analytics.assessmentCompletion.notStarted,
          ],
          backgroundColor: ['#10b981', '#f59e0b', '#cbd5e1'],
          borderColor: '#ffffff',
          borderWidth: 3,
          hoverOffset: 3,
        }],
      },
      courses: {
        labels: visibleCourses.map(({ courseName }) => wrapCourseLabel(courseName)),
        datasets: [{
          data: visibleCourses.map(({ count }) => count),
          backgroundColor: '#f97316',
          borderRadius: 4,
          barThickness: 22,
        }],
      },
    }
  }, [analytics, visibleCourses])

  const completionTotal = analytics
    ? Object.values(analytics.assessmentCompletion).reduce((sum, count) => sum + count, 0)
    : 0

  const retry = () => {
    setLoading(true)
    setError('')
    setRetryKey((current) => current + 1)
  }

  const handleExportAnalyticsCsv = () => {
    if (!analytics) return
    const today = new Date().toISOString().slice(0, 10)
    const modes = analytics.assessmentModes || { verified: 0, standard: 0 }
    const college = analytics.collegeOverview || {
      totalTracked: 0,
      alignment: { onTrack: 0, monitor: 0, needsAttention: 0, noCheckin: 0 },
      enrollmentVerification: { totalEnrolled: 0, verified: 0, pendingReview: 0, rejected: 0, unsubmitted: 0 },
    }
    const rows = [
      ['LearnMatch Analytics Summary Report', `Exported ${today}`],
      [],
      ['Overview Metric', 'Value'],
      ['Total Registered Students', analytics.summary.totalUsers],
      ['Completed Assessments', analytics.summary.completedAssessments],
      ['Assessment Completion Rate (%)', analytics.summary.assessmentCompletionRate],
      ['Students With Recommendations', analytics.summary.recommendationsGenerated],
      [],
      ['Assessment Verification Mode (Latest Completed)', 'Students'],
      ['Verified (Camera-Monitored)', modes.verified],
      ['Standard Assessment', modes.standard],
      [],
      ['College Phase & Enrollment Verification', 'Students'],
      ['Total College Students Tracked', college.totalTracked],
      ['Verified Enrolled', college.enrollmentVerification?.verified || 0],
      ['Pending Review', college.enrollmentVerification?.pendingReview || 0],
      ['Rejected (Resubmission Requested)', college.enrollmentVerification?.rejected || 0],
      ['Unsubmitted Proof', college.enrollmentVerification?.unsubmitted || 0],
      ['Alignment: On Track', college.alignment?.onTrack || 0],
      ['Alignment: Monitor', college.alignment?.monitor || 0],
      ['Alignment: Needs Attention', college.alignment?.needsAttention || 0],
      ['Alignment: No Check-in Yet', college.alignment?.noCheckin || 0],
      [],
      ['Skill Domain', 'Average Score (%)', 'Students'],
      ...analytics.averageSkillScores.map((item) => [item.domain, item.averagePercent, item.studentCount]),
      [],
      ['Recommended Course', 'Course Code', 'Top 3 Appearances'],
      ...analytics.topRecommendedCourses.map((item) => [item.courseName, item.courseCode, item.count]),
    ]
    downloadCsv(`learnmatch-analytics-summary-${today}.csv`, rows)
  }

  const assessmentModes = analytics?.assessmentModes || { verified: 0, standard: 0 }
  const totalModeAttempts = assessmentModes.verified + assessmentModes.standard
  const verifiedModePercent = totalModeAttempts > 0
    ? Math.round((assessmentModes.verified / totalModeAttempts) * 100)
    : 0
  const collegeOverview = analytics?.collegeOverview || null

  return (
    <div className="min-h-screen bg-[#fcfaf7]">
      <AdminHeader currentPage="analytics" />
      <main className="mx-auto max-w-[1440px] px-5 py-8 sm:px-8 sm:py-10 lg:px-10">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-orange-600">Administration</p>
            <h1 className="text-3xl font-bold tracking-tight text-slate-950">Analytics &amp; System Monitoring</h1>
            <p className="mt-2 text-sm text-slate-600">Aggregate insights from student assessments, verification integrity, and college alignment.</p>
          </div>
          {!loading && analytics && (
            <button
              type="button"
              onClick={handleExportAnalyticsCsv}
              className="inline-flex items-center gap-2 rounded-xl border border-orange-200 bg-white px-4 py-2.5 text-sm font-semibold text-orange-800 shadow-xs transition hover:bg-orange-50"
            >
              <IconDownload size={16} aria-hidden="true" />
              Export Summary (CSV)
            </button>
          )}
        </div>

        {loading && <LoadingState />}

        {!loading && error && (
          <div className="rounded-xl border border-red-200 bg-white p-8 text-center shadow-sm" role="alert">
            <IconAlertTriangle className="mx-auto text-red-600" size={28} stroke={1.8} />
            <h2 className="mt-3 font-semibold text-slate-900">Unable to load analytics</h2>
            <p className="mt-1 text-sm text-slate-600">{error}</p>
            <button type="button" onClick={retry} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2">
              <IconRefresh size={16} /> Retry
            </button>
          </div>
        )}

        {!loading && analytics && chartData && (
          <div className="space-y-6">
            <section aria-label="Analytics summary" className="motion-stagger grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {metricDefinitions.map(({ key, label, icon: Icon, tone, percent }) => (
                <article key={key} className="rounded-xl border border-orange-100 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-3xl font-bold tabular-nums tracking-tight text-slate-950">
                        {analytics.summary[key].toLocaleString()}{percent ? '%' : ''}
                      </p>
                      <p className="mt-1 text-[15px] font-medium text-slate-600">{label}</p>
                    </div>
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${tone}`}>
                      <Icon size={21} stroke={1.8} />
                    </span>
                  </div>
                </article>
              ))}
            </section>

            <div className="grid min-w-0 gap-6 lg:grid-cols-2">
              <ChartCard
                title="Assessment Verification Modes"
                subtitle="Latest completed assessments split by Verified (Camera-Monitored) vs. Standard mode"
                icon={IconCamera}
              >
                {totalModeAttempts > 0 ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Verified (Camera-Monitored)</p>
                        <p className="mt-1.5 text-2xl font-bold tabular-nums text-emerald-950">{assessmentModes.verified.toLocaleString()}</p>
                        <p className="mt-0.5 text-xs text-emerald-700">{verifiedModePercent}% of completed</p>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Standard Assessment</p>
                        <p className="mt-1.5 text-2xl font-bold tabular-nums text-slate-900">{assessmentModes.standard.toLocaleString()}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{100 - verifiedModePercent}% of completed</p>
                      </div>
                    </div>
                    <div>
                      <div className="h-3 overflow-hidden rounded-full bg-slate-200">
                        <div
                          className="h-full rounded-full bg-emerald-500 transition-[width] duration-500"
                          style={{ width: `${verifiedModePercent}%` }}
                        />
                      </div>
                      <p className="mt-2 text-xs text-slate-500">
                        Based on {totalModeAttempts.toLocaleString()} student{totalModeAttempts === 1 ? '' : 's'} with a completed assessment attempt.
                      </p>
                    </div>
                  </div>
                ) : (
                  <EmptyState>No completed assessment mode records yet.</EmptyState>
                )}
              </ChartCard>

              <ChartCard
                title="College Phase Enrollment & Alignment"
                subtitle="Verified enrollment status and latest Career Alignment distribution"
                icon={IconSchool}
                aside={collegeOverview ? (
                  <span className="shrink-0 rounded-md bg-orange-50 px-2.5 py-1 text-xs font-semibold text-orange-800">
                    {collegeOverview.totalTracked.toLocaleString()} tracked
                  </span>
                ) : null}
              >
                {collegeOverview && collegeOverview.totalTracked > 0 ? (
                  <div className="space-y-4">
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Enrollment Verification</p>
                      <div className="flex flex-wrap gap-2 text-xs font-semibold">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-800">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          Verified Enrolled: {collegeOverview.enrollmentVerification?.verified || 0}
                        </span>
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-amber-800">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                          Pending Review: {collegeOverview.enrollmentVerification?.pendingReview || 0}
                        </span>
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                          Unverified: {(collegeOverview.enrollmentVerification?.unsubmitted || 0) + (collegeOverview.enrollmentVerification?.rejected || 0)}
                          {(collegeOverview.enrollmentVerification?.rejected || 0) > 0
                            ? ` (${collegeOverview.enrollmentVerification.rejected} rejected)`
                            : ''}
                        </span>
                      </div>
                    </div>
                    <div className="border-t border-slate-100 pt-4">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Latest Career Alignment</p>
                      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                        <div className="rounded-lg border border-emerald-100 bg-emerald-50/50 px-3 py-2.5">
                          <p className="text-lg font-bold tabular-nums text-emerald-900">{collegeOverview.alignment.onTrack}</p>
                          <p className="text-[11px] font-medium text-emerald-700">On Track</p>
                        </div>
                        <div className="rounded-lg border border-amber-100 bg-amber-50/50 px-3 py-2.5">
                          <p className="text-lg font-bold tabular-nums text-amber-900">{collegeOverview.alignment.monitor}</p>
                          <p className="text-[11px] font-medium text-amber-700">Monitor</p>
                        </div>
                        <div className="rounded-lg border border-rose-100 bg-rose-50/50 px-3 py-2.5">
                          <p className="text-lg font-bold tabular-nums text-rose-900">{collegeOverview.alignment.needsAttention}</p>
                          <p className="text-[11px] font-medium text-rose-700">Needs Attention</p>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                          <p className="text-lg font-bold tabular-nums text-slate-800">{collegeOverview.alignment.noCheckin}</p>
                          <p className="text-[11px] font-medium text-slate-500">No Check-in</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <EmptyState>No students are currently tracked in the College Phase.</EmptyState>
                )}
              </ChartCard>
            </div>

            <ChartCard
              title="Average Skill Scores"
              subtitle="Average percentage correct by domain across valid latest 30-question assessments"
              icon={IconChartBar}
            >
              <div className="h-80 min-w-0 sm:h-96">
                {analytics.averageSkillScores.length > 0
                  ? <Bar data={chartData.skills} options={horizontalPercentOptions} />
                  : <EmptyState>No completed Academic Skills assessments yet.</EmptyState>}
              </div>
            </ChartCard>

            <div className="grid min-w-0 gap-6 lg:grid-cols-2">
              <ChartCard
                title="Personality Type Distribution"
                subtitle="Latest valid stored personality result per student"
                icon={IconChartBar}
              >
                <div className="h-80 min-w-0 sm:h-96">
                  {analytics.personalityDistribution.length > 0
                    ? <Bar data={chartData.personality} options={horizontalCountOptions} />
                    : <EmptyState>No completed personality assessments are available yet.</EmptyState>}
                </div>
              </ChartCard>

              <ChartCard
                title="Assessment Completion"
                subtitle="All registered students grouped by the monitoring completion rule"
                icon={IconChartDonut3}
                aside={(
                  <span className="shrink-0 rounded-md bg-emerald-50 px-2.5 py-1 text-sm font-semibold text-emerald-700">
                    {analytics.summary.assessmentCompletionRate}%
                  </span>
                )}
              >
                <div className="h-80 min-w-0 sm:h-96">
                  {completionTotal > 0
                    ? <Doughnut data={chartData.completion} options={completionOptions} />
                    : <EmptyState>No registered students are available yet.</EmptyState>}
                </div>
              </ChartCard>
            </div>

            <ChartCard
              title="All Recommended Courses"
              subtitle="Course recommendation frequency across all stored student Top 3 results"
              icon={IconChartBar}
            >
              {analytics.topRecommendedCourses.length > 0 ? (
                <>
                  <div id="all-recommended-courses" className="overflow-x-auto">
                    <div className="relative min-w-[480px]" style={{ height: courseChartHeight }}>
                      <Bar data={chartData.courses} options={horizontalCountOptions}
                        aria-label={`Recommendation frequency for ${visibleCourses.length} courses`} role="img" />
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-slate-500" aria-live="polite">
                    Showing {visibleCourses.length} of {analytics.topRecommendedCourses.length} recommended courses
                  </p>
                  {analytics.topRecommendedCourses.length > 8 && (
                    <button type="button" aria-expanded={showAllCourses} aria-controls="all-recommended-courses"
                      onClick={() => setShowAllCourses((expanded) => !expanded)}
                      className="mt-3 rounded-lg border border-orange-200 bg-orange-50 px-4 py-2 text-sm font-semibold text-orange-700 hover:bg-orange-100 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2">
                      {showAllCourses ? 'Show Less' : 'Show All Courses'}
                    </button>
                  )}
                </>
              ) : <EmptyState>No saved course recommendations yet.</EmptyState>}

            </ChartCard>
          </div>
        )}
      </main>
    </div>
  )
}

export default AdminAnalytics
