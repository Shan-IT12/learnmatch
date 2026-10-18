import LogoutButton from '../components/LogoutButton'
import { IconLogout, IconMessageCircle, IconUserCircle } from '@tabler/icons-react'
import HeaderBrand, { HeaderAccount } from '../components/HeaderBrand'
import SkeletonContent from '../components/SkeletonContent'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconArrowRight, IconBook2, IconBrain, IconCertificate, IconChecklist, IconCompass, IconHeart, IconSchool, IconUser, IconCheck, IconArrowUpRight, IconCalendar, IconTarget } from '@tabler/icons-react'
import { getNextAssessmentRoute } from '../utils/assessmentNavigation'
import { getPhilippineDateTime } from '../utils/philippineDateTime'
import { clearUserAuth } from '../utils/userAuth'
import './dashboard.css'


function Dashboard() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [hasProfile, setHasProfile] = useState(false)
  const [hasInterests, setHasInterests] = useState(false)
  const [hasSkills, setHasSkills] = useState(false)
  const [hasPersonality, setHasPersonality] = useState(false)
  const token = localStorage.getItem('token')
  const username = localStorage.getItem('username')
  const { greeting, formattedDate } = getPhilippineDateTime()


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
        else if (data.hasCompletedAssessment || (data.hasInterests && data.hasSkills && data.hasPersonality)) navigate('/dashboard/summary')
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
    clearUserAuth(localStorage)
    navigate('/login')
  }

  const handleAssessment = () => {
    navigate(getNextAssessmentRoute({ hasProfile, hasInterests, hasSkills, hasPersonality }))
  }


  const steps = [
    { label: 'Profile', description: 'Tell us about yourself.', done: hasProfile, icon: IconUser, IconCheck, IconArrowUpRight, IconCalendar, IconTarget },
    { label: 'Interests', description: 'What do you enjoy?', done: hasInterests, icon: IconHeart },
    { label: 'Skills Quiz', description: 'What are you good at?', done: hasSkills, icon: IconChecklist },
    { label: 'Personality', description: 'Discover your personality type.', done: hasPersonality, icon: IconBrain },
  ]
  const completedSteps = steps.filter((step) => step.done).length
  const nextStep = steps.find(step => !step.done)
  const progressPercent = Math.round(completedSteps / steps.length * 100)

  return (
    <div className="min-h-screen bg-[#fcfaf7] text-gray-900">
      <nav className="lm-site-header bg-white border-b border-gray-100 px-5 sm:px-8 lg:px-14 py-4 flex flex-col sm:flex-row gap-4 sm:justify-between sm:items-center">
        <button onClick={() => navigate('/dashboard')} className="text-xl font-bold text-gray-900 hover:opacity-80 transition self-start sm:self-auto">
          <HeaderBrand />
        </button>
        <div className="lm-header-actions flex flex-wrap items-center gap-2 sm:gap-3">
          <HeaderAccount username={username} />
          <button onClick={() => navigate('/profile', { state: { entryContext: 'dashboard' } })} className="lm-header-primary"><IconUserCircle size={16} stroke={1.7} aria-hidden="true" />{hasProfile ? 'View Profile' : 'Setup Profile'}</button>
          <button onClick={() => navigate('/feedback', { state: { entryContext: 'dashboard' } })} className="lm-action"><IconMessageCircle size={16} stroke={1.7} aria-hidden="true" /> Feedback</button>
          <LogoutButton onConfirm={handleLogout} className="lm-action lm-action-danger"><IconLogout size={16} stroke={1.7} aria-hidden="true" /> Logout</LogoutButton>
        </div>
      </nav>

      <SkeletonContent loading={loading} label="Loading Dashboard..."><main className="max-w-[1240px] mx-auto px-5 sm:px-8 lg:px-12 py-8 sm:py-10 lg:py-12">
        {!hasProfile && (
          <div className="rounded-2xl bg-orange-50 border border-orange-100 px-5 sm:px-7 py-5 mb-7 flex flex-col sm:flex-row gap-4 sm:justify-between sm:items-center shadow-sm">
            <div>
              <p className="text-base font-semibold text-gray-900">Let's set up your profile first</p>
              <p className="text-sm text-gray-500 mt-1">Add your basic info so we can personalize your assessment.</p>
            </div>
            <button onClick={() => navigate('/profile', { state: { entryContext: 'dashboard' } })} className="bg-gray-900 text-white px-5 py-3 rounded-xl text-base font-medium hover:bg-gray-800 transition shrink-0 w-full sm:w-auto">Set Up Profile</button>
          </div>
        )}

        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-gray-500">Your personal dashboard</p>
          <span className="inline-flex items-center gap-2 text-sm text-gray-500"><IconCalendar size={15} stroke={1.6} aria-hidden="true" />{formattedDate}</span>
        </div>

        <div className="motion-stagger mb-8 grid items-stretch gap-5 lg:grid-cols-[1.55fr_1fr]">
          <section className="relative flex min-h-[400px] flex-col justify-between overflow-hidden rounded-[28px] border border-orange-200/80 bg-gradient-to-br from-[#fffaf3] via-orange-50 to-orange-200/80 p-6 shadow-[0_20px_50px_-36px_rgba(234,88,12,.4)] sm:p-9 lg:p-10">
            <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-24 h-80 w-80 rounded-full border border-white/70 p-9"><div className="h-full w-full rounded-full border border-white/80 p-9"><div className="h-full w-full rounded-full border border-white/90" /></div></div>
            <div className="relative">
              <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-orange-200/80 bg-white/60 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-orange-700"><span className="h-1.5 w-1.5 rounded-full bg-orange-500" />Your LearnMatch journey</p>
              <div className="relative">
                <div className="max-w-xl md:max-w-[65%]">
                  <h1 className="break-words text-4xl font-bold leading-[1.15] tracking-tight text-gray-950 sm:text-[42px]">{greeting},<br /><span className="text-orange-600">{username || 'there'}!</span></h1>
                  <p className="mt-4 max-w-md text-base leading-7 text-amber-950/75">A course that fits you starts with understanding you. Explore your strengths, interests, and the possibilities ahead.</p>
                </div>
                <div className="dashboard-illustration absolute -right-2 top-2 hidden h-48 w-40 items-center justify-center md:flex lg:right-0" aria-hidden="true">
                  <div className="absolute h-36 w-36 rounded-[32px] border border-white/90 bg-white/50 shadow-[0_18px_35px_-25px_rgba(154,52,18,.4)] rotate-6" />
                  <IconSchool size={90} stroke={1.2} className="relative -translate-y-2 text-orange-600" />
                  <div className="absolute bottom-4 left-0 flex h-14 w-14 -rotate-12 items-center justify-center rounded-2xl border border-orange-100 bg-white shadow-lg shadow-orange-900/5"><IconBook2 size={27} stroke={1.5} className="text-orange-600" /></div>
                  <div className="absolute bottom-2 right-0 flex h-14 w-14 rotate-12 items-center justify-center rounded-2xl bg-orange-500 shadow-lg shadow-orange-500/20"><IconCertificate size={27} stroke={1.5} className="text-white" /></div>
                </div>
              </div>
            </div>
            <div className="relative mt-7 flex flex-col gap-5 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
              <button onClick={handleAssessment} className="group inline-flex min-h-12 items-center justify-center gap-3 rounded-xl bg-orange-500 px-5 py-3.5 text-base font-semibold text-white shadow-[0_8px_20px_-10px_rgba(234,88,12,.6)] transition hover:bg-orange-600 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600">
                {completedSteps > 0 ? 'Continue Assessment' : 'Start Assessment'}<IconArrowRight size={17} stroke={2} className="transition-transform motion-safe:group-hover:translate-x-1" />
              </button>
              {nextStep && <div className="flex items-center gap-2.5 text-sm"><span className="flex h-8 w-8 items-center justify-center rounded-full border border-white bg-white/55 text-orange-600"><IconTarget size={17} stroke={1.6} /></span><div><p className="text-xs font-bold uppercase tracking-wide text-amber-900/45">Up next</p><p className="mt-0.5 font-semibold text-amber-950/80">{nextStep.label}</p></div></div>}
            </div>
          </section>

          <section className="flex flex-col rounded-[28px] border border-gray-200/70 bg-white p-5 shadow-[0_12px_32px_-28px_rgba(15,23,42,.3)] sm:p-7" aria-labelledby="dashboard-steps-title">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div><p className="mb-2 text-xs font-bold uppercase tracking-[0.15em] text-gray-500">Your progress</p><h2 id="dashboard-steps-title" className="text-2xl font-bold tracking-tight text-gray-950">Assessment steps</h2><p className="mt-2 text-sm leading-6 text-gray-600">{completedSteps === 3 ? 'One step away from your matches.' : 'A few steps toward a clearer direction.'}</p></div>
              <div className="relative flex h-14 w-14 shrink-0 items-center justify-center" role="progressbar" aria-label="Assessment completion" aria-valuemin={0} aria-valuemax={4} aria-valuenow={completedSteps} aria-valuetext={`${completedSteps} of 4 steps complete`}>
                <svg viewBox="0 0 56 56" className="absolute inset-0 h-full w-full -rotate-90" aria-hidden="true"><circle cx="28" cy="28" r="23" fill="none" stroke="#f3f4f6" strokeWidth="4" /><circle cx="28" cy="28" r="23" fill="none" stroke="#f97316" strokeWidth="4" strokeLinecap="round" strokeDasharray="144.51" strokeDashoffset={144.51 * (1 - progressPercent / 100)} /></svg>
                <span className="text-sm font-bold text-gray-900">{completedSteps}<span className="font-medium text-gray-500"> / 4</span></span>
              </div>
            </div>
            <div className="flex flex-1 flex-col justify-between gap-2.5">
              {steps.map((step, index) => {
                const StepIcon = step.icon
                const isNext = step === nextStep
                const Row = isNext ? 'button' : 'div'
                return <Row key={step.label} type={isNext ? 'button' : undefined} onClick={isNext ? handleAssessment : undefined} aria-label={isNext ? `Continue to ${step.label}` : undefined} aria-current={isNext ? 'step' : undefined} className={`group flex w-full items-center gap-3 rounded-2xl border px-3.5 py-3 text-left ${isNext ? 'dashboard-next-step border-orange-300 bg-orange-50/70 shadow-sm shadow-orange-100 outline-none hover:border-orange-400 hover:bg-orange-100/60 focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2' : 'border-gray-100 bg-gray-50/40'}`}>
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${isNext ? 'bg-orange-500 text-white shadow-sm shadow-orange-200' : step.done ? 'border border-gray-200/80 bg-white text-gray-600' : 'border border-gray-100 bg-white text-gray-500'}`}><StepIcon size={18} stroke={1.7} /></div>
                  <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="text-base font-semibold text-gray-900">{step.label}</p>{isNext && <span className="rounded-full bg-orange-100 px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-orange-700">Next</span>}</div><p className="mt-1 text-sm leading-5 text-gray-600">{step.description}</p></div>
                  {step.done ? <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600" aria-label="Completed"><IconCheck size={13} stroke={2.5} /></span> : isNext ? <IconArrowRight size={16} className="shrink-0 text-orange-600 transition-transform motion-safe:group-hover:translate-x-0.5" /> : <span className="text-xs font-semibold text-gray-300">0{index + 1}</span>}
                </Row>
              })}
            </div>
          </section>
        </div>

        <div className="mb-4 flex items-center gap-3"><p className="shrink-0 text-xs font-bold uppercase tracking-[0.16em] text-gray-500">More ways to explore</p><div className="h-px w-full bg-gray-200/70" /></div>
        <div className="motion-stagger grid gap-5 md:grid-cols-2">
          <section className="dashboard-option group flex flex-col rounded-3xl border border-gray-200/80 bg-white p-6 shadow-sm sm:p-7">
            <div className="mb-5 flex items-center justify-between"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-600"><IconSchool size={23} stroke={1.5} /></span><span className="text-[11px] font-bold uppercase tracking-[0.14em] text-gray-500">College Phase</span></div>
            <h2 className="text-2xl font-bold tracking-tight text-gray-950">Already enrolled in college?</h2><p className="mb-5 mt-3 max-w-md text-base leading-7 text-gray-600">Track your academic alignment, term progress, and career roadmap.</p>
            <div className="mt-auto border-t border-gray-100 pt-4"><button onClick={() => navigate('/college/setup')} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-600">I'm in college<IconArrowUpRight size={16} /></button></div>
          </section>
          <section className="dashboard-option group flex flex-col rounded-3xl border border-orange-100 bg-white p-6 shadow-sm sm:p-7">
            <div className="mb-5 flex items-center justify-between"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-50 text-orange-600"><IconCompass size={23} stroke={1.5} /></span><span className="text-[11px] font-bold uppercase tracking-[0.14em] text-gray-500">Course Explorer</span></div>
            <h2 className="text-2xl font-bold tracking-tight text-gray-950">Explore courses first</h2><p className="mb-5 mt-3 max-w-md text-base leading-7 text-gray-600">Find something that sparks your interest. Browse programs, skills, and possible career paths.</p>
            <div className="mt-auto border-t border-gray-100 pt-4"><button onClick={() => navigate('/courses/search?source=dashboard', { state: { entryContext: 'dashboard' } })} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-orange-200 bg-orange-50 px-4 py-2.5 text-sm font-semibold text-orange-700 transition hover:border-orange-300 hover:bg-orange-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500">Explore Courses<IconArrowUpRight size={16} /></button></div>
          </section>
        </div>
      </main></SkeletonContent>
    </div>
  )
}

export default Dashboard
