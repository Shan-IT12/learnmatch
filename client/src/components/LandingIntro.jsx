import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import './landingIntro.css'

const SESSION_KEY = 'learnmatch:intro-seen'
const DURATION = 3000
const PARTICLE_PATHS = [
  'M40 100 C80 10 200 100 248 218',
  'M190 25 C340 15 180 150 268 218',
  'M440 35 C540 140 340 110 320 218',
  'M575 160 C540 310 395 110 350 218',
  'M560 380 C400 460 470 245 350 230',
  'M365 460 C220 420 395 300 320 230',
  'M100 425 C15 260 240 340 270 230',
  'M20 265 C100 160 170 310 248 230',
]

function shouldPlayIntro() {
  try {
    return !window.matchMedia('(prefers-reduced-motion: reduce)').matches
      && window.sessionStorage.getItem(SESSION_KEY) !== '1'
  } catch {
    return false
  }
}

export default function LandingIntro() {
  const [visible, setVisible] = useState(shouldPlayIntro)

  useEffect(() => {
    if (!visible) return

    const dismiss = () => setVisible(false)
    let timeout = DURATION
    try {
      // Mark at the start so navigation/reloading cannot replay a partial intro.
      window.sessionStorage.setItem(SESSION_KEY, '1')
    } catch {
      timeout = 0
    }
    // Independent of CSS events: disabled/broken animations cannot trap the page.
    const timer = window.setTimeout(dismiss, timeout)
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    motion.addEventListener('change', dismiss)
    // Keep the page accessible immediately when someone starts interacting.
    window.addEventListener('keydown', dismiss)
    window.addEventListener('pointerdown', dismiss)
    return () => {
      window.clearTimeout(timer)
      motion.removeEventListener('change', dismiss)
      window.removeEventListener('keydown', dismiss)
      window.removeEventListener('pointerdown', dismiss)
    }
  }, [visible])

  if (!visible) return null

  return createPortal(
    <div className="lm-intro" aria-hidden="true" onAnimationEnd={(event) => {
      if (event.target === event.currentTarget) setVisible(false)
    }}>
      <div className="lm-intro-scene">
        <svg className="lm-intro-network" viewBox="0 0 600 480" fill="none">
          {PARTICLE_PATHS.map((path, index) => (
            <g key={path} style={{ '--delay': `${index * 25}ms` }}>
              <path className="lm-intro-line" d={path} pathLength="1" />
              <circle className="lm-intro-dot" r={index % 3 ? 2.5 : 3.5}>
                <animateMotion path={path} dur="850ms" begin={`${index * 25}ms`}
                  calcMode="spline" keyTimes="0;1" keyPoints="0;1" keySplines=".4 0 .2 1" fill="freeze" />
              </circle>
            </g>
          ))}
        </svg>
        <span className="lm-intro-logo text-xl font-bold tracking-tight text-gray-900">
          <span className="lm-intro-wordmark">Learn<span className="text-orange-500">Match</span></span>
          <span className="lm-intro-letters">
            {Array.from('LearnMatch').map((letter, index) => (
              <span key={index} className={`lm-intro-letter${index >= 5 ? ' text-orange-500' : ''}`}
                style={{ '--letter-delay': `${350 + index * 55}ms` }}>
                {letter}
              </span>
            ))}
          </span>
          <span className="lm-intro-sweep">LearnMatch</span>
        </span>
        <p className="lm-intro-tagline">Discover yourself. Find your path.</p>
      </div>
    </div>,
    document.body,
  )
}
