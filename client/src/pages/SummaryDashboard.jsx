import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconArrowRight, IconRefresh, IconSchool, IconHistory, IconUser, IconHeart, IconBrain, IconShieldCheck, IconStar } from '@tabler/icons-react'
import { beginAssessmentAttempt } from '../utils/assessmentSession'

const personalFactorLabels = {
  factor_physical_impact: 'Physical / accessibility',
  factor_health_impact: 'Health-related needs',
  factor_financial_impact: 'Financial circumstances',
  factor_family_impact: 'Family responsibilities',
  factor_work_impact: 'Work responsibilities',
}

const apiUrl = import.meta.env.VITE_API_URL || ''

function SummaryDashboard() {
  const navigate = useNavigate()
  const token = localStorage.getItem('token')
  const userId = localStorage.getItem('userId')
  const username = localStorage.getItem('username')

  const [loading, setLoading] = useState(true)
  const [topRecommendation, setTopRecommendation] = useState(null)
  const [topCourseDetail, setTopCourseDetail] = useState(null)
  const [interests, setInterests] = useState([])
  const [domainScores, setDomainScores] = useState({})
  const [profile, setProfile] = useState(null)
  const [mbti, setMbti] = useState(null)

  useEffect(() => {
    if (!token) {
      navigate('/login')
      return
    }

    const fetchSummary = async () => {
      try {
        const headers = { Authorization: `Bearer ${token}` }
        const [resultsRes, interestsRes, quizRes, profileRes, mbtiRes] = await Promise.all([
          fetch(`${import.meta.env.VITE_API_URL}/api/results`, { headers }),
          fetch(`${import.meta.env.VITE_API_URL}/api/interests`, { headers }),
          fetch(`${import.meta.env.VITE_API_URL}/api/quiz/results`, { headers }),
          fetch(`${import.meta.env.VITE_API_URL}/api/profile?userId=${userId}`, { headers }),
          fetch(`${import.meta.env.VITE_API_URL}/api/mbti`, { headers }),
        ])

        const resultsData = await resultsRes.json()
        const interestsData = await interestsRes.json()
        const quizData = await quizRes.json()
        const profileData = await profileRes.json()
        const mbtiData = await mbtiRes.json()
 
        const top = resultsData.recommendations?.[0] || null
        if (top) {
          setTopRecommendation(top)
          // Fetch course description for the top recommendation's career path preview
          const courseRes = await fetch(`${apiUrl}/api/public/courses/${encodeURIComponent(top.course_code)}`)
          const courseData = await courseRes.json()
          setTopCourseDetail(courseData.course || null)
        }
 
        setInterests(interestsData.interests || [])
        setDomainScores(quizData.domainScores || {})
        if (profileData.username) localStorage.setItem('username', profileData.username)
        setProfile(profileData.profile ? { ...profileData.profile, username: profileData.username } : null)
        setMbti(mbtiData.mbtiType ? mbtiData : null)
      } catch (error) {
        console.error('Summary fetch error:', error)
      } finally {
        setLoading(false)
      }
    }
 
    fetchSummary()
  }, [navigate, token, userId])
 
  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('userId')
    localStorage.removeItem('username')
    navigate('/login')
  }

  const handleRetake = async () => {
    const response = await fetch(`${apiUrl}/api/assessment-attempts`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}` },
    })
    const data = await response.json()
    if (!response.ok) return
    beginAssessmentAttempt(sessionStorage, data.attemptId)
    navigate('/onboarding/profile')
  }
 
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-white">
        <span className="text-2xl font-bold animate-pulse">
          Learn<span className="text-orange-500">Match</span>
        </span>
        <p className="text-sm text-gray-400">Loading your summary...</p>
      </div>
    )
  }
 
  const checkedFactors = profile
    ? Object.entries(personalFactorLabels)
        .filter(([key]) => Number(profile[key]) > 1)
        .map(([key, label]) => `${label}: ${profile[key]}/4`)
    : []

  const skillTotals = Object.values(domainScores).reduce(
    (totals, score) => ({ correct: totals.correct + score.correct, total: totals.total + score.total }),
    { correct: 0, total: 0 }
  )
  const skillPercent = skillTotals.total ? Math.round((skillTotals.correct / skillTotals.total) * 100) : null
 
  const mbtiDimensionLabels = {
    EI: ['E', 'I'],
    NS: ['N', 'S'],
    TF: ['T', 'F'],
    JP: ['J', 'P'],
  }
 
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#fbf8f3] text-gray-900">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[620px] bg-[radial-gradient(circle_at_12%_15%,rgba(251,146,60,.1),transparent_27%),radial-gradient(circle_at_85%_20%,rgba(253,186,116,.08),transparent_25%),linear-gradient(115deg,rgba(255,255,255,.72),rgba(255,247,237,.2))]" />
      <nav className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-gray-100 px-5 sm:px-8 lg:px-14 py-4 flex flex-wrap justify-between items-center gap-3">
        <button
          onClick={() => navigate('/dashboard')}
          className="text-lg font-bold text-gray-900 hover:opacity-80 transition"
        >
          Learn<span className="text-orange-500">Match</span>
        </button>
        <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-4">
          <span className="hidden md:inline text-sm text-gray-500">
            Welcome, <strong className="text-gray-900">{username}</strong>
          </span>
          <button
            onClick={() => navigate('/profile', { state: { assessmentComplete: true } })}
            className="bg-orange-500 text-white px-4 py-2.5 rounded-xl text-xs font-medium hover:bg-orange-600 transition"
          >
             View Profile
          </button>
          <button
            onClick={() => navigate('/feedback', { state: { entryContext: 'dashboard' } })}
            className="text-sm text-gray-500 hover:text-gray-900 transition"
          >
            Feedback
          </button>
          <button
            onClick={handleLogout}
            className="bg-red-50 text-red-600 px-4 py-2.5 rounded-xl text-xs font-medium hover:bg-red-100 transition"
          >
            Logout
          </button>
        </div>
      </nav>
 
      <main className="relative z-0 mx-auto max-w-[1240px] px-5 py-8 sm:px-8 sm:py-11 lg:px-12">

        <div className="mb-7">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-orange-600">Assessment Summary</p>
          <h1 className="text-3xl font-bold tracking-[-0.03em] text-gray-950 sm:text-4xl">Your LearnMatch report</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-500">A consolidated view of your profile, assessment results, personal considerations, and recommended direction.</p>
        </div>
 
        {/* Top recommendation preview */}
        {topRecommendation && (
          <section className="relative mb-10 overflow-hidden rounded-[26px] border border-orange-200/80 bg-[#fffdf9] p-6 shadow-[0_22px_60px_-42px_rgba(120,53,15,.5)] sm:flex sm:items-center sm:justify-between sm:gap-8 sm:p-8">
            <div className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-orange-400 via-orange-500 to-amber-300" aria-hidden="true" />
            <div className="relative min-w-0">
              <p className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-orange-600">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-100"><IconStar size={15} fill="currentColor" stroke={1.7} /></span> Top Recommendation
              </p>
              <p className="mb-4 max-w-3xl text-xl font-bold leading-snug tracking-tight text-gray-950 sm:text-2xl">
                {topRecommendation.course_name}
              </p>
              <div className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3 py-1.5 text-sm font-semibold text-orange-800">
                <span className="h-2 w-2 rounded-full bg-orange-500" /> {topRecommendation.match_score}% overall match
              </div>
            </div>
            <button
              onClick={() => navigate('/results')}
              className="relative mt-5 inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-orange-200 bg-white px-5 py-3 text-sm font-bold text-orange-700 shadow-sm transition duration-150 hover:-translate-y-0.5 hover:border-orange-300 hover:bg-orange-50 sm:mt-0"
            >
              View Full Results <IconArrowRight size={16} stroke={2} />
            </button>
          </section>
        )}

        <div className="mb-5">
          <p className="text-xs font-bold uppercase tracking-[0.17em] text-orange-600">Your Assessment</p>
          <h2 className="mt-1 text-xl font-bold tracking-tight text-gray-950">Assessment overview</h2>
        </div>
 
        {/* Assessment overview */}
        <div className="mb-10 grid items-start gap-5 md:grid-cols-2">
          <div className="space-y-5">
          <section className="rounded-2xl border border-white/90 bg-white/78 p-5 shadow-[0_18px_48px_-40px_rgba(120,53,15,.5)] sm:p-6">
            <div className="flex items-center gap-3 mb-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-600"><IconUser size={20} stroke={1.8} /></span>
              <div><p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Your Profile</p><p className="text-sm font-bold text-gray-900">Personal details</p></div>
            </div>
            {profile ? (
              <div className="space-y-1.5">
                <p className="text-sm text-gray-900 font-medium">{profile.username}</p>
              </div>
            ) : (
              <p className="text-sm text-gray-400">No profile info yet.</p>
            )}
          </section>
 
          <section className="rounded-2xl border border-white/90 bg-white/78 p-5 shadow-[0_18px_48px_-40px_rgba(120,53,15,.5)] sm:p-6">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600"><IconShieldCheck size={20} stroke={1.8} /></span><div><p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Personal Factors</p><p className="text-sm font-bold text-gray-900">Recommendation considerations</p></div></div>
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${checkedFactors.length ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>{checkedFactors.length ? 'Adjusted' : 'Neutral'}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {checkedFactors.length > 0 ? (
                checkedFactors.map((label) => (
                  <span
                    key={label}
                    className="text-xs px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-800 font-medium"
                  >
                    {label}
                  </span>
                ))
              ) : (
                <p className="text-sm text-gray-400">All scored responses indicate no current impact.</p>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-white/90 bg-white/78 p-5 shadow-[0_18px_48px_-40px_rgba(120,53,15,.5)] sm:p-6">
            <div className="flex items-center gap-3 mb-4"><span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-50 text-orange-600"><IconHeart size={20} stroke={1.8} /></span><div><p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Your Interests</p><p className="text-sm font-bold text-gray-900">{interests.length} selected hobbies</p></div></div>
            <div className="flex flex-wrap gap-2">
              {interests.length > 0 ? (
                interests.map((interest) => (
                  <span
                    key={interest}
                    className="text-xs px-3 py-1.5 rounded-full bg-orange-50 text-orange-700 font-medium"
                  >
                    {interest}
                  </span>
                ))
              ) : (
                <p className="text-sm text-gray-400">No interests recorded yet.</p>
              )}
            </div>
          </section>
          </div>

          <section className="rounded-2xl border border-white/90 bg-white/78 p-5 shadow-[0_18px_48px_-40px_rgba(120,53,15,.5)] sm:p-6">
            <div className="flex items-center justify-between gap-3 mb-4"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-50 text-violet-600"><IconBrain size={20} stroke={1.8} /></span><div><p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Skills Quiz</p><p className="text-sm font-bold text-gray-900">{skillTotals.total ? `${skillTotals.correct} of ${skillTotals.total} correct` : 'No result yet'}</p></div></div>{skillPercent !== null && <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-bold text-violet-700">{skillPercent}%</span>}</div>
            <div className="flex flex-col gap-3">
              {Object.keys(domainScores).length > 0 ? (
                Object.entries(domainScores).map(([domain, score]) => (
                  <div key={domain}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-600">{domain}</span>
                      <span className="text-gray-900 font-medium">
                        {score.correct}/{score.total}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-violet-400 to-violet-600"
                        style={{ width: `${(score.correct / score.total) * 100}%` }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-400">No quiz results yet.</p>
              )}
            </div>
          </section>
        </div>
 
        {/* MBTI */}
        <div className="mb-5">
          <p className="text-xs font-bold uppercase tracking-[0.17em] text-orange-600">Personality</p>
          <h2 className="mt-1 text-xl font-bold tracking-tight text-gray-950">Personality profile</h2>
        </div>
        <section className="mb-10 rounded-[26px] border border-white/90 bg-white/78 p-5 shadow-[0_20px_55px_-42px_rgba(120,53,15,.5)] sm:p-7">
          {mbti ? (
            <div className="grid gap-6 md:grid-cols-[13rem_minmax(0,1fr)] md:items-center">
              <div className="rounded-2xl bg-slate-950 p-5 text-white shadow-[0_16px_34px_-24px_rgba(15,23,42,.75)]"><p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Personality Type</p><p className="mt-2 text-4xl font-black tracking-[0.16em] text-orange-400">{mbti.mbtiType}</p><p className="mt-2 text-xs leading-relaxed text-slate-400">Your four-letter preference profile</p></div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {Object.entries(mbtiDimensionLabels).map(([key, [first, second]]) => {
                  const percent = Math.round(mbti.scores[key])
                  return (
                    <div key={key}>
                      <div className="flex justify-between text-[11px] text-gray-500 mb-1">
                        <span>{first}</span>
                        <span>{second}</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-orange-400 to-orange-600 rounded-full"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400">
              Coming soon — take the Personality assessment to see your MBTI type here.
            </p>
          )}
        </section>
 
        {/* Career Path preview for top recommendation */}
        {topRecommendation && (
          <section className="mb-10">
            <div className="mb-5">
              <p className="text-xs font-bold uppercase tracking-[0.17em] text-orange-600">Course &amp; Career Overview</p>
              <h2 className="mt-1 text-xl font-bold tracking-tight text-gray-950">Your recommended direction</h2>
            </div>
          <div className="overflow-hidden rounded-[26px] border border-white/90 bg-white/78 shadow-[0_20px_55px_-42px_rgba(120,53,15,.5)]">
            <div className="flex flex-col gap-3 border-b border-orange-100/70 bg-orange-50/40 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
              <div><p className="text-[11px] font-semibold uppercase tracking-wide text-orange-500">
                Career Path — {topRecommendation.course_name}
              </p><p className="mt-1 text-sm font-bold text-gray-900">Full course and career overview</p></div>
              <button
                onClick={() => navigate('/results/career-path')}
                className="text-xs font-medium text-orange-500 hover:text-orange-600 transition inline-flex items-center gap-1 shrink-0"
              >
                Explore Detailed Career Path →
              </button>
            </div>
            <div className="grid gap-7 p-5 sm:p-7 lg:grid-cols-[minmax(0,1.65fr)_minmax(17rem,1fr)]">
              <div><p className="text-sm text-gray-600 leading-7 mb-5">{topCourseDetail?.description || 'Course description not yet available.'}</p>
            <p className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-3">Obtainable Skills</p>
            <div className="flex flex-wrap gap-2">
              {(topCourseDetail?.obtainable_skills || []).map((skill) => (
                <span
                  key={skill}
                  className="text-xs px-3 py-1.5 rounded-full bg-orange-50 text-orange-700 font-medium"
                >
                  {skill}
                </span>
              ))}
            </div></div>
            <div className="lg:border-l lg:border-gray-100 lg:pl-7"><p className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">Career Opportunities</p>
            <p className="text-xs text-gray-400 mb-3">Salary figures are estimates and may vary by employer, experience, location, and industry.</p>
            <div className="space-y-2">
              {(topCourseDetail?.career_opportunities || []).map((job) => (
                <div key={job.career_id} className="flex justify-between items-center gap-4 rounded-xl bg-gray-50 px-3 py-2.5 text-sm">
                  <span className="text-gray-700">{job.career_title}</span>
                  <span className="text-xs text-gray-400 text-right">{job.estimated_monthly_salary_php?.display}</span>
                </div>
              ))}
            </div></div>
            </div>
          </div>
          </section>
        )}
 
 
        {/* Action buttons */}
        <div className="mb-5">
          <p className="text-xs font-bold uppercase tracking-[0.17em] text-orange-600">Actions</p>
          <h2 className="mt-1 text-xl font-bold tracking-tight text-gray-950">Continue your LearnMatch journey</h2>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <button
            onClick={handleRetake}
            className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-700 shadow-sm transition duration-150 hover:border-orange-200 hover:bg-orange-50 hover:text-orange-700"
          >
            <IconRefresh size={16} stroke={2} /> Retake Assessment
          </button>
          <button
            onClick={() => navigate('/college/setup')}
            className="flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-6 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_-12px_rgba(234,88,12,.8)] transition duration-150 hover:-translate-y-0.5 hover:bg-orange-600 active:translate-y-0"
          >
            <IconSchool size={16} stroke={2} /> Go to College Phase
          </button>
          <button
            onClick={() => navigate('/assessment-history')}
            className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-700 shadow-sm transition duration-150 hover:border-orange-200 hover:bg-orange-50 hover:text-orange-700"
          >
            <IconHistory size={16} stroke={2} /> Assessment History
          </button>
        </div>
 
      </main>
    </div>
  )
}
 
export default SummaryDashboard
