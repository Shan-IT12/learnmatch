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
  IconChartBar,
  IconChartDonut3,
  IconChecklist,
  IconRefresh,
  IconSparkles,
  IconUsers,
} from '@tabler/icons-react'
import AdminHeader from '../../components/AdminHeader'

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
  for (const word of String(label).split(' ')) {
    const current = lines.at(-1)
    if (!current || `${current} ${word}`.length > maxLength) lines.push(word)
    else lines[lines.length - 1] = `${current} ${word}`
  }
  return lines
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
        labels: analytics.topRecommendedCourses.map(({ courseName }) => wrapLabel(courseName)),
        datasets: [{
          data: analytics.topRecommendedCourses.map(({ count }) => count),
          backgroundColor: '#f97316',
          borderRadius: 4,
          barThickness: 22,
        }],
      },
    }
  }, [analytics])

  const completionTotal = analytics
    ? Object.values(analytics.assessmentCompletion).reduce((sum, count) => sum + count, 0)
    : 0

  const retry = () => {
    setLoading(true)
    setError('')
    setRetryKey((current) => current + 1)
  }

  return (
    <div className="min-h-screen bg-[#fcfaf7]">
      <AdminHeader currentPage="analytics" />
      <main className="mx-auto max-w-[1440px] px-5 py-8 sm:px-8 sm:py-10 lg:px-10">
        <div className="mb-7 border-b border-slate-200 pb-6">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-orange-600">Administration</p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950">Analytics &amp; System Monitoring</h1>
          <p className="mt-2 text-sm text-slate-600">Aggregate insights from student assessments and course recommendations.</p>
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
            <section aria-label="Analytics summary" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
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

            <ChartCard
              title="Average Skill Scores"
              subtitle="Average percentage correct by domain across valid latest 30-question assessments"
              icon={IconChartBar}
            >
              <div className="h-80 min-w-0 sm:h-96">
                {analytics.averageSkillScores.length > 0
                  ? <Bar data={chartData.skills} options={horizontalPercentOptions} />
                  : <EmptyState>No completed skill assessments are available yet.</EmptyState>}
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
              title="Top Recommended Courses"
              subtitle="Most frequent courses in each student's latest persisted Top 3 recommendation snapshot"
              icon={IconChartBar}
            >
              <div className="h-80 min-w-0 sm:h-96">
                {analytics.topRecommendedCourses.length > 0
                  ? <Bar data={chartData.courses} options={horizontalCountOptions} />
                  : <EmptyState>No persisted course recommendations are available yet.</EmptyState>}
              </div>
            </ChartCard>
          </div>
        )}
      </main>
    </div>
  )
}

export default AdminAnalytics
