import test from 'node:test'
import assert from 'node:assert/strict'
import {
  directionsErrorMessage,
  getCurrentLocation,
  hasValidCoordinates,
  routeDistanceLabel,
} from './schoolDirections.js'
import sjdmBoundary from '../data/sjdmBoundaryGeoJson.js'

test('location permission denial is normalized without breaking locator state', async () => {
  await assert.rejects(
    getCurrentLocation({ getCurrentPosition(_success, error) { error({ code: 1 }) } }),
    /LOCATION_PERMISSION_DENIED/
  )
  assert.match(directionsErrorMessage('LOCATION_PERMISSION_DENIED'), /permission is required/i)
})

test('missing geolocation and invalid school coordinates are handled safely', async () => {
  await assert.rejects(getCurrentLocation(null), /LOCATION_UNAVAILABLE/)
  assert.equal(hasValidCoordinates({ latitude: null, longitude: null }), false)
  assert.equal(hasValidCoordinates({ latitude: 14.81, longitude: 121.06 }), true)
})

test('route distance is formatted for the directions UI', () => {
  assert.equal(routeDistanceLabel(7420), '7.4 km')
})

test('local boundary is the verified SJDM PSGC feature', () => {
  assert.equal(sjdmBoundary.type, 'Feature')
  assert.equal(sjdmBoundary.properties.psgc, '0301420000')
  assert.equal(sjdmBoundary.properties.sourceCorrespondenceCode, '031420000')
  assert.equal(sjdmBoundary.geometry.type, 'Polygon')
  assert.ok(sjdmBoundary.geometry.coordinates[0].length > 20)
})
