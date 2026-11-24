import { useEffect, useRef, useState } from 'react'

const GOOGLE_GSI_SCRIPT_ID = 'learnmatch-google-gsi'
const GOOGLE_GSI_SRC = 'https://accounts.google.com/gsi/client'

function loadGoogleGsiScript() {
  if (typeof window === 'undefined') return Promise.resolve(false)
  if (window.google?.accounts?.id) return Promise.resolve(true)
  return new Promise((resolve) => {
    const existing = document.getElementById(GOOGLE_GSI_SCRIPT_ID)
    if (existing) {
      existing.addEventListener('load', () => resolve(Boolean(window.google?.accounts?.id)), { once: true })
      existing.addEventListener('error', () => resolve(false), { once: true })
      return
    }
    const script = document.createElement('script')
    script.id = GOOGLE_GSI_SCRIPT_ID
    script.src = GOOGLE_GSI_SRC
    script.async = true
    script.defer = true
    script.onload = () => resolve(Boolean(window.google?.accounts?.id))
    script.onerror = () => resolve(false)
    document.head.appendChild(script)
  })
}

export default function GoogleSignInButton({ onSuccess, onError, disabled = false, text = 'continue_with' }) {
  const clientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim()
  const buttonRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [gsiReady, setGsiReady] = useState(false)
  const callbacksRef = useRef({ onSuccess, onError })

  useEffect(() => {
    callbacksRef.current = { onSuccess, onError }
  }, [onSuccess, onError])

  useEffect(() => {
    if (!clientId) return undefined
    let cancelled = false

    loadGoogleGsiScript().then((loaded) => {
      if (cancelled || !loaded || !buttonRef.current || !window.google?.accounts?.id) return
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (response) => {
          const credential = response?.credential
          if (!credential) {
            callbacksRef.current.onError?.('Google sign-in did not return a credential. Please try again.')
            return
          }
          setBusy(true)
          try {
            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/google`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ credential }),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
              callbacksRef.current.onError?.(data.message || 'Could not sign in with Google.')
              return
            }
            callbacksRef.current.onSuccess?.(data)
          } catch {
            callbacksRef.current.onError?.('Cannot connect to server. Please try again.')
          } finally {
            setBusy(false)
          }
        },
      })
      buttonRef.current.innerHTML = ''
      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: 'outline',
        size: 'large',
        shape: 'pill',
        text,
        width: Math.min(400, Math.max(260, buttonRef.current.offsetWidth || 360)),
      })
      setGsiReady(true)
    })

    return () => {
      cancelled = true
    }
  }, [clientId, text])

  // Graceful degradation: hide cleanly when VITE_GOOGLE_CLIENT_ID is not configured.
  if (!clientId) return null

  return (
    <div className="mt-5">
      <div className="relative my-5 flex items-center justify-center">
        <div className="w-full border-t border-stone-200" />
        <span className="bg-white/90 px-3 text-xs font-medium uppercase tracking-wider text-gray-400">or</span>
        <div className="w-full border-t border-stone-200" />
      </div>
      <div className={`flex flex-col items-center ${disabled || busy ? 'pointer-events-none opacity-60' : ''}`}>
        <div ref={buttonRef} className="flex min-h-[44px] w-full items-center justify-center" />
        {!gsiReady && (
          <p className="mt-1 text-xs text-gray-400">Loading Google Sign-In…</p>
        )}
        {busy && (
          <p className="mt-2 text-xs font-medium text-orange-700">Signing in with Google…</p>
        )}
      </div>
    </div>
  )
}
