import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArcElement, BarElement, CategoryScale, Chart as ChartJS, Legend, LineElement,
  LinearScale, PointElement, Tooltip,
} from 'chart.js'
import { Bar, Doughnut, Line } from 'react-chartjs-2'
import {
  IconAlertTriangle, IconChartDonut3, IconChartHistogram, IconClipboardCheck,
  IconListNumbers, IconRefresh, IconUserPlus, IconUsers,
} from '@tabler/icons-react'
import AdminHeader from '../../components/AdminHeader'
import CourseName from '../../components/CourseName'
import { parseCourseName } from '../../utils/courseName'

ChartJS.register(
  ArcElement, BarElement, CategoryScale, Legend, LineElement,
  LinearScale, PointElement, Tooltip
)

const chartFont = { size: 13 }
const integerTicks = { precision: 0, font: chartFont, color: '#4b5563' }

const lineOptions = {
  responsive: true,
  maintainAspectRatio: false,
  animation: false,
  plugins: { legend: { display: false }, tooltip: { displayColors: false } },
  scales: {
    x: { ticks: { font: chartFont, color: '#4b5563' }, grid: { display: false }, border: { display: false } },
    y: { beginAtZero: true, ticks: integerTicks, grid: { color: '#e2e8f0' }, border: { display: false } },
  },
}

const doughnutOptions = {
  responsive: true,
  maintainAspectRatio: false,
  animation: false,
  cutout: '72%',
  plugins: {
    legend: {
      position: 'bottom',
      labels: {
        usePointStyle: true, pointStyle: 'circle', boxWidth: 9, padding: 18,
        font: chartFont, color: '#374151',
      },
    },
  },
}

const barOptions = {
  indexAxis: 'y',
  responsive: true,
  maintainAspectRatio: false,
  animation: false,
  layout: { padding: { right: 12 } },
  plugins: {
    legend: { display: false },
    tooltip: {
      displayColors: false,
      callbacks: {
        title: (items) => {
          const item = items[0]
          return item?.dataset.fullCourseNames?.[item.dataIndex] || ''
        },
      },
    },
  },
  scales: {
    x: { beginAtZero: true, ticks: integerTicks, grid: { color: '#e2e8f0' }, border: { display: false } },
    y: {
      ticks: { font: chartFont, color: '#374151', autoSkip: false, padding: 10 },
      grid: { display: false }, border: { display: false },
    },
  },
}

const metricDefinitions = [
  { key: 'registeredStudents', label: 'Registered Students', icon: IconUsers, tone: 'text-orange-700 bg-orange-50' },
  { key: 'completedAssessments', label: 'Completed Assessments', icon: IconClipboardCheck, tone: 'text-emerald-700 bg-emerald-50' },
  { key: 'consideredPersonalFactors', label: 'Assessments with Personal Factors', icon: IconChartDonut3, tone: 'text-amber-700 bg-amber-50' },
]

function formatCourseChartLabel(courseName, maxLength = 26) {
  const { baseName, specialization } = parseCourseName(courseName)
  if (specialization) {
    const shorten = (value) => value.length > maxLength ? `${value.slice(0, maxLength - 1).trimEnd()}…` : value
    return [shorten(baseName), shorten(specialization)]
  }
  if (courseName.length <= maxLength) return courseName

  const words = courseName.split(/\s+/)
  const lines = ['', '']
  let lineIndex = 0

  for (const word of words) {
    const candidate = lines[lineIndex] ? `${lines[lineIndex]} ${word}` : word
    if (candidate.length <= maxLength) {
      lines[lineIndex] = candidate
    } else if (lineIndex === 0) {
      lineIndex = 1
      lines[lineIndex] = word
    } else {
      lines[lineIndex] = `${lines[lineIndex]} ${word}`
    }
  }

  if (lines[1].length > maxLength) lines[1] = `${lines[1].slice(0, maxLength - 1).trimEnd()}…`
  return lines.filter(Boolean)
}

function ChartCard({ title, subtitle, icon: Icon, children }) {
  return (
    <section className="min-w-0 rounded-xl border border-orange-100 bg-white shadow-sm">
      <div className="flex items-start gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orange-50 text-orange-600">
          <Icon size={19} stroke={1.8} />
        </span>
        <div>
          <h2 className="text-[17px] font-semibold text-slate-900">{title}</h2>
          {subtitle && <p className="mt-1 text-sm leading-5 text-slate-500">{subtitle}</p>}
        </div>
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
    <div aria-label="Loading dashboard analytics" className="space-y-6 animate-pulse">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {metricDefinitions.map(({ key }) => <div key={key} className="h-28 rounded-xl border border-slate-200 bg-white" />)}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="h-96 rounded-xl border border-slate-200 bg-white lg:col-span-2" />
        <div className="h-96 rounded-xl border border-slate-200 bg-white" />
      </div>
    </div>
  )
}

function formatRegistrationDate(value) {
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric',
  }).format(new Date(value))
}

function AdminDashboard() {
  const navigate = useNavigate()
  const [dashboard, setDashboard] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    const loadDashboard = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/dashboard`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` },
          signal: controller.signal,
        })

        if (response.status === 401 || response.status === 403) {
          localStorage.removeItem('adminToken')
          localStorage.removeItem('adminUsername')
          navigate('/admin/login', { replace: true })
          return
        }
        if (!response.ok) throw new Error('Dashboard analytics are temporarily unavailable.')
        setDashboard(await response.json())
      } catch (requestError) {
        if (requestError.name !== 'AbortError') {
          setError(requestError.message || 'Dashboard analytics are temporarily unavailable.')
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    loadDashboard()
    return () => controller.abort()
  }, [navigate, retryKey])

  const retryDashboard = () => {
    setLoading(true)
    setError('')
    setRetryKey((current) => current + 1)
  }

  const chartData = useMemo(() => {
    if (!dashboard) return null
    const remainingAssessments = Math.max(
      dashboard.summary.registeredStudents - dashboard.summary.completedAssessments,
      0
    )
    return {
      registrations: {
        labels: dashboard.registrationTrend.map(({ label }) => label),
        datasets: [{
          data: dashboard.registrationTrend.map(({ count }) => count),
          borderColor: '#f97316', backgroundColor: '#f97316',
          pointBackgroundColor: '#ffffff', pointBorderColor: '#f97316',
          pointBorderWidth: 2, pointRadius: 4, pointHoverRadius: 5, borderWidth: 2, tension: 0,
        }],
      },
      completion: {
        labels: ['Completed', 'Remaining'],
        datasets: [{
          data: [dashboard.summary.completedAssessments, remainingAssessments],
          backgroundColor: ['#f97316', '#e2e8f0'], borderColor: '#ffffff', borderWidth: 3,
        }],
      },
      popularity: {
        labels: dashboard.coursePopularity.map(({ courseName }) => formatCourseChartLabel(courseName)),
        datasets: [{
          data: dashboard.coursePopularity.map(({ count }) => count),
          fullCourseNames: dashboard.coursePopularity.map(({ courseName }) => courseName),
          backgroundColor: '#f97316', borderRadius: 4, barThickness: 22,
        }],
      },
    }
  }, [dashboard])

  return (
    <div className="min-h-screen bg-[#fcfaf7]">
      <AdminHeader currentPage="dashboard" />
      <main className="mx-auto max-w-[1440px] px-5 py-8 sm:px-8 sm:py-10 lg:px-10">
        <div className="mb-7 border-b border-slate-200 pb-6">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-orange-600">Administration</p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950">Dashboard</h1>
          <p className="mt-2 text-sm text-slate-600">Student assessment and saved recommendation overview</p>
        </div>

        {loading && <LoadingState />}

        {!loading && error && (
          <div className="rounded-xl border border-red-200 bg-white p-8 text-center shadow-sm" role="alert">
            <IconAlertTriangle className="mx-auto text-red-600" size={28} stroke={1.8} />
            <h2 className="mt-3 font-semibold text-slate-900">Unable to load dashboard</h2>
            <p className="mt-1 text-sm text-slate-600">{error}</p>
            <button type="button" onClick={retryDashboard} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2">
              <IconRefresh size={16} /> Retry
            </button>
          </div>
        )}

        {!loading && dashboard && chartData && (
          <div className="space-y-6">
            <section aria-label="Student assessment summary" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {metricDefinitions.map(({ key, label, icon: Icon, tone }) => (
                <article key={key} className="rounded-xl border border-orange-100 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-3xl font-bold tabular-nums tracking-tight text-slate-950">{dashboard.summary[key].toLocaleString()}</p>
                      <p className="mt-1 text-[15px] font-medium text-slate-600">{label}</p>
                      {key === 'consideredPersonalFactors' && (
                        <p className="mt-1 text-xs text-slate-400">
                          {dashboard.summary.consideredPersonalFactors.toLocaleString()} of{' '}
                          {dashboard.summary.completedAssessments.toLocaleString()} completed assessments
                        </p>
                      )}
                    </div>
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${tone}`}>
                      <Icon size={21} stroke={1.8} />
                    </span>
                  </div>
                </article>
              ))}
            </section>

            <div className="grid min-w-0 gap-6 lg:grid-cols-3">
              <div className="min-w-0 lg:col-span-2">
                <ChartCard title="Student Registrations" subtitle="New student accounts during the last 6 months" icon={IconChartHistogram}>
                  <div className="h-72 min-w-0"><Line data={chartData.registrations} options={lineOptions} /></div>
                </ChartCard>
              </div>
              <ChartCard title="Assessment Completion Rate" subtitle="Completed assessments among registered students" icon={IconChartDonut3}>
                <div className="relative h-72 min-w-0">
                  {dashboard.summary.registeredStudents > 0 ? (
                    <>
                      <Doughnut data={chartData.completion} options={doughnutOptions} />
                      <div className="pointer-events-none absolute inset-x-0 top-[39%] text-center">
                        <p className="text-2xl font-bold text-slate-900">{dashboard.summary.assessmentCompletionRate}%</p>
                        <p className="text-xs text-slate-500">complete</p>
                      </div>
                    </>
                  ) : <EmptyState>No registered students yet.</EmptyState>}
                </div>
              </ChartCard>
            </div>

            <div className="grid min-w-0 gap-6 lg:grid-cols-3">
              <div className="min-w-0 lg:col-span-2">
                <ChartCard title="Course Popularity" subtitle="Appearances in each student's latest saved Top 3 recommendations" icon={IconChartHistogram}>
                  <div className="h-96 min-w-0">
                    {dashboard.coursePopularity.length > 0
                      ? <Bar data={chartData.popularity} options={barOptions} />
                      : <EmptyState>No saved course recommendations yet.</EmptyState>}
                  </div>
                </ChartCard>
              </div>

              <ChartCard title="Top Recommended Courses" subtitle="Highest-frequency individual courses" icon={IconListNumbers}>
                {dashboard.topRecommendedCourses.length > 0 ? (
                  <ol className="divide-y divide-slate-100">
                    {dashboard.topRecommendedCourses.map((course, index) => (
                      <li key={course.courseId} className="flex items-center gap-3 py-4 first:pt-0 last:pb-0">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-50 text-sm font-bold text-orange-700">{index + 1}</span>
                        <div className="min-w-0 flex-1">
                          {course.courseCode ? <><p className="truncate text-sm font-semibold text-slate-800">{course.courseCode}</p><CourseName name={course.courseName} className="text-sm text-slate-500" secondaryClassName="mt-0.5 text-sm text-slate-400" /></> : <CourseName name={course.courseName} className="text-sm font-semibold text-slate-800" secondaryClassName="mt-0.5 text-sm font-normal text-slate-500" />}
                        </div>
                        <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-600">{course.count}</span>
                      </li>
                    ))}
                  </ol>
                ) : <EmptyState>No saved course recommendations yet.</EmptyState>}
              </ChartCard>
            </div>

            <ChartCard title="Recently Registered Users" subtitle="Newest student accounts" icon={IconUserPlus}>
              {dashboard.recentlyRegisteredUsers.length > 0 ? (
                <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                  {dashboard.recentlyRegisteredUsers.map((user) => (
                    <li key={user.userId} className="rounded-lg border border-slate-100 bg-slate-50/60 p-4">
                      <p className="truncate text-sm font-semibold text-slate-800">{user.username}</p>
                      <time className="mt-1 block text-xs text-slate-500" dateTime={user.registeredAt}>
                        {formatRegistrationDate(user.registeredAt)}
                      </time>
                    </li>
                  ))}
                </ol>
              ) : <EmptyState>No registered students yet.</EmptyState>}
            </ChartCard>
          </div>
        )}
      </main>
    </div>
  )
}

export default AdminDashboard
