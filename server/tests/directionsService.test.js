import test from 'node:test'
import assert from 'node:assert/strict'
import { getDrivingDirections } from '../services/directionsService.js'

const validInput = {
  origin: { latitude: 14.5995, longitude: 120.9842 },
  destination: { latitude: 14.81028, longitude: 121.06149 },
}

const successfulFetch = async (url, options) => ({
  ok: true,
  status: 200,
  async json() {
    return {
      features: [{
        geometry: {
          type: 'LineString',
          coordinates: [[120.9842, 14.5995], [121.06149, 14.81028]],
        },
        properties: { summary: { distance: 32100.4, duration: 3820.2 } },
      }],
    }
  },
  request: { url, options },
})

test('valid coordinates return a normalized driving route through the HeiGIT endpoint', async () => {
  let request
  const route = await getDrivingDirections(validInput, {
    apiKey: 'server-only-key',
    fetchImpl: async (url, options) => {
      request = { url, options }
      return successfulFetch(url, options)
    },
  })

  assert.equal(request.url, 'https://api.heigit.org/openrouteservice/v2/directions/driving-car/geojson')
  assert.equal(request.options.headers.Authorization, 'server-only-key')
  assert.deepEqual(JSON.parse(request.options.body).coordinates, [
    [120.9842, 14.5995],
    [121.06149, 14.81028],
  ])
  assert.deepEqual(route, {
    geometry: {
      type: 'LineString',
      coordinates: [[120.9842, 14.5995], [121.06149, 14.81028]],
    },
    distanceMeters: 32100.4,
    durationSeconds: 3820.2,
  })
})

for (const input of [
  { ...validInput, origin: { latitude: 91, longitude: 121 } },
  { ...validInput, destination: { latitude: 14, longitude: -181 } },
  { ...validInput, origin: { latitude: 'not-a-number', longitude: 121 } },
  { ...validInput, origin: { latitude: null, longitude: 121 } },
]) {
  test('invalid latitude or longitude is rejected before the upstream request', async () => {
    let called = false
    await assert.rejects(
      getDrivingDirections(input, {
        apiKey: 'key',
        fetchImpl: async () => { called = true },
      }),
      (error) => error.code === 'INVALID_COORDINATES' && error.status === 400
    )
    assert.equal(called, false)
  })
}

test('missing API key fails safely without making a request', async () => {
  let called = false
  await assert.rejects(
    getDrivingDirections(validInput, {
      apiKey: '',
      fetchImpl: async () => { called = true },
    }),
    (error) => error.code === 'DIRECTIONS_UNAVAILABLE' && error.status === 503
  )
  assert.equal(called, false)
})

test('upstream failure and malformed route data fail safely', async () => {
  await assert.rejects(
    getDrivingDirections(validInput, {
      apiKey: 'key',
      fetchImpl: async () => ({ ok: false, status: 503 }),
    }),
    (error) => error.code === 'DIRECTIONS_UNAVAILABLE' && error.status === 503
  )
  await assert.rejects(
    getDrivingDirections(validInput, {
      apiKey: 'key',
      fetchImpl: async () => ({ ok: true, async json() { return { features: [] } } }),
    }),
    (error) => error.code === 'NO_ROUTE' && error.status === 422
  )
})

test('an origin outside SJDM is accepted and returned when routing succeeds', async () => {
  const route = await getDrivingDirections(validInput, {
    apiKey: 'key',
    fetchImpl: successfulFetch,
  })
  assert.deepEqual(route.geometry.coordinates[0], [120.9842, 14.5995])
})
