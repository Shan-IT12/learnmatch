import { useCallback, useEffect, useRef, useState } from 'react'
import { directionsErrorMessage, getCurrentLocation, hasValidCoordinates } from '../utils/schoolDirections'
import { distanceFromRoute, watchRouteLocation } from '../utils/routeTracking'

const apiUrl = import.meta.env.VITE_API_URL || ''

export default function useSchoolDirections(contextKey) {
  const [savedDirections, saveDirections] = useState({ status: 'idle', contextKey })
  const directions = savedDirections.contextKey === contextKey ? savedDirections : { status: 'idle' }
  const setDirections = useCallback(value => saveDirections(current => ({
    ...(typeof value === 'function' ? value(current) : value), contextKey,
  })), [contextKey])
  const [tracking, setTracking] = useState(false)
  const [trackingMessage, setTrackingMessage] = useState('')
  const watch = useRef(null)
  const request = useRef(null)
  const generation = useRef(0)
  const stopTracking = useCallback(() => {
    watch.current?.()
    watch.current = null
    setTracking(false)
    setTrackingMessage('')
  }, [])
  const resetDirections = useCallback(() => {
    generation.current++
    request.current?.abort()
    stopTracking()
    setDirections({ status: 'idle' })
  }, [stopTracking, setDirections])

  useEffect(() => {
    // Also discard callbacks from a pending browser location prompt on exit.
    const close = () => { generation.current++; request.current?.abort(); stopTracking() }
    window.addEventListener('pagehide', close)
    const hide = () => { if (document.hidden) stopTracking() }
    document.addEventListener('visibilitychange', hide)
    return () => { close(); window.removeEventListener('pagehide', close); document.removeEventListener('visibilitychange', hide) }
  }, [contextKey, stopTracking])

  const getDirections = async (school) => {
    resetDirections()
    const token = generation.current
    if (!hasValidCoordinates(school)) {
      setDirections({ status: 'error', message: 'Directions unavailable: this campus has no verified destination coordinates.' })
      return
    }
    const controller = new AbortController()
    request.current = controller
    setDirections({ status: 'loading', schoolId: school.school_id })
    const timeout = setTimeout(() => controller.abort(), 25000)
    try {
      const userLocation = await getCurrentLocation()
      if (generation.current !== token) return
      const response = await fetch(`${apiUrl}/api/public/directions`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
        body: JSON.stringify({ origin: userLocation, destination: { latitude: school.latitude, longitude: school.longitude } }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.code || 'DIRECTIONS_UNAVAILABLE')
      if (data.geometry?.type !== 'LineString' || !Array.isArray(data.geometry.coordinates)
        || data.geometry.coordinates.length < 2 || !data.geometry.coordinates.every(([longitude, latitude]) => hasValidCoordinates({ latitude, longitude }))
        || !Number.isFinite(data.distanceMeters) || data.distanceMeters < 0 || !Number.isFinite(data.durationSeconds) || data.durationSeconds < 0) throw new Error('NO_ROUTE')
      if (generation.current === token) setDirections({ status: 'success', schoolId: school.school_id, schoolName: school.school_name, school, userLocation, route: data })
    } catch (error) {
      if (generation.current === token) setDirections({ status: 'error', schoolId: school.school_id, message: directionsErrorMessage(error.message) })
    } finally { clearTimeout(timeout) }
  }

  const startTracking = () => {
    if (directions.status !== 'success' || watch.current) return
    setTracking(true)
    setTrackingMessage('Waiting for a fresh GPS location…')
    const geometry = directions.route.geometry
    watch.current = watchRouteLocation((position) => {
      setDirections(current => current.status === 'success' ? { ...current, userLocation: position } : current)
      const poorAccuracy = !Number.isFinite(position.accuracy) || position.accuracy > 100
      const deviation = distanceFromRoute(position, geometry) > Math.max(100, position.accuracy || 0)
      setTrackingMessage(poorAccuracy ? 'GPS accuracy is low. Your position may be approximate.' : deviation ? 'You appear to be away from the calculated route. Recalculate from your current location.' : 'Location updated. The calculated route does not update automatically.')
    }, (code) => {
      setTrackingMessage(directionsErrorMessage(code))
      if (code === 'LOCATION_PERMISSION_DENIED' || !navigator.geolocation?.watchPosition) {
        watch.current?.(); watch.current = null; setTracking(false)
      }
    })
  }
  return { directions, tracking, trackingMessage, getDirections, resetDirections, startTracking, stopTracking }
}
