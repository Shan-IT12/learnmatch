import { useEffect, useState } from 'react'

const apiUrl = import.meta.env.VITE_API_URL || ''

export default function useActiveCollegePhase() {
  const token = localStorage.getItem('token')
  const [hasActiveCollegePhase, setHasActiveCollegePhase] = useState(token ? null : false)

  useEffect(() => {
    if (!token) {
      return undefined
    }

    const controller = new AbortController()
    fetch(`${apiUrl}/api/college/status`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (response.status === 404) return null
        if (!response.ok) throw new Error('Could not resolve College Phase status.')
        return response.json()
      })
      .then((status) => {
        if (!controller.signal.aborted) setHasActiveCollegePhase(status?.lifecycleStatus === 'active')
      })
      .catch((error) => {
        if (error.name !== 'AbortError') setHasActiveCollegePhase(null)
      })

    return () => controller.abort()
  }, [token])

  return hasActiveCollegePhase
}
