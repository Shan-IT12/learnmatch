import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  IconArrowRight,
  IconBrain,
  IconChevronRight,
  IconCompass,
  IconSearch,
  IconTargetArrow,
  IconUserCircle,
} from '@tabler/icons-react'
import { STUDENT_ACTIVE_INDEPENDENT_COURSE_COUNT } from '../constants/courseCatalog'
import landingCoursePathway from '../assets/landing-course-pathway.png'
import CourseName from '../components/CourseName'

const journeySteps = [
  {
    step: '01',
    title: 'Set up your profile',
    description: 'Share relevant factors that may affect your course options.',
    icon: IconUserCircle,
  },
  {
    step: '02',
    title: 'Take the assessment',
    description: 'Answer questions about your interests, academic skills, and personality.',
    icon: IconBrain,
  },
  {
    step: '03',
    title: 'Explore your matches',
    description: 'See personalized course matches, why they fit, and where they can lead.',
    icon: IconCompass,
  },
]

function PathwayVisual() {
  return (
    <div className="relative isolate flex min-h-[330px] items-center justify-center overflow-hidden sm:min-h-[430px] lg:min-h-[560px]">
      <div className="pointer-events-none absolute inset-x-[3%] bottom-[4%] top-[7%] rounded-[46%_54%_42%_58%/48%_39%_61%_52%] bg-gradient-to-br from-orange-100 via-orange-200/70 to-amber-100" />
      <div className="pointer-events-none absolute right-[3%] top-[10%] h-[72%] w-[72%] rounded-full border border-orange-200/70" />
      <div className="hero-orbit hero-orbit-delayed pointer-events-none absolute right-[8%] top-[17%] h-3 w-3 rounded-full bg-teal-500 shadow-[0_0_0_8px_rgba(20,184,166,.10)]" />
      <div className="hero-orbit pointer-events-none absolute bottom-[20%] left-[7%] h-3.5 w-3.5 rounded-full bg-orange-500 shadow-[0_0_0_9px_rgba(249,115,22,.11)]" />
      <div className="pointer-events-none absolute bottom-[9%] left-[4%] h-24 w-24 rounded-full bg-white/70 blur-2xl sm:h-36 sm:w-36" />
      <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:radial-gradient(rgba(194,65,12,.5)_1px,transparent_1px)] [background-size:18px_18px] [mask-image:linear-gradient(to_bottom_left,black,transparent_52%)]" />
      <div className="hero-people-float relative z-10 flex items-center justify-center">
        <img
          src={landingCoursePathway}
          alt="Education and career pathways represented by a laptop, books, and course icons"
          className="h-auto max-h-[335px] w-auto max-w-[99%] object-contain drop-shadow-[0_26px_30px_rgba(124,45,18,.18)] sm:max-h-[445px] lg:max-h-[565px]"
        />
      </div>
    </div>
  )
}

function Landing() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null)
  const [searching, setSearching] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const trimmedQuery = query.trim()
    const controller = new AbortController()
    if (!trimmedQuery) return () => controller.abort()

    const timer = setTimeout(() => {
      setSearching(true)
      fetch(`${import.meta.env.VITE_API_URL || ''}/api/public/courses/search?q=${encodeURIComponent(trimmedQuery)}&limit=6`, { signal: controller.signal })
        .then(async (response) => {
          if (!response.ok) throw new Error('Search request failed')
          return response.json()
        })
        .then((data) => setResults({ courses: data.courses || [] }))
        .catch((error) => {
          if (error.name !== 'AbortError') setResults({ courses: [] })
        })
        .finally(() => setSearching(false))
    }, 250)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query])

  const handleSearch = (event) => {
    event.preventDefault()
    if (!query.trim()) return
    navigate(`/courses/search?q=${encodeURIComponent(query.trim())}`)
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#fbf8f3] text-gray-900">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[760px] bg-[radial-gradient(circle_at_13%_18%,rgba(251,146,60,.13),transparent_28%),radial-gradient(circle_at_78%_28%,rgba(253,186,116,.16),transparent_31%),linear-gradient(115deg,rgba(255,255,255,.8),rgba(255,247,237,.25))]" />

      <header className="relative z-30 mx-auto flex max-w-[1440px] items-center justify-between px-5 py-5 sm:px-8 lg:px-10">
        <Link to="/" className="text-xl font-bold tracking-tight text-gray-900">Learn<span className="text-orange-500">Match</span></Link>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <Link to="/login" className="rounded-xl px-3 py-2.5 text-sm font-medium text-gray-600 transition duration-150 hover:bg-white/75 hover:text-gray-900 sm:px-4">Log In</Link>
          <Link to="/register" className="rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_8px_20px_-10px_rgba(234,88,12,.85)] transition duration-150 hover:-translate-y-0.5 hover:bg-orange-600 active:translate-y-0">Get Started</Link>
        </div>
      </header>

      <main className="relative">
        <section className="mx-auto grid max-w-[1380px] gap-10 px-5 pb-14 pt-8 sm:px-8 sm:pb-16 sm:pt-12 lg:grid-cols-[minmax(390px,.86fr)_minmax(500px,1.14fr)] lg:items-center lg:gap-12 lg:px-10 lg:pb-20 lg:pt-14 xl:gap-16">
          <div className="mx-auto w-full max-w-xl lg:mx-0">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-orange-100 bg-white/70 px-3.5 py-2 text-xs font-semibold text-orange-700 shadow-sm backdrop-blur-md">
              <IconTargetArrow size={15} stroke={1.9} /> Personalized course guidance
            </div>
            <h1 className="max-w-lg text-[2.65rem] font-bold leading-[1.02] tracking-[-0.045em] text-gray-950 sm:text-6xl lg:text-[4rem]">
              Find the right course <span className="text-orange-500">for your future.</span>
            </h1>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-gray-600 sm:text-lg">
              Discover courses that match your strengths, interests, personality, and situation.
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link to="/register" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-orange-600 px-6 py-3.5 text-sm font-semibold text-white shadow-[0_14px_30px_-14px_rgba(234,88,12,.8)] transition duration-150 hover:-translate-y-0.5 hover:shadow-[0_18px_34px_-14px_rgba(234,88,12,.7)] active:translate-y-0">
                Start Assessment <IconArrowRight size={17} stroke={2} />
              </Link>
              <Link to="/login" className="inline-flex items-center justify-center gap-1 rounded-xl px-4 py-3 text-sm font-semibold text-gray-700 transition duration-150 hover:bg-white/70 hover:text-orange-700">
                Already registered? Log in <IconChevronRight size={15} />
              </Link>
            </div>

            <div className="relative z-20 mt-8 max-w-xl">
              <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em] text-orange-700">
                <span className="h-px w-5 bg-orange-400" /> Explore the course catalog
              </p>
              <form onSubmit={handleSearch} className="flex items-center gap-2 rounded-2xl border border-orange-200/90 bg-[#fffdf9] p-2 shadow-[0_14px_32px_-24px_rgba(154,52,18,.58)] transition duration-150 hover:border-orange-300 hover:shadow-[0_16px_34px_-24px_rgba(154,52,18,.68)] focus-within:border-orange-400 focus-within:ring-4 focus-within:ring-orange-100/90">
                <span className="ml-1.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
                  <IconSearch size={19} stroke={2} />
                </span>
                <input
                  type="text"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value)
                    setResults(null)
                  }}
                  placeholder="Search by course, skill, or career"
                  aria-label="Search courses"
                  className="min-w-0 flex-1 bg-transparent px-1 py-2.5 text-sm font-medium text-slate-900 outline-none placeholder:font-normal placeholder:text-slate-500"
                />
                <button type="submit" className="rounded-xl bg-orange-500 px-4 py-2.5 text-xs font-semibold text-white shadow-[0_8px_18px_-10px_rgba(234,88,12,.8)] transition duration-150 hover:bg-orange-600 hover:shadow-[0_10px_22px_-10px_rgba(234,88,12,.75)] active:translate-y-px sm:px-5">
                  {searching ? 'Searching…' : 'Search'}
                </button>
              </form>
              {results && (
                <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-orange-100 bg-white shadow-2xl">
                  {results.courses.length === 0 ? (
                    <div className="px-5 py-4 text-sm text-gray-500">No courses found for “{query}”.</div>
                  ) : (
                    <>
                      <div className="bg-orange-50/70 px-5 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-orange-600">Courses</div>
                      {results.courses.map((course, index) => (
                        <button
                          type="button"
                          key={course.course_code || index}
                          onClick={() => navigate(`/courses/${course.course_code}`, {
                            state: {
                              entryContext: 'public-search',
                              returnTo: `/courses/search?q=${encodeURIComponent(query.trim())}`,
                            },
                          })}
                          className="block w-full border-t border-orange-50 px-5 py-3 text-left transition duration-150 hover:bg-orange-50"
                        >
                          <CourseName name={course.course_name} abbreviation={course.course_abbreviation} className="text-sm font-medium text-gray-800" secondaryClassName="mt-1 text-sm font-normal text-gray-500" />
                        </button>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>

            <dl className="mt-6 grid grid-cols-3 overflow-hidden rounded-2xl border border-white/90 bg-white/55 shadow-sm backdrop-blur-lg">
              {[
                ['13', 'Schools'],
                [String(STUDENT_ACTIVE_INDEPENDENT_COURSE_COUNT), 'Active courses'],
                ['4', 'Assessments'],
              ].map(([value, label], index) => (
                <div key={label} className={`px-3 py-3.5 sm:px-4 ${index ? 'border-l border-orange-100/80' : ''}`}>
                  <dt className="text-lg font-bold text-gray-950 sm:text-xl">{value}</dt>
                  <dd className="mt-0.5 text-[10px] leading-tight text-gray-500 sm:text-xs">{label}</dd>
                </div>
              ))}
            </dl>
          </div>

          <PathwayVisual />
        </section>

        <section className="relative border-y border-orange-100/70 bg-white/48 px-5 py-16 sm:px-8 sm:py-20 lg:px-10">
          <div className="mx-auto max-w-6xl">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-orange-500">How it works</p>
              <h2 className="mt-3 text-3xl font-bold tracking-[-0.03em] text-gray-950 sm:text-4xl">A clearer path, one step at a time.</h2>
              <p className="mt-4 text-sm leading-relaxed text-gray-500 sm:text-base">Build your profile, understand your fit, then explore courses with context.</p>
            </div>

            <div className="relative mt-12 grid gap-5 md:grid-cols-3 md:gap-6">
              <div className="pointer-events-none absolute left-[16%] right-[16%] top-9 hidden border-t border-dashed border-orange-300 md:block" />
              {journeySteps.map((item, index) => {
                const StepIcon = item.icon
                return (
                  <article key={item.step} className={`group relative rounded-[24px] border border-white bg-white/75 p-6 shadow-[0_18px_50px_-38px_rgba(120,53,15,.55)] backdrop-blur-lg transition duration-200 motion-safe:hover:-translate-y-1 ${index === 1 ? 'md:mt-8' : index === 2 ? 'md:mt-16' : ''}`}>
                    <div className="relative z-10 flex items-center justify-between">
                      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-100 text-orange-600 transition duration-200 group-hover:bg-orange-500 group-hover:text-white"><StepIcon size={23} stroke={1.7} /></span>
                      <span className="text-3xl font-bold tracking-[-0.05em] text-orange-200">{item.step}</span>
                    </div>
                    <h3 className="mt-6 text-lg font-bold tracking-tight text-gray-900">{item.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-gray-500">{item.description}</p>
                  </article>
                )
              })}
            </div>
          </div>
        </section>

        <section className="px-5 py-14 sm:px-8 sm:py-16 lg:px-10">
          <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 rounded-[28px] border border-orange-200/70 bg-orange-950 px-6 py-8 text-white shadow-[0_24px_60px_-38px_rgba(67,20,7,.7)] sm:px-9 md:flex-row md:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.17em] text-orange-300">Your direction starts here</p>
              <h2 className="mt-2 max-w-xl text-2xl font-bold tracking-tight sm:text-3xl">Explore your options with more clarity.</h2>
            </div>
            <Link to="/register" className="inline-flex shrink-0 items-center gap-2 rounded-2xl bg-orange-500 px-5 py-3 text-sm font-semibold shadow-lg shadow-orange-950/20 transition duration-150 hover:-translate-y-0.5 hover:bg-orange-400 active:translate-y-0">
              Get Started <IconArrowRight size={17} />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-orange-100/70 px-5 py-6 sm:px-8 lg:px-10">
        <div className="mx-auto flex max-w-[1380px] flex-col items-center justify-between gap-2 sm:flex-row">
          <span className="text-sm font-bold text-gray-900">Learn<span className="text-orange-500">Match</span></span>
          <p className="text-xs text-gray-400">© 2026 LearnMatch</p>
        </div>
      </footer>
    </div>
  )
}

export default Landing
