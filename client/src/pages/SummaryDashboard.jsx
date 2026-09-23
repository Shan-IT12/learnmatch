import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconArrowRight, IconRefresh, IconSchool, IconHistory, IconUser, IconHeart, IconBrain, IconShieldCheck } from '@tabler/icons-react'

const personalFactorLabels = {
  factor_physical: 'Physical / Mobility Condition',
  factor_health: 'Health Condition',
  factor_financial: 'Financial Constraint',
  factor_family: 'Family Obligation',
  factor_distance: 'Distance / Commute',
  factor_working_student: 'Working Student',
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
        setProfile(profileData.profile || null)
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
 
  // Compute BMI for the profile summary card, if height/weight are set
  let bmi = null
  let bmiLabel = ''
  if (profile?.height_cm && profile?.weight_kg) {
    const heightInMeters = profile.height_cm / 100
    bmi = (profile.weight_kg / (heightInMeters * heightInMeters)).toFixed(1)
    if (bmi < 18.5) bmiLabel = 'Underweight'
    else if (bmi < 25) bmiLabel = 'Normal'
    else if (bmi < 30) bmiLabel = 'Overweight'
    else bmiLabel = 'Obese'
  }
 
  const checkedFactors = profile
    ? Object.entries(personalFactorLabels)
        .filter(([key]) => profile[key])
        .map(([, label]) => label)
    : []
  if (profile?.factor_others) {
    checkedFactors.push(`Other: ${profile.factor_others}`)
  }

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
    <div className="min-h-screen bg-slate-50/70">
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
            onClick={() => navigate('/feedback')}
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
 
      <div className="max-w-[1240px] mx-auto px-5 sm:px-8 lg:px-12 py-8 sm:py-11">

        <div className="mb-7">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-orange-500 mb-2">Your complete LearnMatch report</p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-950">Assessment Summary</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-500">A consolidated view of your profile, assessment results, personal considerations, and recommended direction.</p>
        </div>
 
        {/* Top recommendation preview */}
        {topRecommendation && (
          <div className="relative overflow-hidden rounded-3xl p-6 sm:p-8 mb-5 flex flex-col sm:flex-row gap-6 sm:justify-between sm:items-center bg-gradient-to-br from-orange-500 via-orange-500 to-amber-400 shadow-[0_20px_50px_-28px_rgba(234,88,12,0.75)]">
            <div className="absolute -right-12 -top-20 h-56 w-56 rounded-full border-[36px] border-white/10" aria-hidden="true" />
            <div className="relative min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] mb-2 text-orange-100">
                Top Recommendation
              </p>
              <p className="text-xl sm:text-2xl font-bold mb-2 text-white leading-snug">
                {topRecommendation.course_name}
              </p>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-sm font-semibold text-white ring-1 ring-white/20">
                <span className="h-2 w-2 rounded-full bg-white" /> {topRecommendation.match_score}% overall match
              </div>
            </div>
            <button
              onClick={() => navigate('/results')}
              className="relative inline-flex items-center justify-center gap-1.5 bg-white text-orange-700 px-5 py-3 rounded-xl text-sm font-bold hover:-translate-y-0.5 hover:shadow-lg transition-all duration-200 shrink-0"
            >
              View Full Results <IconArrowRight size={16} stroke={2} />
            </button>
          </div>
        )}
 
        {/* Profile + Personal Factors */}
        <div className="grid md:grid-cols-2 gap-5 mb-5">
 
          <div className="rounded-3xl p-5 sm:p-6 border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-600"><IconUser size={20} stroke={1.8} /></span>
              <div><p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Your Profile</p><p className="text-sm font-bold text-gray-900">Personal details</p></div>
            </div>
            {profile ? (
              <div className="space-y-1.5">
                <p className="text-sm text-gray-900 font-medium">{profile.full_name}</p>
                {bmi && (
                  <p className="text-xs text-gray-500">
                    BMI: {bmi} ({bmiLabel})
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-400">No profile info yet.</p>
            )}
          </div>
 
          <div className="rounded-3xl p-5 sm:p-6 border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600"><IconShieldCheck size={20} stroke={1.8} /></span><div><p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Personal Factors</p><p className="text-sm font-bold text-gray-900">Recommendation considerations</p></div></div>
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${checkedFactors.length ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>{checkedFactors.length ? 'Considered' : 'None selected'}</span>
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
                <p className="text-sm text-gray-400">No personal factors selected.</p>
              )}
            </div>
          </div>
        </div>
 
        {/* Interests + Skills */}
        <div className="grid md:grid-cols-2 gap-5 mb-5">
 
          <div className="rounded-3xl p-5 sm:p-6 border border-gray-200 bg-white shadow-sm">
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
          </div>
 
          <div className="rounded-3xl p-5 sm:p-6 border border-gray-200 bg-white shadow-sm">
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
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-violet-500 rounded-full"
                        style={{ width: `${(score.correct / score.total) * 100}%` }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-400">No quiz results yet.</p>
              )}
            </div>
          </div>
        </div>
 
        {/* MBTI */}
        <div className="rounded-3xl p-5 sm:p-7 border border-gray-200 bg-white shadow-sm mb-5">
          {mbti ? (
            <div className="grid gap-6 md:grid-cols-[13rem_minmax(0,1fr)] md:items-center">
              <div className="rounded-2xl bg-slate-950 p-5 text-white"><p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Personality Type</p><p className="mt-2 text-4xl font-black tracking-[0.16em] text-orange-400">{mbti.mbtiType}</p><p className="mt-2 text-xs leading-relaxed text-slate-400">Your four-letter preference profile</p></div>
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
        </div>
 
        {/* Career Path preview for top recommendation */}
        {topRecommendation && (
          <div className="rounded-3xl border border-gray-200 bg-white shadow-sm mb-5 overflow-hidden">
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center border-b border-gray-100 bg-gray-50/70 px-5 py-4 sm:px-7">
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
            <div className="grid gap-7 p-5 sm:p-7 lg:grid-cols-[minmax(0,1.3fr)_minmax(17rem,.7fr)]">
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
        )}
 
        {/* MBTI placeholder removed — replaced with real section above */}
 
        {/* Action buttons */}
        <div className="grid sm:grid-cols-3 gap-4">
          <button
            onClick={() => navigate('/onboarding/profile')}
            className="flex items-center justify-center gap-2 bg-gray-900 text-white px-5 py-4 rounded-xl text-sm font-medium hover:bg-gray-800 transition"
          >
            <IconRefresh size={16} stroke={2} /> Retake Assessment
          </button>
          <button
            onClick={() => navigate('/college/setup')}
            className="flex items-center justify-center gap-2 bg-orange-500 text-white px-5 py-4 rounded-xl text-sm font-medium hover:bg-orange-600 transition"
          >
            <IconSchool size={16} stroke={2} /> Go to College Phase
          </button>
          <button
            disabled
            className="flex items-center justify-center gap-2 bg-gray-100 text-gray-400 px-5 py-4 rounded-xl text-sm font-medium cursor-not-allowed"
          >
            <IconHistory size={16} stroke={2} /> Assessment History
          </button>
        </div>
 
      </div>
    </div>
  )
}
 
export default SummaryDashboard
