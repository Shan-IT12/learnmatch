export const hasValidCoordinates = (value) => Number.isFinite(value?.latitude)
  && value.latitude >= -90
  && value.latitude <= 90
  && Number.isFinite(value?.longitude)
  && value.longitude >= -180
  && value.longitude <= 180

export function getCurrentLocation(geolocation = globalThis.navigator?.geolocation) {
  return new Promise((resolve, reject) => {
    if (!geolocation?.getCurrentPosition) {
      reject(new Error('LOCATION_UNAVAILABLE'))
      return
    }

    geolocation.getCurrentPosition(
      ({ coords }) => hasValidCoordinates(coords) ? resolve({ latitude: coords.latitude, longitude: coords.longitude }) : reject(new Error('LOCATION_UNAVAILABLE')),
      (error) => reject(new Error(error?.code === 1 ? 'LOCATION_PERMISSION_DENIED' : error?.code === 3 ? 'LOCATION_TIMEOUT' : 'LOCATION_UNAVAILABLE')),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    )
  })
}

export function directionsErrorMessage(code) {
  if (code === 'LOCATION_TIMEOUT') return 'GPS took too long to respond. Try again outdoors or when your signal improves.'
  if (code === 'LOCATION_PERMISSION_DENIED') {
    return 'Location permission is required to get directions. School locations and the map are still available.'
  }
  if (code === 'LOCATION_UNAVAILABLE') {
    return 'Your browser could not determine your current location. Please try again.'
  }
  if (code === 'NO_ROUTE') return 'A route to this school could not be calculated.'
  return 'Directions are temporarily unavailable. School locations and the map are still available.'
}

export const routeDistanceLabel = (distanceMeters) => `${(distanceMeters / 1000).toFixed(1)} km`
export const routeDurationLabel = (seconds) => {
  const minutes = Math.max(1, Math.round(seconds / 60))
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} hr ${minutes % 60} min`
}
