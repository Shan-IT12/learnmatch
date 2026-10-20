import { useEffect, useState } from 'react'
import { clearStudentBrowserData } from '../utils/userAuth'
import { clearCollegeStatusCache } from '../hooks/useActiveCollegePhase'

function currentToken() {
  try { return localStorage.getItem('token') } catch { return null }
}

// Unmount sensitive in-memory views as well as clearing persisted browser drafts.
export default function StudentSessionBoundary({ children }) {
  const [generation, setGeneration] = useState(0)
  useEffect(() => {
    let activeToken = currentToken()
    const reset = () => {
      clearCollegeStatusCache()
      activeToken = currentToken()
      setGeneration(value => value + 1)
    }
    const onPageShow = () => {
      if (activeToken !== currentToken()) {
        clearStudentBrowserData(localStorage)
        window.location.replace('/login')
      }
    }
    const onStorage = (event) => {
      if (!['token', 'userId', null].includes(event.key) || (event.key !== null && event.oldValue === event.newValue)) return
      try { if (event.storageArea !== localStorage) return } catch { return }
      clearStudentBrowserData(localStorage)
      // Another tab changed identity. Reload to discard pending responses and UI state.
      window.location.replace('/login')
    }
    window.addEventListener('learnmatch:auth-change', reset)
    window.addEventListener('storage', onStorage)
    window.addEventListener('pageshow', onPageShow)
    return () => {
      window.removeEventListener('learnmatch:auth-change', reset)
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('pageshow', onPageShow)
    }
  }, [])
  return <div key={generation}>{children}</div>
}
