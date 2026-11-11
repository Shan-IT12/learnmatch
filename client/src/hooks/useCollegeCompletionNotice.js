import { useEffect, useState } from 'react'
import { hasSeenCollegeCompletion, markCollegeCompletionSeen } from '../utils/collegeCompletionNotice'

export default function useCollegeCompletionNotice(completionKey) {
  const [notice, setNotice] = useState(() => ({ key: completionKey, open: !hasSeenCollegeCompletion(localStorage, completionKey) }))

  // Reset only when a different account/completed tracking cycle is loaded.
  // Updating during render prevents a stale dialog flashing for the new key.
  if (notice.key !== completionKey) {
    setNotice({ key: completionKey, open: !hasSeenCollegeCompletion(localStorage, completionKey) })
  }

  useEffect(() => {
    if (notice.key && notice.open) markCollegeCompletionSeen(localStorage, notice.key)
  }, [notice.key, notice.open])

  return {
    isOpen: Boolean(completionKey && notice.key === completionKey && notice.open),
    open: () => setNotice({ key: completionKey, open: true }),
    dismiss: () => setNotice({ key: completionKey, open: false }),
  }
}
