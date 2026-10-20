import { useEffect, useState } from 'react'

const apiUrl = import.meta.env.VITE_API_URL || ''
const STATUS_CACHE_MS = 5000
let cachedStatus = null
let statusRequest = null
let cacheGeneration = 0

export function clearCollegeStatusCache() {
  cacheGeneration += 1
  cachedStatus = null
  statusRequest?.controller.abort()
  statusRequest = null
}

function loadCollegeStatus(token) {
  const now = Date.now()
  if (cachedStatus?.token === token && now - cachedStatus.loadedAt < STATUS_CACHE_MS) {
    return Promise.resolve(cachedStatus.value)
  }
  if (statusRequest?.token === token) return statusRequest.promise

  const generation = cacheGeneration
  const controller = new AbortController()
  const promise = fetch(`${apiUrl}/api/college/status`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: controller.signal,
  })
    .then(async (response) => {
      if (!response.ok) throw new Error('Could not resolve College Phase status.')
      const value = await response.json()
      if (generation === cacheGeneration) cachedStatus = { token, loadedAt: Date.now(), value }
      return value
    })
    .finally(() => {
      if (statusRequest?.promise === promise) statusRequest = null
    })

  statusRequest = { token, promise, controller }
  return promise
}

export default function useActiveCollegePhase() {
  const token = localStorage.getItem('token')
  const cachedValue = cachedStatus?.token === token
    ? cachedStatus.value.active === true
    : null
  const [hasActiveCollegePhase, setHasActiveCollegePhase] = useState(token ? cachedValue : false)

  useEffect(() => {
    if (!token) {
      return undefined
    }

    let active = true
    loadCollegeStatus(token)
      .then((status) => {
        if (active) setHasActiveCollegePhase(status?.active === true)
      })
      .catch(() => {
        if (active) setHasActiveCollegePhase(null)
      })

    return () => { active = false }
  }, [token])

  return hasActiveCollegePhase
}
