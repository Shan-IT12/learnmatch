const DIRECTIONS_ENDPOINT = 'https://api.heigit.org/openrouteservice/v2/directions/driving-car/geojson'

export class DirectionsError extends Error {
  constructor(message, code, status) {
    super(message)
    this.name = 'DirectionsError'
    this.code = code
    this.status = status
  }
}

export function normalizeCoordinate(value) {
  const latitude = value?.latitude
  const longitude = value?.longitude
  if (typeof latitude !== 'number' || !Number.isFinite(latitude) || latitude < -90 || latitude > 90
    || typeof longitude !== 'number'
    || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new DirectionsError('Invalid route coordinates.', 'INVALID_COORDINATES', 400)
  }
  return { latitude, longitude }
}

const normalizedRoute = (body) => {
  const feature = body?.features?.[0]
  const coordinates = feature?.geometry?.coordinates
  const summary = feature?.properties?.summary
  if (feature?.geometry?.type !== 'LineString'
    || !Array.isArray(coordinates)
    || coordinates.length < 2
    || !coordinates.every((point) => Array.isArray(point)
      && point.length >= 2
      && Number.isFinite(point[0])
      && point[0] >= -180
      && point[0] <= 180
      && Number.isFinite(point[1])
      && point[1] >= -90
      && point[1] <= 90)
    || !Number.isFinite(summary?.distance)
    || summary.distance < 0
    || !Number.isFinite(summary?.duration)
    || summary.duration < 0) {
    throw new DirectionsError('A route could not be calculated.', 'NO_ROUTE', 422)
  }

  return {
    geometry: { type: 'LineString', coordinates },
    distanceMeters: summary.distance,
    durationSeconds: summary.duration,
  }
}

export async function getDrivingDirections(
  input,
  {
    apiKey = process.env.OPENROUTESERVICE_API_KEY,
    fetchImpl = globalThis.fetch,
    timeoutMs = 8000,
  } = {}
) {
  const origin = normalizeCoordinate(input?.origin)
  const destination = normalizeCoordinate(input?.destination)

  if (!apiKey || typeof fetchImpl !== 'function') {
    throw new DirectionsError('Directions are temporarily unavailable.', 'DIRECTIONS_UNAVAILABLE', 503)
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetchImpl(DIRECTIONS_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: apiKey,
        Accept: 'application/geo+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        coordinates: [
          [origin.longitude, origin.latitude],
          [destination.longitude, destination.latitude],
        ],
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      if ([400, 404, 422].includes(response.status)) {
        throw new DirectionsError('A route could not be calculated.', 'NO_ROUTE', 422)
      }
      throw new DirectionsError('Directions are temporarily unavailable.', 'DIRECTIONS_UNAVAILABLE', 503)
    }

    return normalizedRoute(await response.json())
  } catch (error) {
    if (error instanceof DirectionsError) throw error
    throw new DirectionsError('Directions are temporarily unavailable.', 'DIRECTIONS_UNAVAILABLE', 503)
  } finally {
    clearTimeout(timeout)
  }
}
