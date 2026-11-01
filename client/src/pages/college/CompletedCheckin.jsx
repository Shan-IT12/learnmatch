import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CheckinResult } from './SemesterCheckin'

export default function CompletedCheckin() {
  const { checkinId } = useParams()
  const navigate = useNavigate()
  const token = localStorage.getItem('token')
  const [state, setState] = useState({ id: null, result: null, error: '' })
  useEffect(() => {
    if (!token) { navigate('/login', { replace: true }); return undefined }
    const controller = new AbortController()
    const load = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/college/checkin/results/${encodeURIComponent(checkinId)}`, {
          headers: { Authorization: `Bearer ${token}` }, signal: controller.signal,
        })
        if (response.status === 401 || response.status === 403) { navigate('/login', { replace: true }); return }
        const data = await response.json()
        if (!response.ok || !data.result) throw new Error(data.message || 'Could not load your completed check-in.')
        setState({ id: checkinId, result: data.result, error: '' })
      } catch (error) {
        if (error.name !== 'AbortError') setState({ id: checkinId, result: null, error: error.message || 'Could not load your completed check-in.' })
      }
    }
    load()
    return () => controller.abort()
  }, [checkinId, navigate, token])

  if (state.id !== checkinId) return <main className="mx-auto max-w-5xl px-5 py-12"><p role="status" className="text-sm text-gray-600">Loading your completed check-in...</p></main>
  if (state.error) return <main className="mx-auto max-w-5xl px-5 py-12"><p role="alert" className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">{state.error}</p><button type="button" onClick={() => navigate('/college')} className="mt-5 rounded-xl bg-orange-500 px-5 py-3 text-sm font-semibold text-white hover:bg-orange-600">Back to College Dashboard</button></main>
  return <CheckinResult result={state.result} courseName={state.result.courseName} termLabel={state.result.termLabel || state.result.semester} phase={state.result.phase} onBack={() => navigate('/college')} />
}
