import { hasValidCoordinates } from './schoolDirections.js'

// Distance to the nearest route segment, in metres (local equirectangular projection).
export function distanceFromRoute(location, geometry) {
  if (!hasValidCoordinates(location) || geometry?.type !== 'LineString' || geometry.coordinates.length < 2) return Infinity
  const scale = Math.cos(location.latitude * Math.PI / 180)
  const project = ([lon, lat]) => [(lon - location.longitude) * scale * 111195, (lat - location.latitude) * 111195]
  let nearest = Infinity
  for (let i = 1; i < geometry.coordinates.length; i++) {
    const [ax, ay] = project(geometry.coordinates[i - 1])
    const [bx, by] = project(geometry.coordinates[i])
    const dx = bx - ax, dy = by - ay
    const t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy || 1)))
    nearest = Math.min(nearest, Math.hypot(ax + t * dx, ay + t * dy))
  }
  return nearest
}

// Owns a single watch. No position history or persistence; callers retain only the latest fix.
export function watchRouteLocation(onLocation, onError, geolocation = globalThis.navigator?.geolocation) {
  if (!geolocation?.watchPosition) {
    onError('LOCATION_UNAVAILABLE')
    return () => {}
  }
  let active = true
  let id
  const fail = (code) => { if (active) onError(code) }
  try { id = geolocation.watchPosition(({ coords, timestamp }) => {
    if (!active) return
    if (!hasValidCoordinates(coords)) return onError('LOCATION_UNAVAILABLE')
    onLocation({ latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy, timestamp })
  }, (error) => {
    if (active) onError(error?.code === 1 ? 'LOCATION_PERMISSION_DENIED' : error?.code === 3 ? 'LOCATION_TIMEOUT' : 'LOCATION_UNAVAILABLE')
  }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }) } catch {
    fail('LOCATION_UNAVAILABLE')
  }
  return () => { active = false; if (id != null) geolocation.clearWatch(id) }
}
