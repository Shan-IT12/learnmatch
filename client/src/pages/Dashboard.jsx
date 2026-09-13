import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconArrowRight, IconBook2, IconBrain, IconCertificate, IconChecklist, IconCompass, IconHeart, IconSchool, IconUser } from '@tabler/icons-react'
import loadingGif from '../assets/loading2.gif'
import { getNextAssessmentRoute } from '../utils/assessmentNavigation'
import { getPhilippineDateTime } from '../utils/philippineDateTime'

const loadingMessages = ['Checking your progress...', 'Almost there...', 'Getting things ready...']

function Dashboard() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [loadingTextIndex, setLoadingTextIndex] = useState(0)
  const [hasProfile, setHasProfile] = useState(false)
  const [hasInterests, setHasInterests] = useState(false)
  const [hasSkills, setHasSkills] = useState(false)
  const [hasPersonality, setHasPersonality] = useState(false)
  const token = localStorage.getItem('token')
  const username = localStorage.getItem('username')
  const { greeting, formattedDate } = getPhilippineDateTime()

  useEffect(() => {
    if (!loading) return
    const interval = setInterval(() => setLoadingTextIndex((previous) => (previous + 1) % loadingMessages.length), 1400)
    return () => clearInterval(interval)
  }, [loading])

  useEffect(() => {
    if (!token) {
      navigate('/login')
      return
    }

    const checkStatus = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/dashboard/status`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const data = await response.json()
        if (data.isCollegePhase) navigate('/college')
        else if (data.hasInterests && data.hasSkills && data.hasPersonality) navigate('/dashboard/summary')
        else {
          setHasProfile(data.hasProfile)
          setHasInterests(data.hasInterests)
          setHasSkills(data.hasSkills)
          setHasPersonality(data.hasPersonality)
          setLoading(false)
        }
      } catch (error) {
        console.error('Dashboard status fetch error:', error)
        setLoading(false)
      }
    }
    checkStatus()
  }, [navigate, token])

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('userId')
    localStorage.removeItem('username')
    navigate('/login')
  }

  const handleAssessment = () => {
    navigate(getNextAssessmentRoute({ hasProfile, hasInterests, hasSkills, hasPersonality }))
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-white">
        <img src={loadingGif} alt="Loading" className="w-32 h-32 object-contain" />
        <p className="text-sm text-gray-400">{loadingMessages[loadingTextIndex]}</p>
      </div>
    )
  }

  const steps = [
    { label: 'Profile', description: 'Tell us about yourself.', done: hasProfile, icon: IconUser },
    { label: 'Interests', description: 'What do you enjoy?', done: hasInterests, icon: IconHeart },
    { label: 'Skills Quiz', description: 'What are you good at?', done: hasSkills, icon: IconChecklist },
    { label: 'Personality', description: 'Discover your personality type.', done: hasPersonality, icon: IconBrain },
  ]
  const completedSteps = steps.filter((step) => step.done).length

  return (
    <div className="min-h-screen bg-[#fcfaf7] text-gray-900">
      <nav className="bg-white border-b border-gray-100 px-5 sm:px-8 lg:px-14 py-4 flex flex-col sm:flex-row gap-4 sm:justify-between sm:items-center">
        <button onClick={() => navigate('/dashboard')} className="text-lg font-bold text-gray-900 hover:opacity-80 transition self-start sm:self-auto">
          Learn<span className="text-orange-500">Match</span>
        </button>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <span className="hidden md:inline text-sm text-gray-500 mr-1">Welcome, <strong className="text-gray-900">{username}</strong></span>
          <button onClick={() => navigate('/profile', { state: { entryContext: 'dashboard' } })} className="bg-orange-500 text-white px-3.5 py-2.5 rounded-xl text-xs font-medium hover:bg-orange-600 transition">View Profile</button>
          <button onClick={() => navigate('/feedback')} className="text-sm text-gray-600 hover:text-orange-600 transition px-2 py-2">Feedback</button>
          <button onClick={handleLogout} className="bg-red-50 text-red-600 px-3.5 py-2.5 rounded-xl text-xs font-medium hover:bg-red-100 transition">Logout</button>
        </div>
      </nav>

      <main className="max-w-[1240px] mx-auto px-5 sm:px-8 lg:px-12 py-8 sm:py-10 lg:py-12">
        {!hasProfile && (
          <div className="rounded-2xl bg-orange-50 border border-orange-100 px-5 sm:px-7 py-5 mb-7 flex flex-col sm:flex-row gap-4 sm:justify-between sm:items-center shadow-sm">
            <div>
              <p className="text-sm font-semibold text-gray-900">Let's set up your profile first</p>
              <p className="text-xs text-gray-500 mt-1">Add your basic info so we can personalize your assessment.</p>
            </div>
            <button onClick={() => navigate('/profile', { state: { entryContext: 'dashboard' } })} className="bg-gray-900 text-white px-5 py-3 rounded-xl text-sm font-medium hover:bg-gray-800 transition shrink-0 w-full sm:w-auto">Set Up Profile</button>
          </div>
        )}

        <div className="grid lg:grid-cols-[1.55fr_1fr] gap-6 mb-7 items-stretch">
          <section className="min-h-[360px] rounded-3xl p-7 sm:p-10 relative overflow-hidden flex flex-col justify-between border border-orange-200 shadow-[0_16px_45px_-24px_rgba(234,88,12,0.5)] bg-gradient-to-br from-orange-50 via-orange-100 to-orange-200">
            <svg width="320" height="320" viewBox="0 0 320 320" aria-hidden="true" className="absolute -top-20 -right-16 opacity-50">
              <circle cx="160" cy="160" r="140" fill="none" stroke="#fff" strokeWidth="1.5" />
              <circle cx="160" cy="160" r="95" fill="none" stroke="#fff" strokeWidth="1.5" />
              <circle cx="160" cy="160" r="50" fill="none" stroke="#fff" strokeWidth="1.5" />
            </svg>
            <div className="relative">
              <div className="max-w-xl md:max-w-[60%] lg:max-w-[58%]">
                <p className="text-xs font-semibold uppercase tracking-widest text-orange-700 mb-4">Your LearnMatch journey</p>
                <h1 className="text-3xl sm:text-4xl font-bold leading-tight mb-4 text-gray-950">{greeting}, {username}!</h1>
                <p className="text-sm sm:text-base max-w-[520px] leading-relaxed text-amber-950/70">Let's find where you fit. Take the assessment to get personalized course recommendations and a clearer path to your future.</p>
                <div className="mt-5 text-xs text-amber-900/60">
                  <p className="font-medium text-amber-950/75">{formattedDate}</p>
                  <p className="mt-1">Philippine Standard Time (PHT)</p>
                </div>
              </div>
              <div className="hidden md:flex absolute right-2 lg:right-5 top-5 w-48 h-48 items-center justify-center" aria-hidden="true">
                <div className="absolute inset-3 rounded-full bg-white/45 border border-white/70 shadow-sm" />
                <IconSchool size={104} stroke={1.25} className="relative text-orange-600 drop-shadow-sm -translate-y-2" />
                <div className="absolute bottom-5 left-4 w-16 h-14 rounded-xl bg-white/90 border border-orange-100 shadow-md flex items-center justify-center -rotate-6">
                  <IconBook2 size={32} stroke={1.5} className="text-amber-700" />
                </div>
                <div className="absolute bottom-4 right-3 w-16 h-14 rounded-xl bg-orange-500 shadow-md flex items-center justify-center rotate-6">
                  <IconCertificate size={32} stroke={1.5} className="text-white" />
                </div>
              </div>
            </div>
            <button onClick={handleAssessment} className="relative inline-flex items-center justify-center gap-2 bg-orange-500 text-white px-6 py-3.5 mt-8 rounded-xl text-sm font-semibold hover:bg-orange-600 hover:-translate-y-0.5 hover:shadow-lg transition-all duration-200 w-full sm:w-fit">
              {completedSteps > 0 ? 'Continue Assessment' : 'Start Assessment'} <IconArrowRight size={16} stroke={2} />
            </button>
          </section>

          <section className="rounded-3xl bg-white border border-gray-100 px-6 sm:px-7 py-7 flex flex-col shadow-sm">
            <div className="flex items-start justify-between gap-4 mb-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-orange-600">Assessment steps</p>
                <p className="text-sm text-gray-500 mt-1">Complete each step to see your matches.</p>
              </div>
              <span className="shrink-0 text-xs font-semibold text-orange-700 bg-orange-50 px-3 py-1.5 rounded-full">{completedSteps} / 4</span>
            </div>
            <div className="flex flex-col gap-3">
              {steps.map((step) => {
                const StepIcon = step.icon
                return (
                  <div key={step.label} className={`flex items-center gap-3 rounded-2xl border px-4 py-3.5 ${step.done ? 'border-orange-100 bg-orange-50/70' : 'border-gray-100 bg-gray-50/60'}`}>
                    <div className={`w-9 h-9 rounded-xl shrink-0 flex items-center justify-center ${step.done ? 'bg-orange-500 text-white' : 'bg-white border border-gray-200 text-gray-400'}`}><StepIcon size={18} stroke={1.8} /></div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900">{step.label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{step.description}</p>
                    </div>
                    <span className={`w-5 h-5 rounded-full border flex items-center justify-center text-[11px] font-bold ${step.done ? 'bg-orange-500 border-orange-500 text-white' : 'border-gray-300 text-transparent'}`}>✓</span>
                  </div>
                )
              })}
            </div>
          </section>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <section className="rounded-3xl bg-white border border-gray-100 px-6 sm:px-8 py-7 shadow-sm flex flex-col sm:flex-row md:flex-col xl:flex-row gap-5 justify-between sm:items-center md:items-start xl:items-center">
            <div>
              <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center"><IconSchool size={21} stroke={1.75} className="text-gray-600" /></div>
              <p className="font-semibold text-base mt-3 mb-1 text-gray-900">Already enrolled in college?</p>
              <p className="text-xs text-gray-500 max-w-[420px] leading-relaxed">Track your academic alignment, semester progress, and career roadmap.</p>
            </div>
            <button onClick={() => navigate('/college/setup')} className="inline-flex items-center justify-center gap-1.5 bg-gray-900 text-white px-5 py-3 rounded-xl text-sm font-medium hover:bg-gray-800 transition shrink-0 w-full sm:w-auto md:w-full xl:w-auto">I'm in college <IconArrowRight size={16} stroke={2} /></button>
          </section>

          <section className="rounded-3xl bg-white border border-orange-100 px-6 sm:px-8 py-7 shadow-sm flex flex-col sm:flex-row md:flex-col xl:flex-row gap-5 justify-between sm:items-center md:items-start xl:items-center">
            <div>
              <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center"><IconCompass size={21} stroke={1.75} className="text-orange-600" /></div>
              <p className="font-semibold text-base mt-3 mb-1 text-gray-900">Explore courses first</p>
              <p className="text-xs text-gray-500 max-w-[420px] leading-relaxed">Not sure yet? Browse courses and explore your options.</p>
            </div>
            <button onClick={() => navigate('/courses/search', { state: { entryContext: 'dashboard' } })} className="inline-flex items-center justify-center gap-1.5 bg-orange-500 text-white px-5 py-3 rounded-xl text-sm font-medium hover:bg-orange-600 transition shrink-0 w-full sm:w-auto md:w-full xl:w-auto">Explore Courses <IconArrowRight size={16} stroke={2} /></button>
          </section>
        </div>
      </main>
    </div>
  )
}

export default Dashboard
