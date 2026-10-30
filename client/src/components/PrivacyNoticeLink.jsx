import { Link } from 'react-router-dom'

export default function PrivacyNoticeLink({ to = '/privacy', children = 'Privacy Notice' }) {
  return <Link to={to} target="_blank" rel="noopener noreferrer" title="Opens in a new tab" className="rounded font-semibold text-orange-800 underline underline-offset-2 hover:text-orange-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2">{children}</Link>
}
