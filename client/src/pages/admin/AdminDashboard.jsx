import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArcElement, BarElement, CategoryScale, Chart as ChartJS, Legend, LineElement,
  LinearScale, PointElement, Tooltip,
} from 'chart.js'
import { Bar, Doughnut, Line } from 'react-chartjs-2'
import {
  IconAlertTriangle, IconBook2, IconChartDonut3, IconChartHistogram,
  IconClipboardCheck, IconMessageReport, IconRefresh, IconUserPlus, IconUsers,
} from '@tabler/icons-react'
import AdminHeader from '../../components/AdminHeader'

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
    y: {
      beginAtZero: true,
      ticks: integerTicks,
      grid: { color: '#e2e8f0' },
      border: { display: false },
    },
  },
}

const doughnutOptions = {
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
        padding: 18,
        font: chartFont,
        color: '#374151',
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
  plugins: { legend: { display: false }, tooltip: { displayColors: false } },
  scales: {
    x: {
      beginAtZero: true,
      ticks: integerTicks,
      grid: { color: '#e2e8f0' },
      border: { display: false },
    },
    y: {
      ticks: { font: chartFont, color: '#374151', autoSkip: false, padding: 10 },
      grid: { display: false },
      border: { display: false },
    },
  },
}

const clusterAcronyms = { stem: 'STEM', ict: 'ICT', it: 'IT' }

function formatClusterLabel(cluster) {
  const displayLabel = cluster
    .replace(/\s+cluster$/i, '')
    .toLowerCase()
    .replace(/\b[a-z]+\b/g, (word) => clusterAcronyms[word] || `${word[0].toUpperCase()}${word.slice(1)}`)

  const lines = []
  for (const word of displayLabel.split(' ')) {
    const currentLine = lines.at(-1)
    if (!currentLine || `${currentLine} ${word}`.length > 21) lines.push(word)
    else lines[lines.length - 1] = `${currentLine} ${word}`
  }
  return lines
}

const metricDefinitions = [
  { key: 'totalUsers', label: 'Total Users', icon: IconUsers, tone: 'text-orange-700 bg-orange-50' },
  { key: 'activeCourses', label: 'Active Courses', icon: IconBook2, tone: 'text-amber-700 bg-amber-50' },
  { key: 'trackingStudents', label: 'Tracking Students', icon: IconClipboardCheck, tone: 'text-emerald-700 bg-emerald-50' },
  { key: 'flaggedStudents', label: 'Flagged Students', icon: IconAlertTriangle, tone: 'text-red-700 bg-red-50' },
]

const activityIcons = {
  registration: IconUserPlus,
  feedback: IconMessageReport,
  checkin: IconClipboardCheck,
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metricDefinitions.map(({ key }) => <div key={key} className="h-28 rounded-xl border border-slate-200 bg-white" />)}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="h-96 rounded-xl border border-slate-200 bg-white lg:col-span-2" />
        <div className="h-96 rounded-xl border border-slate-200 bg-white" />
      </div>
    </div>
  )
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
    return {
      registrations: {
        labels: dashboard.registrationTrend.map(({ label }) => label),
        datasets: [{
          data: dashboard.registrationTrend.map(({ count }) => count),
          borderColor: '#f97316',
          backgroundColor: '#f97316',
          pointBackgroundColor: '#ffffff',
          pointBorderColor: '#f97316',
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 5,
          borderWidth: 2,
          tension: 0,
        }],
      },
      alignment: {
        labels: dashboard.alignmentDistribution.map(({ status }) => status),
        datasets: [{
          data: dashboard.alignmentDistribution.map(({ count }) => count),
          backgroundColor: ['#10b981', '#f59e0b', '#dc2626'],
          borderColor: '#ffffff',
          borderWidth: 3,
          hoverOffset: 3,
        }],
      },
      clusters: {
        labels: dashboard.recommendedClusters.map(({ cluster }) => formatClusterLabel(cluster)),
        datasets: [{
          data: dashboard.recommendedClusters.map(({ count }) => count),
          backgroundColor: '#f97316',
          borderRadius: 4,
          barThickness: 22,
        }],
      },
    }
  }, [dashboard])

  const alignmentTotal = dashboard?.alignmentDistribution.reduce((sum, item) => sum + item.count, 0) || 0

  return (
    <div className="min-h-screen bg-[#fcfaf7]">
      <AdminHeader currentPage="dashboard" />
      <main className="mx-auto max-w-[1440px] px-5 py-8 sm:px-8 sm:py-10 lg:px-10">
        <div className="mb-7 border-b border-slate-200 pb-6">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-orange-600">Administration</p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950">Dashboard</h1>
          <p className="mt-2 text-sm text-slate-600">Overview of LearnMatch system activity and student alignment</p>
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
            <section aria-label="System summary" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {metricDefinitions.map(({ key, label, icon: Icon, tone }) => (
                <article key={key} className="rounded-xl border border-orange-100 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-3xl font-bold tabular-nums tracking-tight text-slate-950">{dashboard.summary[key].toLocaleString()}</p>
                      <p className="mt-1 text-[15px] font-medium text-slate-600">{label}</p>
                    </div>
                    <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${tone}`}>
                      <Icon size={21} stroke={1.8} />
                    </span>
                  </div>
                </article>
              ))}
            </section>

            <div className="grid min-w-0 gap-6 lg:grid-cols-3">
              <div className="min-w-0 lg:col-span-2">
                <ChartCard title="User Registrations" subtitle="New student accounts during the last 6 months" icon={IconChartHistogram}>
                  <div className="h-72 min-w-0"><Line data={chartData.registrations} options={lineOptions} /></div>
                </ChartCard>
              </div>
              <ChartCard title="Career Alignment Status" subtitle="Latest completed check-in per tracking student" icon={IconChartDonut3}>
                <div className="h-72 min-w-0">
                  {alignmentTotal > 0
                    ? <Doughnut data={chartData.alignment} options={doughnutOptions} />
                    : <EmptyState>No Career Alignment Tracking data yet.</EmptyState>}
                </div>
              </ChartCard>
            </div>

            <div className="grid min-w-0 gap-6 lg:grid-cols-3">
              <div className="min-w-0 lg:col-span-2">
                <ChartCard title="Recommended Course Clusters" subtitle="Course clusters appearing in saved recommendation results" icon={IconChartHistogram}>
                  <div className="h-96 min-w-0">
                    {dashboard.recommendedClusters.length > 0
                      ? <Bar data={chartData.clusters} options={barOptions} />
                      : <EmptyState>No saved course recommendations yet.</EmptyState>}
                  </div>
                </ChartCard>
              </div>

              <ChartCard title="Recent Activity" subtitle={`${dashboard.summary.totalFeedback.toLocaleString()} feedback submissions recorded`} icon={IconClipboardCheck}>
                {dashboard.recentActivity.length > 0 ? (
                  <ol className="divide-y divide-slate-100">
                    {dashboard.recentActivity.map((activity, index) => {
                      const ActivityIcon = activityIcons[activity.type] || IconClipboardCheck
                      return (
                        <li key={`${activity.type}-${activity.occurredAt}-${index}`} className="flex gap-3.5 py-4 first:pt-0 last:pb-0">
                          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orange-50 text-orange-600">
                            <ActivityIcon size={16} stroke={1.8} />
                          </span>
                          <div className="min-w-0">
                            <p className="text-[15px] leading-6 text-slate-700">{activity.detail}</p>
                            <time className="mt-1 block text-sm text-slate-400" dateTime={activity.occurredAt}>
                              {new Intl.DateTimeFormat('en-PH', {
                                timeZone: 'Asia/Manila',
                                month: 'short', day: 'numeric', year: 'numeric',
                                hour: 'numeric', minute: '2-digit',
                              }).format(new Date(activity.occurredAt))}
                            </time>
                          </div>
                        </li>
                      )
                    })}
                  </ol>
                ) : <EmptyState>No recent system activity yet.</EmptyState>}
              </ChartCard>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default AdminDashboard
