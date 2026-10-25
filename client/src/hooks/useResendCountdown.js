import { useEffect, useState } from 'react'

// Use a deadline so background-tab throttling never extends the cooldown.
export default function useResendCountdown(availableAt = 0) {
  const [now, setNow] = useState(Date.now)
  // A newly requested code starts at 60 even if the previous timer was idle.
  const secondsRemaining = Math.max(0, Math.min(60, Math.ceil((availableAt - now) / 1000)))
  const active = secondsRemaining > 0
  useEffect(() => {
    if (!active) return undefined
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [active])
  return secondsRemaining
}
