import { Link } from 'react-router-dom'
import HeaderBrand from './HeaderBrand'

const linkClass = 'w-fit rounded py-1 text-sm text-gray-600 transition hover:text-orange-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-600'

export default function PublicFooter() {
  return <footer className="relative border-t border-orange-200/60 bg-[linear-gradient(115deg,rgba(255,255,255,.8),rgba(255,237,213,.42))] px-5 pb-5 pt-8 sm:px-8 lg:px-10">
    <div className="mx-auto max-w-[1300px]">
      <div className="grid grid-cols-3 gap-x-4 gap-y-6 lg:grid-cols-[1.6fr_1fr_1fr_1fr] lg:gap-x-8">
        <div className="col-span-3 lg:col-span-1">
          <Link to="/" aria-label="LearnMatch home" className="inline-block rounded focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-600"><HeaderBrand /></Link>
          <p className="mt-3 max-w-xs text-sm leading-6 text-gray-600">A clearer path from your strengths and interests to your course options.</p>
        </div>
        {[['Explore', [['/about', 'About LearnMatch'], ['/#how-it-works', 'How It Works']]], ['Legal', [['/terms', 'Terms & Conditions'], ['/privacy', 'Privacy Notice']]], ['Support', [['/help', 'Help Center'], ['/help#contact-support', 'Contact Support']]]].map(([group, links]) => <nav key={group} aria-label={group}>
          <h2 className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-orange-800">{group}</h2>
          <div className="flex flex-col gap-1">{links.map(([to, label]) => <Link key={to} to={to} className={linkClass}>{label}</Link>)}</div>
        </nav>)}
      </div>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-orange-200/60 pt-4 text-xs text-gray-600">
        <p>© 2026 LearnMatch</p>
      </div>
    </div>
  </footer>
}
