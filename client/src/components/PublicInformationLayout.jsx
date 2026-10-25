import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import HeaderBrand from './HeaderBrand'
import PublicFooter from './PublicFooter'

export default function PublicInformationLayout({ title, eyebrow = 'LearnMatch', introduction, children }) {
  const location = useLocation()
  const navigate = useNavigate()
  const background = location.state?.privacyBackground
  // Keep a registration/assessment form mounted across related information links.
  const followInformationLink = (event) => {
    if (!background || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    const anchor = event.target.closest('a[href]')
    if (!anchor || anchor.target === '_blank') return
    const target = new URL(anchor.href)
    if (target.origin !== window.location.origin || !['/privacy', '/terms', '/about', '/help'].includes(target.pathname)) return
    event.preventDefault()
    event.stopPropagation()
    navigate(target.pathname + target.hash, { state: { ...location.state, privacyReturnSteps: (location.state?.privacyReturnSteps || 1) + 1 } })
  }
  return <div onClickCapture={followInformationLink} className="min-h-screen bg-[var(--lm-landing-background)] text-gray-900">
    <a href="#public-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:rounded-xl focus:bg-white focus:p-4">Skip to content</a>
    <header className="border-b border-orange-100/80 bg-white/75 px-5 py-5 sm:px-8">
      <div className="mx-auto flex max-w-[1300px] flex-wrap items-center justify-between gap-4">
        <Link to="/" aria-label="LearnMatch home" className="rounded focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-600"><HeaderBrand /></Link>
        {background ? <button type="button" autoFocus onClick={() => navigate(-(location.state?.privacyReturnSteps || 1))} className="lm-action">{background.pathname === '/register' ? 'Back to registration' : background.pathname === '/settings' ? 'Back to Settings' : 'Back to assessment'}</button> : <Link to="/" className="lm-action">Back to LearnMatch</Link>}
      </div>
      <nav aria-label="Public information" className="mx-auto mt-5 flex max-w-[1300px] flex-wrap gap-x-5 gap-y-3 text-sm">
        {[['/about', 'About'], ['/help', 'Help Center'], ['/terms', 'Terms & Conditions'], ['/privacy', 'Privacy Notice']].map(([to, label]) => <NavLink key={to} to={to} className={({ isActive }) => `rounded py-1 font-semibold transition hover:text-orange-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-600 ${isActive ? 'text-orange-800 underline underline-offset-8' : 'text-gray-600'}`}>{label}</NavLink>)}
      </nav>
    </header>
    <main id="public-content" className="mx-auto max-w-4xl px-5 py-9 sm:px-8 sm:py-12">
      <header className="mb-8">
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-orange-800">{eyebrow}</p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
        {introduction && <div className="mt-4 text-base leading-7 text-gray-600">{introduction}</div>}
      </header>
      {children}
    </main>
    <PublicFooter />
  </div>
}
