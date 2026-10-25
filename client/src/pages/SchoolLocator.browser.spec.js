import { test, expect } from '@playwright/test'
import evidence from '../../../server/data/schoolLocatorVerifiedOfferings.json' with { type: 'json' }

const schoolResult = schools => ({ course: { course_code: 'CRS062', course_name: 'Bachelor of Science in Information Technology', course_abbreviation: 'BSIT' }, location_scope: 'San Jose del Monte, Bulacan', schools: schools.map((s,i) => ({ ...s, school_id: i+1, offerings: [{ program_name: 'Synthetic QA course' }] })) })
let requests

test.beforeEach(async ({ page }) => {
  requests = []
  page.on('pageerror', e => { throw e })
  // Block every external request, including map tiles: this suite is localhost only.
  await page.route('**/*', route => {
    const url = new URL(route.request().url())
    return ['127.0.0.1', 'localhost'].includes(url.hostname) ? route.continue() : route.abort()
  })
  await page.route('**/api/**', route => route.fulfill({ json: {} }))
  await page.route('**/api/public/courses/*/schools', route => route.fulfill({ json: schoolResult([evidence.schools.find(s => s.uii === '13228')]) }))
  await page.route('**/api/public/directions', route => {
    const body = route.request().postDataJSON(); requests.push(body)
    return route.fulfill({ json: { geometry: { type: 'LineString', coordinates: [[body.origin.longitude,body.origin.latitude],[body.destination.longitude,body.destination.latitude]] }, distanceMeters: 7420, durationSeconds: 900 } })
  })
  await page.addInitScript(() => {
    window.gpsMode = 'success'; window.watchStarts = 0; window.watchStops = 0
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: {
      getCurrentPosition(success, error) {
        if (window.gpsMode === 'denied') error({ code: 1 })
        else if (window.gpsMode === 'timeout') error({ code: 3 })
        else success({ coords: { latitude: 14.80, longitude: 121.06, accuracy: 10 } })
      },
      watchPosition(success, error) { window.watchStarts++; window.gpsUpdate = success; window.gpsError = error; return 9 },
      clearWatch(id) { if (id === 9) window.watchStops++ },
    } })
  })
})
async function directions(page) {
  await page.getByRole('button', { name: 'Get Directions', exact: true }).click()
  await page.getByRole('button', { name: 'Continue to location permission', exact: true }).click()
}

test('all 13 school cards, coordinate availability and route destinations', async ({ page }) => {
  for (const school of evidence.schools) {
    await page.route('**/api/public/courses/*/schools', route => route.fulfill({ json: schoolResult([school]) }))
    await page.goto('/schools/CRS062')
    await expect(page.getByRole('heading', { name: school.school_name, exact: true })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    if (school.latitude == null) {
      await expect(page.getByRole('button', { name: 'Get Directions', exact: true })).toHaveCount(0)
      await expect(page.getByText('Directions unavailable: reviewed map coordinates are not available.')).toBeVisible()
    } else {
      await page.getByRole('button', { name: 'Show on map', exact: true }).click()
      await directions(page)
      await expect(page.getByText('7.4 km', { exact: true })).toBeVisible()
      await expect(page.getByText('Estimated driving time:', { exact: false })).toHaveCount(0)
      expect(requests.at(-1)).toEqual({ origin: { latitude: 14.80, longitude: 121.06 }, destination: { latitude: school.latitude, longitude: school.longitude } })
      await expect(page.locator('.leaflet-interactive').last()).toBeVisible()
    }
  }
})

test('permission denial, GPS timeout, service errors and retry', async ({ page }) => {
  await page.goto('/schools/CRS062')
  for (const mode of ['denied','timeout']) {
    await page.evaluate(mode => { window.gpsMode=mode },mode)
    await directions(page)
    await expect(page.getByText(mode==='denied' ? /Location permission is required/ : /GPS took too long/)).toBeVisible()
  }
  expect(requests).toHaveLength(0)
  await page.evaluate(() => { window.gpsMode='success' })
  await page.route('**/api/public/directions', route => route.fulfill({ status: 503, json: { code: 'DIRECTIONS_UNAVAILABLE' } }))
  await directions(page)
  await expect(page.getByText(/Directions are temporarily unavailable/)).toBeVisible()
  await page.route('**/api/public/directions', route => route.fulfill({ json: { geometry: { type: 'LineString', coordinates: [] } } }))
  await directions(page)
  await expect(page.getByText('A route to this school could not be calculated.')).toBeVisible()
})

test('tracking requires consent, reports deviation and GPS errors, stops and cleans up on exit', async ({ page }) => {
  await page.goto('/schools/CRS062'); await directions(page)
  await expect(page.getByRole('button', { name: 'Track Route', exact: true })).toBeVisible()
  expect(await page.evaluate(() => window.watchStarts)).toBe(0)
  await page.getByRole('button', { name: 'Track Route', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('does not provide turn-by-turn')
  expect(await page.evaluate(() => window.watchStarts)).toBe(0)
  await page.getByRole('button', { name: 'Continue to location permission', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Stop Tracking', exact: true })).toBeVisible()
  await page.evaluate(() => window.gpsUpdate({ coords: { latitude:14.85,longitude:121.02,accuracy:10 },timestamp:Date.now() }))
  await expect(page.getByText(/away from the calculated route/)).toBeVisible()
  await page.evaluate(() => window.gpsError({ code:3 }))
  await expect(page.getByText(/GPS took too long/)).toBeVisible()
  await page.getByRole('button', { name: 'Stop Tracking', exact: true }).click()
  expect(await page.evaluate(() => window.watchStops)).toBe(1)
  await page.getByRole('button', { name: 'Track Route', exact: true }).click()
  await page.getByRole('button', { name: 'Continue to location permission', exact: true }).click()
  await page.getByRole('button', { name: 'Recalculate route', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Track Route', exact: true })).toBeVisible()
  expect(await page.evaluate(() => window.watchStops)).toBe(2)
  await page.getByRole('button', { name: 'Track Route', exact: true }).click()
  await page.getByRole('button', { name: 'Continue to location permission', exact: true }).click()
  await page.getByRole('link', { name: /Back to/ }).first().click()
  await expect(page).toHaveURL(/\/courses\/CRS062/)
  await expect.poll(() => page.evaluate(() => window.watchStops)).toBe(3)
})

test('no verified offering is explicit', async ({ page }) => {
  await page.route('**/api/public/courses/*/schools', route => route.fulfill({ json: schoolResult([]) }))
  await page.goto('/schools/CRS062')
  await expect(page.getByRole('heading', { name: 'No verified SJDM school offering is currently available for this course.' })).toBeVisible()
})

test('Cancel Route clears calculated and tracked routes and stops GPS watching', async ({ page }) => {
  await page.goto('/schools/CRS062')
  for (const track of [false, true]) {
    await directions(page)
    await expect(page.getByRole('button', { name: 'Track Route', exact: true })).toBeVisible()
    if (track) {
      await page.getByRole('button', { name: 'Track Route', exact: true }).click()
      await page.getByRole('button', { name: 'Continue to location permission', exact: true }).click()
      await expect(page.getByRole('button', { name: 'Stop Tracking', exact: true })).toBeVisible()
    }
    await page.getByRole('button', { name: 'Cancel Route', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Track Route', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Stop Tracking', exact: true })).toHaveCount(0)
    await expect(page.getByText('7.4 km', { exact: true })).toHaveCount(0)
    await expect(page.locator('.leaflet-overlay-pane [stroke="#2563eb"]')).toHaveCount(0)
    await expect(page.locator('.leaflet-overlay-pane [stroke="#1d4ed8"]')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Get Directions', exact: true })).toBeVisible()
  }
  expect(await page.evaluate(() => window.watchStops)).toBe(1)
})

test('Cancel Route ignores a location fix arriving after cancellation', async ({ page }) => {
  await page.goto('/schools/CRS062')
  await page.evaluate(() => {
    navigator.geolocation.getCurrentPosition = success => { window.delayedGPS = success }
  })
  await directions(page)
  await expect(page.getByText(/Requesting your location/)).toBeVisible()
  await page.getByRole('button', { name: 'Cancel Route', exact: true }).click()
  await page.evaluate(() => window.delayedGPS({ coords: { latitude:14.8, longitude:121.06 } }))
  await expect(page.getByRole('button', { name: 'Cancel Route', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Track Route', exact: true })).toHaveCount(0)
  expect(requests).toHaveLength(0)
})

test('a school with missing coordinates still shows offerings without requesting GPS', async ({ page }) => {
  const school = { ...evidence.schools.find(s => s.uii === '03279'), latitude: null, longitude: null }
  await page.route('**/api/public/courses/*/schools', route => route.fulfill({ json: schoolResult([school]) }))
  await page.goto('/schools/CRS228')
  await expect(page.getByRole('heading', { name: school.school_name, exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Get Directions', exact: true })).toHaveCount(0)
  await expect(page.getByText('Directions unavailable: reviewed map coordinates are not available.')).toBeVisible()
  await expect(page.getByText('Synthetic QA course', { exact: true })).toBeVisible()
})

test('tracking reports low accuracy and permission revocation, and clears watches on pagehide', async ({ page }) => {
  await page.goto('/schools/CRS062'); await directions(page)
  const start = async () => {
    await page.getByRole('button', { name: 'Track Route', exact: true }).click()
    await page.getByRole('button', { name: 'Continue to location permission', exact: true }).click()
  }
  await start()
  await page.evaluate(() => window.gpsUpdate({ coords: { latitude:14.8,longitude:121.06,accuracy:500 },timestamp:Date.now() }))
  await expect(page.getByText(/GPS accuracy is low/)).toBeVisible()
  await page.evaluate(() => window.gpsError({ code:1 }))
  await expect(page.getByRole('button', { name: 'Track Route', exact: true })).toBeVisible()
  expect(await page.evaluate(() => window.watchStops)).toBe(1)
  await start()
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide')))
  expect(await page.evaluate(() => window.watchStops)).toBe(2)
  await expect(page.getByRole('button', { name: 'Track Route', exact: true })).toBeVisible()
})

test('course changes discard a prior route and tracking state', async ({ page }) => {
  await page.goto('/schools/CRS062'); await directions(page)
  await page.getByRole('button', { name: 'Track Route', exact: true }).click()
  await page.getByRole('button', { name: 'Continue to location permission', exact: true }).click()
  await page.evaluate(() => { history.pushState({}, '', '/schools/CRS113'); dispatchEvent(new PopStateEvent('popstate')) })
  await expect(page.getByRole('button', { name: 'Get Directions', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Track Route', exact: true })).toHaveCount(0)
  expect(await page.evaluate(() => window.watchStops)).toBe(1)
})

test('hiding the page stops tracking; late GPS callbacks cannot update the marker', async ({ page }) => {
  await page.goto('/schools/CRS062'); await directions(page)
  await page.getByRole('button', { name: 'Track Route', exact: true }).click()
  await page.getByRole('button', { name: 'Continue to location permission', exact: true }).click()
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable:true, get: () => true })
    document.dispatchEvent(new Event('visibilitychange'))
    window.gpsUpdate({ coords:{ latitude:14.85,longitude:121.02,accuracy:10 },timestamp:Date.now() })
  })
  await expect(page.getByRole('button', { name: 'Track Route', exact: true })).toBeVisible()
  await expect(page.getByText(/away from the calculated route/)).toHaveCount(0)
  expect(await page.evaluate(() => window.watchStops)).toBe(1)
})

test('school selection cancels an in-flight route without restoring its stale response', async ({ page }) => {
  await page.route('**/api/public/courses/*/schools', route => route.fulfill({ json: schoolResult(evidence.schools.filter(s => ['03194','13228'].includes(s.uii))) }))
  let release
  const gate = new Promise(resolve => { release=resolve })
  await page.route('**/api/public/directions', async route => {
    await gate
    await route.fulfill({ json: { geometry:{type:'LineString',coordinates:[[121.06,14.8],[121.07,14.81]]},distanceMeters:7420,durationSeconds:900 } }).catch(() => {})
  })
  await page.goto('/schools/CRS062')
  await page.getByRole('button', { name: 'Get Directions', exact:true }).first().click()
  await page.getByRole('button', { name:'Continue to location permission', exact:true }).click()
  await expect(page.getByText(/Requesting your location/)).toBeVisible()
  await page.getByRole('button', { name:'Show on map', exact:true }).last().click()
  release()
  await expect(page.getByRole('button', { name:'Track Route', exact:true })).toHaveCount(0)
  await expect(page.getByText('7.4 km', { exact:true })).toHaveCount(0)
})

test('locator route visual snapshot', async ({ page }, testInfo) => {
  await page.goto('/schools/CRS062'); await directions(page)
  await page.getByText('7.4 km', { exact:true }).scrollIntoViewIfNeeded()
  await page.screenshot({ path:testInfo.outputPath('locator-route.png'),fullPage:true })
})
