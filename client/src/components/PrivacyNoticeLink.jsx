import { useId } from 'react'
import { Link, useLocation } from 'react-router-dom'

export default function PrivacyNoticeLink() {
  const location = useLocation()
  const triggerId = useId()
  return <Link id={triggerId} to="/privacy" state={{ privacyBackground: location, privacyTriggerId: triggerId }} className="rounded font-semibold text-orange-800 underline underline-offset-2 hover:text-orange-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2">Privacy Notice</Link>
}
