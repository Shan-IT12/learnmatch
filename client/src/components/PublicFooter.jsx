import { Link } from 'react-router-dom'
import HeaderBrand from './HeaderBrand'

export default function PublicFooter() {
  return <footer className="border-t border-orange-100/70 px-5 py-6 sm:px-8 lg:px-10">
    <div className="mx-auto flex max-w-[1380px] flex-col items-center justify-between gap-3 sm:flex-row">
      <HeaderBrand />
      <Link to="/privacy" className="rounded text-sm font-medium text-gray-700 underline underline-offset-2 hover:text-orange-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2">Privacy Notice</Link>
      <p className="text-xs text-gray-500">© 2026 LearnMatch</p>
    </div>
  </footer>
}
