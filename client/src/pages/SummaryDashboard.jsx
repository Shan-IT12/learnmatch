import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconArrowRight, IconRefresh, IconSchool, IconHistory } from '@tabler/icons-react'

const personalFactorLabels = {
  factor_physical: 'Physical / Mobility Condition',
  factor_health: 'Health Condition',
  factor_financial: 'Financial Constraint',
  factor_family: 'Family Obligation',
  factor_distance: 'Distance / Commute',
  factor_working_student: 'Working Student',
}

// Same placeholder data used in CareerPath.jsx — replace once
// CAREER_ROADMAP / CAREER_OPPORTUNITY tables are populated.
const placeholderSkills = [
  'Problem Solving', 'Technical Communication', 'Analytical Thinking',
  'Project Management', 'Research Methods',
]
 
const placeholderOpportunities = [
  { title: 'Entry-Level Role in the Field', salary: '₱18,000 - ₱28,000/month' },
  { title: 'Mid-Level Specialist', salary: '₱30,000 - ₱50,000/month' },
]

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
          const courseRes = await fetch(`${import.meta.env.VITE_API_URL}/api/courses/${top.course_id}`)
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
 
  const mbtiDimensionLabels = {
    EI: ['E', 'I'],
    NS: ['N', 'S'],
    TF: ['T', 'F'],
    JP: ['J', 'P'],
  }
 
  return (
    <div className="min-h-screen bg-white">
      <nav className="bg-white border-b border-gray-100 px-14 py-[18px] flex justify-between items-center">
        <span className="text-lg font-bold text-gray-900">
          Learn<span className="text-orange-500">Match</span>
        </span>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">
            Welcome, <strong className="text-gray-900">{username}</strong>
          </span>
          <button
            onClick={() => navigate('/profile')}
            className="bg-orange-500 text-white px-4 py-2.5 rounded-xl text-xs font-medium hover:bg-orange-600 transition"
          >
            Edit Profile
          </button>
          <button
            onClick={handleLogout}
            className="bg-red-50 text-red-600 px-4 py-2.5 rounded-xl text-xs font-medium hover:bg-red-100 transition"
          >
            Logout
          </button>
        </div>
      </nav>
 
      <div className="max-w-[1320px] mx-auto px-14 py-11">
 
        {/* Top recommendation preview */}
        {topRecommendation && (
          <div
            className="rounded-[20px] p-8 mb-5 flex justify-between items-center shadow-[0_8px_30px_-8px_rgba(249,115,22,0.35)]"
            style={{ background: 'linear-gradient(135deg, #ffe4c4 0%, #ffd0a8 40%, #ffb8a8 100%)' }}
          >
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: '#b45309' }}>
                Top Recommendation
              </p>
              <p className="text-xl font-bold mb-1" style={{ color: '#2b1002' }}>
                {topRecommendation.course_name}
              </p>
              <p className="text-sm" style={{ color: '#7c3f0e' }}>
                {topRecommendation.match_score}% match
              </p>
            </div>
            <button
              onClick={() => navigate('/results')}
              className="inline-flex items-center gap-1.5 bg-gray-900 text-white px-5 py-3 rounded-xl text-sm font-medium hover:bg-gray-800 hover:-translate-y-0.5 hover:shadow-lg transition-all duration-200 shrink-0"
            >
              View Full Results <IconArrowRight size={16} stroke={2} />
            </button>
          </div>
        )}
 
        {/* Profile + Personal Factors */}
        <div className="grid grid-cols-2 gap-5 mb-5">
 
          <div className="rounded-[20px] px-7 py-6 border border-gray-100 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide mb-4 text-gray-400">
              Your Profile
            </p>
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
 
          <div className="rounded-[20px] px-7 py-6 border border-gray-100 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide mb-4 text-gray-400">
              Personal Factors
            </p>
            <div className="flex flex-wrap gap-2">
              {checkedFactors.length > 0 ? (
                checkedFactors.map((label) => (
                  <span
                    key={label}
                    className="text-xs px-3 py-1.5 rounded-full bg-gray-100 text-gray-600 font-medium"
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
        <div className="grid grid-cols-2 gap-5 mb-5">
 
          <div className="rounded-[20px] px-7 py-6 border border-gray-100 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide mb-4 text-gray-400">
              Your Interests
            </p>
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
 
          <div className="rounded-[20px] px-7 py-6 border border-gray-100 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide mb-4 text-gray-400">
              Skills Quiz Results
            </p>
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
                        className="h-full bg-orange-500 rounded-full"
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
        <div className="rounded-[20px] px-7 py-6 border border-gray-100 shadow-sm mb-5">
          <p className="text-[11px] font-semibold uppercase tracking-wide mb-4 text-gray-400">
            Personality Type
          </p>
          {mbti ? (
            <div>
              <p className="text-2xl font-bold text-orange-500 mb-4">{mbti.mbtiType}</p>
              <div className="grid grid-cols-4 gap-4">
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
                          className="h-full bg-orange-500 rounded-full"
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
          <div className="rounded-[20px] px-7 py-6 border border-gray-100 shadow-sm mb-5">
            <div className="flex justify-between items-start mb-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                Career Path — {topRecommendation.course_name}
              </p>
              <button
                onClick={() => navigate(`/results/career-path/${topRecommendation.course_id}`)}
                className="text-xs font-medium text-orange-500 hover:text-orange-600 transition inline-flex items-center gap-1 shrink-0"
              >
                View Full Career Path →
              </button>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed mb-4 max-w-3xl">
              {topCourseDetail?.description || 'Course description not yet available.'}
            </p>
 
            <p className="text-xs font-semibold text-gray-700 mb-2">Obtainable Skills</p>
            <p className="text-xs text-orange-400 mb-3">Placeholder — actual skills coming soon</p>
            <div className="flex flex-wrap gap-2 mb-5">
              {placeholderSkills.map((skill) => (
                <span
                  key={skill}
                  className="text-xs px-3 py-1.5 rounded-full bg-orange-50 text-orange-700 font-medium"
                >
                  {skill}
                </span>
              ))}
            </div>
 
            <p className="text-xs font-semibold text-gray-700 mb-2">Career Opportunities</p>
            <p className="text-xs text-orange-400 mb-3">Placeholder — actual opportunities coming soon</p>
            <div className="space-y-2">
              {placeholderOpportunities.map((job) => (
                <div key={job.title} className="flex justify-between items-center text-sm">
                  <span className="text-gray-700">{job.title}</span>
                  <span className="text-xs text-gray-400">{job.salary}</span>
                </div>
              ))}
            </div>
          </div>
        )}
 
        {/* MBTI placeholder removed — replaced with real section above */}
 
        {/* Action buttons */}
        <div className="grid grid-cols-3 gap-4">
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