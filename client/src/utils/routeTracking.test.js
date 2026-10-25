import test from 'node:test'
import assert from 'node:assert/strict'
import { distanceFromRoute, watchRouteLocation } from './routeTracking.js'
import { routeDurationLabel, getCurrentLocation } from './schoolDirections.js'
const geometry = { type: 'LineString', coordinates: [[121.06, 14.81], [121.07, 14.81]] }
test('deviation uses route segments rather than just vertices', () => {
  assert.ok(distanceFromRoute({ latitude: 14.81, longitude: 121.065 }, geometry) < 1)
  assert.ok(distanceFromRoute({ latitude: 14.82, longitude: 121.065 }, geometry) > 1000)
})
test('simulated GPS updates retain only latest callback and stop after cleanup', () => {
  let success, fail, cleared, updates = 0, error
  const geo = { watchPosition(s, f, options) { success = s; fail = f; assert.equal(options.maximumAge, 0); return 7 }, clearWatch(id) { cleared = id } }
  const stop = watchRouteLocation(() => updates++, code => { error = code }, geo)
  success({ coords: { latitude: 14.81, longitude: 121.06, accuracy: 10 }, timestamp: 1 })
  fail({ code: 3 }); assert.equal(error, 'LOCATION_TIMEOUT')
  fail({ code: 1 }); assert.equal(error, 'LOCATION_PERMISSION_DENIED')
  stop(); assert.equal(cleared, 7)
  success({ coords: { latitude: 14.82, longitude: 121.06 }, timestamp: 2 })
  assert.equal(updates, 1)
})
test('unsupported GPS and invalid fixes are handled', async () => {
  let error
  watchRouteLocation(() => assert.fail(), code => { error = code }, null)()
  assert.equal(error, 'LOCATION_UNAVAILABLE')
  await assert.rejects(getCurrentLocation({ getCurrentPosition(s) { s({ coords: { latitude: NaN, longitude: 121 } }) } }), /LOCATION_UNAVAILABLE/)
})
test('estimated duration shows minutes and hours', () => {
  assert.equal(routeDurationLabel(120), '2 min')
  assert.equal(routeDurationLabel(3820), '1 hr 4 min')
})
