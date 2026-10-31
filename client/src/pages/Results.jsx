import HeaderBrand from '../components/HeaderBrand'
import RecommendationsLoadingState from '../components/RecommendationsLoadingState'
import CompatibilityDisclaimer from '../components/CompatibilityDisclaimer'
import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconSchool, IconSparkles, IconArrowUpRight, IconBrain, IconChartBar, IconActivity, IconBulb } from '@tabler/icons-react'
import FeedbackPopup from '../components/FeedbackPopup'
import CourseName from '../components/CourseName'
import CourseSchoolAction from '../components/CourseSchoolAction'
import PersonalFactorExplanation from '../components/PersonalFactorExplanation'
import { getPersonalFactorExplanation } from '../../../shared/personalFactorExplanation'
import { MBTI_TYPE_CONTENT, getExpandedType } from '../data/mbtiResultContent'
import { getAssessmentReturnDestination, SUMMARY_DASHBOARD_DESTINATION } from '../utils/assessmentReturnDestination'
import { feedbackPromptKey, setActiveFeedbackPromptKey } from '../utils/feedbackPrompt'
import { readRecommendationResponse } from '../utils/recommendationProgress'

const RECOMMENDATIONS_TIMEOUT_MS = 30000

const physicalRelevanceClusters = new Set([
  'HEALTHCARE SCIENCE CLUSTER',
  'HOSPITALITY & TOURISM CLUSTER',
  'AVIATION & MARITIME CLUSTER',
  'ARTS & MULTIMEDIA CLUSTER',
  'CRIMINOLOGY CLUSTER',
  'AGRICULTURE & ENVIRONMENTAL CLUSTER',
  'SPORTS & PHYSICAL EDUCATION CLUSTER',
  'ENGINEERING / STEM CLUSTER',
])

const healthRelevanceClusters = new Set([
  'HEALTHCARE SCIENCE CLUSTER',
  'AVIATION & MARITIME CLUSTER',
  'CRIMINOLOGY CLUSTER',
  'SPORTS & PHYSICAL EDUCATION CLUSTER',
])

function shouldShowRequirementsNote(profile, cluster) {
  return Boolean(
    (Number(profile?.factor_physical_impact) > 1 && physicalRelevanceClusters.has(cluster))
    || (Number(profile?.factor_health_impact) > 1 && healthRelevanceClusters.has(cluster))
  )
}

function Results() {
  const navigate = useNavigate()
  const pageRef = useRef(null)
  const [recommendations, setRecommendations] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingProgress, setLoadingProgress] = useState({ percent: 0, label: 'Checking your assessment' })
  const [error, setError] = useState('')
  const [rankingPending, setRankingPending] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  const [assessment, setAssessment] = useState({ interests: [], domainScores: {}, mbti: null, profile: null })
  const [returnDestination, setReturnDestination] = useState(SUMMARY_DASHBOARD_DESTINATION)
  const [feedbackMilestoneKey, setFeedbackMilestoneKey] = useState(null)

  useEffect(() => {
    const token = localStorage.getItem('token')

    if (!token) {
      navigate('/login', { replace: true })
      return
    }

    const controller = new AbortController()

    const loadRecommendations = async () => {
      setLoading(true)
      setLoadingProgress({ percent: 0, label: 'Checking your assessment' })
      // Reset the scrolling ancestors immediately for each load, including retries.
      pageRef.current?.scrollIntoView({ block: 'start', inline: 'nearest', behavior: 'instant' })
      setError('')
      setRankingPending(false)
      let requestTimedOut = false
      const timeoutId = window.setTimeout(() => {
        requestTimedOut = true
        controller.abort()
      }, RECOMMENDATIONS_TIMEOUT_MS)

      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/results`, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'text/event-stream',
          },
          signal: controller.signal,
        })
        const { status, data } = await readRecommendationResponse(response, progress => {
          if (!controller.signal.aborted) setLoadingProgress(previous => ({ percent: Math.max(previous.percent, progress.completed * 20), label: progress.label }))
        })

        if (status === 401 || status === 403) {
          navigate('/login', { replace: true })
          return
        }

        if (status === 400) {
          setRankingPending(data.code === 'MISSING_INTEREST_SCORING_POLICY')
          setError(
            data.message || 'Please complete all required assessments before viewing recommendations.'
          )
          setRecommendations([])
          return
        }

        if (status >= 400) {
          setError('Could not load your recommendations. Please try again.')
          setRecommendations([])
          return
        }

        setRecommendations(Array.isArray(data.recommendations) ? data.recommendations : [])

        setLoadingProgress({ percent: 80, label: 'Loading your results overview' })
        let completedDetails = 0
        const trackDetail = request => request.finally(() => {
          completedDetails += 1
          if (!controller.signal.aborted) setLoadingProgress({ percent: Math.min(99, 80 + Math.floor(completedDetails / 6 * 20)), label: 'Loading your results overview' })
        })
        const headers = { Authorization: `Bearer ${token}` }
        const userId = localStorage.getItem('userId')
        const assessmentResponses = await Promise.allSettled([
          fetch(`${import.meta.env.VITE_API_URL}/api/interests`, { headers, signal: controller.signal }).then((res) => res.json()),
          fetch(`${import.meta.env.VITE_API_URL}/api/quiz/results`, { headers, signal: controller.signal }).then((res) => res.json()),
          fetch(`${import.meta.env.VITE_API_URL}/api/mbti`, { headers, signal: controller.signal }).then((res) => res.json()),
          fetch(`${import.meta.env.VITE_API_URL}/api/profile?userId=${userId}`, { headers, signal: controller.signal }).then((res) => res.json()),
          fetch(`${import.meta.env.VITE_API_URL}/api/college/status`, { headers, signal: controller.signal })
            .then(async (res) => res.ok ? res.json() : null),
          fetch(`${import.meta.env.VITE_API_URL}/api/recommendations/latest`, { headers, signal: controller.signal })
            .then(async (res) => res.ok ? res.json() : null),
        ].map(trackDetail))
        if (controller.signal.aborted) throw new DOMException('Results request cancelled', 'AbortError')

        const valueAt = (index) => assessmentResponses[index].status === 'fulfilled'
          ? assessmentResponses[index].value ?? {}
          : {}
        if (!controller.signal.aborted) {
          setAssessment({
            interests: valueAt(0).interests || [],
            domainScores: valueAt(1).domainScores || {},
            mbti: valueAt(2).mbtiType || null,
            profile: valueAt(3).profile || null,
          })
          setReturnDestination(getAssessmentReturnDestination(valueAt(4)))
          const promptKey = feedbackPromptKey(userId, valueAt(5)?.recommendation?.recommendation_id)
          setFeedbackMilestoneKey(promptKey)
          setActiveFeedbackPromptKey(localStorage, promptKey)
          setLoadingProgress({ percent: 100, label: 'Your recommendations are ready' })
          // Let the completed bar settle before revealing the results.
          await new Promise(resolve => window.setTimeout(resolve, 400))
        }
      } catch (requestError) {
        if (requestTimedOut) {
          setError('The request took too long. Please try again.')
          setRecommendations([])
        } else if (requestError.name !== 'AbortError') {
          setError('Could not connect to the server. Please try again.')
          setRecommendations([])
        }
      } finally {
        window.clearTimeout(timeoutId)
        if (!controller.signal.aborted) {
          setLoading(false)
        } else if (requestTimedOut) {
          setLoading(false)
        }
      }
    }

    loadRecommendations()

    return () => controller.abort()
  }, [navigate, retryCount])

  const rankLabel = ['Top Match', '2nd Match', '3rd Match']
  const breakdownLabels = {
    skill_match: 'Skills',
    interest_match: 'Interests',
    personality_match: 'Personality',
    personal_factor_match: 'Personal Factors Adjustment',
  }

  const skillTotals = Object.values(assessment.domainScores).reduce(
    (totals, score) => ({ correct: totals.correct + score.correct, total: totals.total + score.total }),
    { correct: 0, total: 0 }
  )
  const skillPercent = skillTotals.total ? Math.round((skillTotals.correct / skillTotals.total) * 100) : null
  const personalityInfo = MBTI_TYPE_CONTENT[assessment.mbti]
  const skillHighlights = Object.entries(assessment.domainScores)
    .filter(([, score]) => score.total > 0)
    .sort(([, left], [, right]) => right.correct / right.total - left.correct / left.total)
    .slice(0, 2)
  const personalFactorDetails = getPersonalFactorExplanation(assessment.profile || {}, recommendations)

  return (
    <div ref={pageRef} className="min-h-screen bg-gray-50">
      {/* Nav */}
      <nav className="lm-site-header bg-white border-b border-gray-100 px-5 sm:px-8 py-4 sm:py-5 flex justify-between items-center gap-3">
        {loading || returnDestination.path === '/college' ? (
          <span className="text-lg font-bold text-gray-900"><HeaderBrand /></span>
        ) : (
          <button onClick={() => navigate(returnDestination.path)} className="text-lg font-bold text-gray-900 hover:opacity-80 transition"><HeaderBrand /></button>
        )}
        {!loading && (
          <button onClick={() => navigate(returnDestination.path)} className="lm-action">{returnDestination.label}<IconArrowUpRight size={16} aria-hidden="true" /></button>
        )}
      </nav>

      <div className="max-w-6xl mx-auto px-5 sm:px-8 py-8 sm:py-12">
        {!loading && <>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 mb-2">Your Recommended Courses</h1>
        <p className="text-gray-500 text-sm mb-6">
          {recommendations[0]?.interests_available === false
            ? 'These recommendations are based on your skills, personality, and personal factors because you selected no activity interests.'
            : 'Based on your skills, interests, and profile, here are your top matches.'}
        </p>
        </>}
        {returnDestination.path === '/college' && (
          <p className="mb-6 rounded-xl border border-orange-100 bg-orange-50 px-4 py-3 text-sm text-orange-900">
            These recommendations are informational and do not change your enrolled course or College Phase tracking.
          </p>
        )}

        {loading ? (
          <RecommendationsLoadingState progress={loadingProgress.percent} status={loadingProgress.label} />
        ) : error ? (
          <div role="status" className={`${rankingPending ? 'bg-blue-50 text-blue-900' : 'bg-red-50 text-red-600'} px-4 py-3 rounded-xl text-sm mb-6`}>
            <p>{error}</p>
            {!rankingPending && (
            <button
              type="button"
              onClick={() => setRetryCount((count) => count + 1)}
              className="mt-2 font-medium underline hover:text-red-700 transition"
            >
              Try again
            </button>
            )}
          </div>
        ) : recommendations.length === 0 ? (
          <div className="text-center text-gray-500 text-sm py-12">
            No recommendations are available yet.
          </div>
        ) : (
          <>
          <div className="motion-stagger grid items-stretch gap-5 lg:grid-cols-2">
            {recommendations.map((rec) => {
              const isTopMatch = rec.rank_position === 1
              const isSecondMatch = rec.rank_position === 2
              return (
              <div
                key={rec.course_id}
                data-recommendation-rank={rec.rank_position}
                className={`flex flex-col overflow-hidden rounded-3xl border bg-white ${isTopMatch ? 'border-orange-200 shadow-[0_10px_35px_-24px_rgba(234,88,12,.45)] ring-1 ring-orange-100/60 lg:col-span-2' : isSecondMatch ? 'border-orange-200 shadow-sm' : 'border-orange-100 shadow-sm'}`}
              >
                <div className={isTopMatch ? 'bg-gradient-to-br from-orange-50/60 via-white to-white p-6 sm:p-8' : 'p-5 sm:p-6'}>
                <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-start mb-4">
                  <div className="min-w-0">
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wide ${isTopMatch ? 'border-orange-200 bg-orange-100/70 text-orange-700' : isSecondMatch ? 'border-orange-200 bg-orange-50 text-orange-700' : 'border-orange-100 bg-amber-50/70 text-stone-600'}`}>
                      {isTopMatch && <IconSparkles size={13} aria-hidden="true" />}
                      {rankLabel[rec.rank_position - 1] || `#${rec.rank_position}`}
                    </span>
                    <CourseName as="h2" name={rec.course_name} abbreviation={rec.course_abbreviation} className={`mt-2 font-bold leading-snug tracking-tight text-gray-900 ${isTopMatch ? 'text-2xl sm:text-3xl' : 'text-lg sm:text-xl'}`} secondaryClassName="mt-1 text-base font-medium text-gray-500" />
                  </div>
                  <div className="flex shrink-0 items-baseline gap-2 sm:justify-end">
                    <span className={`font-bold tracking-tight ${isTopMatch ? 'text-3xl text-orange-600 sm:text-4xl' : isSecondMatch ? 'text-2xl text-orange-700' : 'text-2xl text-stone-700'}`}>{rec.match_score}%</span>
                    <span className="text-xs text-gray-400">match</span>
                  </div>
                </div>

                {/* Match score bar */}
                <div className="w-full bg-gray-100 rounded-full h-2 mb-4">
                  <div
                    className={`h-2 rounded-full transition-all ${isTopMatch ? 'bg-orange-500' : isSecondMatch ? 'bg-orange-400' : 'bg-orange-200'}`}
                    style={{ width: `${rec.match_score}%` }}
                  />
                </div>

                <div className={`grid items-start gap-4 ${isTopMatch ? 'lg:grid-cols-[minmax(0,1fr)_17rem]' : ''}`}>
                  {rec.ai_narrative && (
                    <section aria-labelledby={`course-fit-${rec.rank_position}`} className={`relative overflow-hidden rounded-2xl border p-5 ${isTopMatch ? 'border-orange-200 bg-gradient-to-br from-orange-50 via-orange-50/60 to-amber-50/70 sm:p-6' : isSecondMatch ? 'border-orange-200 bg-orange-50/70' : 'border-orange-100 bg-amber-50/60'}`}>
                      {isTopMatch && <div aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-orange-400 to-orange-500" />}
                      <div className="mb-4 flex items-center gap-3">
                        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${isTopMatch ? 'bg-orange-500 text-white shadow-sm shadow-orange-200' : isSecondMatch ? 'bg-orange-100 text-orange-600' : 'bg-orange-50 text-orange-700 ring-1 ring-orange-100'}`}><IconSparkles size={21} stroke={1.8} aria-hidden="true" /></span>
                        <h3 id={`course-fit-${rec.rank_position}`} className={`font-bold leading-snug tracking-tight text-gray-950 ${isTopMatch ? 'text-base sm:text-lg' : 'text-sm sm:text-base'}`}>Why this course fits you</h3>
                      </div>
                      <p className={`text-sm font-medium text-gray-800 ${isTopMatch ? 'leading-7 sm:text-[15px]' : 'leading-6'}`}>{rec.ai_narrative}</p>
                    </section>
                  )}
                  {rec.score_breakdown && (
                    <div className={`grid grid-cols-2 ${isTopMatch ? 'gap-2' : 'gap-x-5 gap-y-1 border-t border-gray-100 pt-3'}`}>
                      {Object.entries(breakdownLabels).map(([key, label]) => (
                        <div key={key} className={isTopMatch ? 'rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5' : 'flex items-center justify-between gap-2 py-1.5'}>
                          <p className="text-[11px] text-gray-500">{!isTopMatch && key === 'personal_factor_match' ? 'Personal Factors' : label}</p>
                          <p className="text-sm font-bold text-gray-800">{rec.score_breakdown[key] === null || (key === 'interest_match' && rec.interests_available === false) ? 'Not used' : `${rec.score_breakdown[key]}%`}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {shouldShowRequirementsNote(assessment.profile, rec.cluster_category) && (
                  <p className="mt-4 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs leading-relaxed text-blue-800">
                    This program may include activities that require specific accessibility, laboratory, fieldwork, clinical, practicum, or placement arrangements. Requirements and available accommodations may vary by institution.
                  </p>
                )}
                </div>
                <div className={`mt-auto border-t px-5 py-4 ${isTopMatch ? 'flex flex-wrap items-center gap-x-5 gap-y-2 border-orange-100 bg-orange-50/40 sm:px-8' : 'grid grid-cols-1 items-start gap-3 border-gray-100 bg-gray-50/50 sm:grid-cols-[max-content_minmax(0,1fr)] sm:px-6'}`}>
                <button
                onClick={() => navigate(`/results/career-path/${encodeURIComponent(rec.course_code)}`, { state: { recommendations, source: 'results' } })}
                className="lm-action justify-self-start"
              >
                View Career Path →
              </button>
                  <CourseSchoolAction
                    layout={isTopMatch ? 'inline' : 'card'}
                    courseCode={rec.course_code}
                    onClick={() => navigate(`/schools/${encodeURIComponent(rec.course_code)}?source=results`, { state: { source: 'results' } })}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-orange-500 px-3.5 py-2 text-sm font-semibold text-white shadow-sm shadow-orange-200 transition hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
                  >
                    <IconSchool size={16} stroke={2} /> Find Schools in SJDM
                  </CourseSchoolAction>
                </div>
              </div>
              )
            })}
          </div>
          <section className="mt-10 overflow-hidden rounded-3xl border border-stone-200/80 bg-white shadow-[0_4px_24px_-16px_rgba(120,53,15,.15)]" aria-labelledby="assessment-snapshot-title">
            <div className="flex flex-col gap-4 px-5 pb-5 pt-6 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-orange-600">Assessment snapshot</p>
                <h2 id="assessment-snapshot-title" className="mt-1.5 text-lg font-bold tracking-tight text-stone-900 sm:text-xl">Your assessment at a glance</h2>
                <p className="mt-1 text-xs leading-5 text-stone-500">The profile behind your course matches.</p>
              </div>
              {returnDestination.path !== '/college' && (
                <button type="button" onClick={() => navigate('/dashboard/summary')} className="lm-action w-fit shrink-0 gap-2">
                  Open Full Summary <IconArrowUpRight size={15} aria-hidden="true" />
                </button>
              )}
            </div>
            <div className="grid gap-3 px-5 pb-5 md:grid-cols-3 sm:px-6">
              <article className="relative overflow-hidden rounded-2xl border border-orange-100 bg-gradient-to-br from-orange-50/90 to-[#fffcf8] p-5">
                <div className="flex items-center gap-2 text-orange-800"><IconBrain size={17} stroke={1.6} aria-hidden="true" /><h3 className="text-xs font-semibold">Personality type</h3></div>
                <p className="mt-5 text-4xl font-bold tracking-[0.12em] text-orange-600">{assessment.mbti || '\u2014'}</p>
                <p className="mt-2 text-[11px] leading-5 text-orange-900/70">{assessment.mbti ? getExpandedType(assessment.mbti) : 'Your four-letter MBTI result'}</p>
                {personalityInfo && <p className="mt-4 border-t border-orange-200/60 pt-4 text-xs leading-6 text-stone-600">{personalityInfo.summary}</p>}
              </article>
              <article className="rounded-2xl border border-stone-200/70 bg-[#fdfcfb] p-5">
                <div className="flex items-center gap-2 text-stone-600"><IconChartBar size={17} stroke={1.6} className="text-orange-600" aria-hidden="true" /><h3 className="text-xs font-semibold">Academic skills</h3></div>
                <div className="mt-5 flex items-baseline justify-between gap-2">
                  <p className="font-bold tracking-tight text-stone-900"><span className="text-3xl">{skillTotals.total ? skillTotals.correct : '\u2014'}</span>{skillTotals.total > 0 && <span className="ml-1 text-sm font-medium text-stone-400">/ {skillTotals.total}</span>}</p>
                  {skillPercent !== null && <span className="text-xs font-semibold text-orange-700">{skillPercent}% correct</span>}
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-stone-100" aria-hidden="true"><div className="h-full rounded-full bg-orange-400" style={{ width: `${skillPercent ?? 0}%` }} /></div>
                <p className="mt-2 text-[11px] text-stone-500">Correct answers in your latest quiz</p>
                {skillHighlights.length > 0 && <div className="mt-5 border-t border-stone-200/70 pt-4">
                  <p className="text-[10px] font-semibold text-stone-500">Highest-scoring areas in this quiz</p>
                  <ul className="mt-2 space-y-2.5">
                    {skillHighlights.map(([domain, score]) => <li key={domain} className="flex items-center justify-between gap-3 text-xs">
                      <span className="text-stone-600">{domain}</span>
                      <span className="shrink-0 font-semibold tabular-nums text-stone-800">{score.correct}/{score.total}</span>
                    </li>)}
                  </ul>
                </div>}
              </article>
              <article className="rounded-2xl border border-stone-200/70 bg-[#fdfcfb] p-5">
                <div className="flex items-center gap-2 text-stone-600"><IconActivity size={17} stroke={1.6} className="text-orange-600" aria-hidden="true" /><h3 className="text-xs font-semibold">Personal factors</h3></div>
                <p className="mt-5 text-base font-bold tracking-tight text-stone-900">{personalFactorDetails.length ? `${personalFactorDetails.length} reported impact${personalFactorDetails.length === 1 ? '' : 's'}` : 'No reported impacts'}</p>
                <p className="mt-1 text-[11px] text-stone-500">Impact on your studies, as you reported</p>
                {personalFactorDetails.length > 0 ? <ul className="mt-4 space-y-3">
                  {personalFactorDetails.map(factor => <li key={factor.factor} className="flex items-center justify-between gap-3 text-xs">
                    <span className="min-w-0 leading-5 text-stone-600">{factor.label}</span>
                    <span className="shrink-0 rounded-md border border-orange-100 bg-orange-50 px-2 py-0.5 font-semibold tabular-nums text-orange-800">{factor.impact}/4</span>
                  </li>)}
                </ul> : <p className="mt-4 text-xs leading-6 text-stone-500">No reported personal impacts to show.</p>}
              </article>
            </div>
            <div className="mx-5 border-t border-stone-100 py-5 sm:mx-6">
              <div className="mb-3 flex items-center gap-2"><IconBulb size={17} stroke={1.6} className="text-orange-600" aria-hidden="true" /><h3 className="text-xs font-semibold text-stone-700">Selected interests &amp; hobbies</h3>{assessment.interests.length > 0 && <span className="ml-1 text-[11px] text-stone-400">{assessment.interests.length} selected</span>}</div>
              <div className="flex flex-wrap gap-2">
                {assessment.interests.length > 0 ? assessment.interests.map((interest) => (
                  <span key={interest} className="rounded-lg border border-stone-200/80 bg-[#fdfbf8] px-3 py-1.5 text-xs font-medium text-stone-600">{interest}</span>
                )) : <span className="text-xs text-stone-500">No interests available.</span>}
              </div>
            </div>
            <PersonalFactorExplanation factors={personalFactorDetails} />
          </section>

          </>
        )}
        <CompatibilityDisclaimer />
      </div>
      <FeedbackPopup
        promptKey={feedbackMilestoneKey}
        milestoneReached={!loading && !error && recommendations.length > 0}
      />
    </div>
  )
}

export default Results
