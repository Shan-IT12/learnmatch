import { useEffect, useState } from 'react'
import { IconActivity, IconBrain, IconBulb, IconChartBar, IconSchool, IconSparkles } from '@tabler/icons-react'
import './recommendationsLoading.css'

const assessmentSources = [
  { label: 'Academic Skills', detail: 'Your strengths', icon: IconChartBar },
  { label: 'Interests', detail: 'What you enjoy', icon: IconBulb },
  { label: 'Personality', detail: 'How you approach things', icon: IconBrain },
  { label: 'Personal Factors', detail: 'Your circumstances', icon: IconActivity },
]

const matchingHeadlines = [
  'Finding courses that fit you',
  'Connecting your strengths to courses',
  'Exploring your course matches',
]

export default function RecommendationsLoadingState({ progress = 0, status = 'Checking your assessment' }) {
  const [headlineIndex, setHeadlineIndex] = useState(0)

  useEffect(() => {
    const interval = window.setInterval(() => {
      setHeadlineIndex(index => (index + 1) % matchingHeadlines.length)
    }, 4000)
    return () => window.clearInterval(interval)
  }, [])

  return (
    <section className="lm-matching" aria-busy={progress < 100} aria-label="Generating course recommendations">
      <div className="lm-matching-wash" aria-hidden="true" />
      <div className="relative">
        <div className="lm-matching-eyebrow"><IconSparkles size={14} aria-hidden="true" /> A future that fits you</div>
        <div className="lm-matching-visual" aria-hidden="true">
          <div className="lm-matching-ring lm-matching-ring-outer" />
          <div className="lm-matching-ring lm-matching-ring-inner" />
          <span className="lm-matching-orbit"><span /></span>
          <div className="lm-matching-symbol"><IconSchool size={45} stroke={1.5} /></div>
          <span className="lm-matching-spark lm-matching-spark-one"><IconSparkles size={20} stroke={1.5} /></span>
          <span className="lm-matching-spark lm-matching-spark-two"><IconSparkles size={14} stroke={1.5} /></span>
        </div>
        <div>
          <h1 className="lm-matching-title" aria-live="off"><span key={headlineIndex} className="lm-matching-headline">{matchingHeadlines[headlineIndex]}<span className="lm-matching-period">.</span></span></h1>
          <p className="lm-matching-description">Bringing your assessment answers together to find the college courses that fit you.</p>
        </div>
        <div className="lm-matching-sources" aria-label="Your assessment categories">
          {assessmentSources.map(({ label, detail, icon: SourceIcon }) => (
            <div className="lm-matching-source" key={label}>
              <span className="lm-matching-source-icon"><SourceIcon size={20} stroke={1.6} aria-hidden="true" /></span>
              <p>{label}</p>
              <span className="lm-matching-source-detail">{detail}</span>
            </div>
          ))}
        </div>
        <div className="lm-matching-status">
          <div className="lm-matching-progress-label"><span>{progress === 100 ? 'Ready to view' : 'Getting your results ready'}</span><strong>{progress}%</strong></div>
          <div className="lm-matching-track" role="progressbar" aria-label="Recommendation preparation" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-valuetext={`${progress}% complete. ${status}`}><span style={{ width: `${progress}%` }} /></div>
          <p role="status" aria-live="polite">{status}{progress < 100 && <span aria-hidden="true">...</span>}</p>
          <span>{progress === 100 ? 'Opening your course matches.' : 'Progress updates as each preparation step finishes.'}</span>
        </div>
      </div>
    </section>
  )
}
