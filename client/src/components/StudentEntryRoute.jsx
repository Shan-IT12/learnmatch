import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { clearUserAuth } from '../utils/userAuth'

// Only entry pages restore sessions. Public links and admin routes stay independent.
export default function StudentEntryRoute({ children }) {
  const [attempt, setAttempt] = useState(0)
  const [status, setStatus] = useState(() => localStorage.getItem('token') ? 'checking' : 'guest')

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    const token = localStorage.getItem('token')
    if (!token) {
      // Clear any orphaned student identity left without a token.
      if (localStorage.getItem('userId') || localStorage.getItem('username')) clearUserAuth(localStorage)
      return () => { active = false }
    }
    const timer = setTimeout(() => controller.abort(), 15000)
    async function restore() {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/session`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
          signal: controller.signal,
        })
        if (!active || localStorage.getItem('token') !== token) return
        if (response.status === 401 || response.status === 403) {
          clearUserAuth(localStorage)
          setStatus('guest')
          return
        }
        if (!response.ok) throw new Error('Session verification failed')
        const session = await response.json()
        if (!active || localStorage.getItem('token') !== token) return
        if (!Number.isInteger(session.userId) || typeof session.username !== 'string') throw new Error('Invalid session response')
        // Keep the original token and existing student drafts; refresh identity only.
        localStorage.setItem('userId', String(session.userId))
        localStorage.setItem('username', session.username)
        setStatus('authenticated')
      } catch {
        if (active && localStorage.getItem('token') === token) setStatus('error')
      } finally {
        clearTimeout(timer)
      }
    }
    restore()
    return () => {
      active = false
      clearTimeout(timer)
      controller.abort()
    }
  }, [attempt])

  if (status === 'authenticated') return <Navigate to="/dashboard" replace />
  if (status === 'guest') return children
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#fbf8f3] px-6 text-gray-900">
      <div className="max-w-md text-center">
        {status === 'checking' ? <p role="status">Checking your session...</p> : <>
          <p role="alert">We couldn't verify your session. Check your connection and try again.</p>
          <button type="button" className="mt-5 rounded-xl bg-orange-500 px-6 py-3 font-semibold text-white" onClick={() => { setStatus('checking'); setAttempt(value => value + 1) }}>Retry</button>
          <nav aria-label="Public information" className="mt-6 flex flex-wrap justify-center gap-4 text-sm underline">
            <Link to="/privacy">Privacy Notice</Link><Link to="/terms">Terms</Link><Link to="/about">About</Link><Link to="/help">Help</Link>
          </nav>
        </>}
      </div>
    </main>
  )
}
