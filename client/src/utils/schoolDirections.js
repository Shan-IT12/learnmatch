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
      ({ coords }) => resolve({ latitude: coords.latitude, longitude: coords.longitude }),
      (error) => reject(new Error(error?.code === 1 ? 'LOCATION_PERMISSION_DENIED' : 'LOCATION_UNAVAILABLE')),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    )
  })
}

export function directionsErrorMessage(code) {
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
