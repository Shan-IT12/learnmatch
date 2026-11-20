// Build with VITE_API_URL=/fixture first, then run with Node and Playwright.
const assert = require('node:assert/strict')
const { createServer } = require('node:http')
const { once } = require('node:events')
const { readFile } = require('node:fs/promises')
const path = require('node:path')
const { after, before, test } = require('node:test')
const { chromium } = require('playwright')

const dist = path.join(__dirname, '../dist')
const assessment = '/api/assessment-attempts'
const current = `${assessment}/current`
const draftKey = 'learnmatch:assessment:attempt-id'
const legacy404 = { message: 'Assessment progress is no longer active.' }
let server, browser, origin

before(async () => {
  server = createServer(async (request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname
    const asset = pathname.startsWith('/assets/') ? path.basename(pathname) : null
    const contentType = asset ? { '.js': 'text/javascript', '.css': 'text/css' }[path.extname(asset)] : 'text/html'
    try {
      const content = await readFile(asset ? path.join(dist, 'assets', asset) : path.join(dist, 'app.html'))
      response.writeHead(200, { 'Content-Type': contentType || 'application/octet-stream' }).end(content)
    } catch {
      response.writeHead(404).end()
    }
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  origin = `http://127.0.0.1:${server.address().port}`
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH })
})

after(async () => {
  await browser?.close()
  if (server) await new Promise(resolve => server.close(resolve))
})

async function openSummary(t, { cachedId, lookup, college = false } = {}) {
  const context = await browser.newContext({ serviceWorkers: 'block' })
  t.after(() => context.close())
  const page = await context.newPage()
  page.setDefaultTimeout(8000)
  await page.addInitScript(({ key, cached }) => {
    if (sessionStorage.getItem('qa-initialized')) return
    sessionStorage.setItem('qa-initialized', 'true')
    localStorage.setItem('token', 'student-a')
    localStorage.setItem('userId', '1')
    localStorage.setItem('username', 'Fixture Student A')
    if (cached) sessionStorage.setItem(key, cached)
  }, { key: draftKey, cached: cachedId })

  const requests = []
  await context.route('**/*', async route => {
    const request = route.request()
    const url = new URL(request.url())
    if (url.origin !== origin) return route.abort()
    if (!url.pathname.startsWith('/fixture/api/')) return route.continue()
    const endpoint = url.pathname.slice('/fixture'.length)
    const { authorization, 'x-assessment-attempt-id': attemptId } = request.headers()
    const method = request.method()
    requests.push({ endpoint, method, authorization, attemptId })
    const reply = (json, status = 200) => route.fulfill({ status, json })
    if (endpoint === current) return lookup ? lookup({ reply, authorization, attemptId }) : reply(legacy404, 404)
    if (endpoint === assessment && method === 'POST') return reply({ attemptId: 40 }, 201)
    if (endpoint === '/api/auth/login') return reply({ token: 'student-b', userId: 2, username: 'Fixture Student B' })
    if (endpoint === '/api/auth/session') {
      return authorization === 'Bearer student-b'
        ? reply({ userId: 2, username: 'Fixture Student B' })
        : reply({ userId: 1, username: 'Fixture Student A' })
    }
    if (endpoint === '/api/dashboard/status') return reply({ hasCompletedAssessment: true, isCollegePhase: college })
    if (endpoint === '/api/recommendations/latest') return reply({
      recommendation: { assessment_id: 1, recommendation_id: 2 },
      recommendations: [{ course_code: 'QA', course_name: 'Fixture Saved Program' }],
    })
    if (endpoint === '/api/college/status') return reply({
      active: college, trackingCycle: college ? 1 : null,
      yearLevel: '1st Year', semester: '1st Semester', academicYear: '2026-2027',
    })
    if (endpoint === '/api/college/checkin/status') return reply({ state: 'complete' })
    if (endpoint === '/api/college/checkin/history') return reply({ history: [] })
    if (endpoint === '/api/college/notifications') return reply({ notifications: [] })
    return reply({})
  })

  const action = page.getByRole('button', { name: 'Continue or Retake Assessment' })
  await page.goto(`${origin}${college ? '/college' : '/dashboard/summary'}`)
  if (college) await openCollegeTracking(page)
  await action.waitFor()
  return { page, action, requests }
}

async function openCollegeTracking(page) {
  await page.getByText('View Assessment Summary', { exact: true }).waitFor()
  await page.getByText('Manage tracking', { exact: true }).click()
}

test('viewing or refreshing saved results makes no draft request and a retake requires confirmation', async t => {
  const { page, action, requests } = await openSummary(t)
  await page.reload()
  await action.waitFor()
  await page.getByText('Fixture Saved Program', { exact: true }).first().waitFor()
  assert.deepEqual(requests.filter(request => request.endpoint.startsWith(assessment)), [])
  await action.click()
  const dialog = page.getByRole('dialog', { name: 'Retake your assessment?' })
  await dialog.waitFor()
  assert.deepEqual(requests.filter(request => request.endpoint.startsWith(assessment)), [
    { endpoint: current, method: 'GET', authorization: 'Bearer student-a', attemptId: undefined },
  ])
  await dialog.getByRole('button', { name: 'Start New Assessment' }).click()
  await page.waitForURL('**/onboarding/profile')
  assert.equal(requests.filter(request => request.endpoint === assessment && request.method === 'POST').length, 1)
})

for (const cachedId of [undefined, '12', '99']) {
  test(`the assessment action resumes an owned draft with browser ID ${cachedId ?? 'absent'}`, async t => {
    const { page, action, requests } = await openSummary(t, {
      cachedId,
      lookup: ({ reply, attemptId }) => attemptId === '99' ? reply(legacy404, 404) : reply({ attemptId: 12 }),
    })
    assert.equal(requests.some(request => request.endpoint === current), false)
    await action.click()
    await page.waitForURL('**/onboarding/profile')
    assert.deepEqual(requests.filter(request => request.endpoint === current).map(request => request.attemptId),
      cachedId === '99' ? ['99', undefined] : [cachedId])
    assert.equal(await page.evaluate(key => sessionStorage.getItem(key), draftKey), '12')
    assert.equal(requests.some(request => request.endpoint === assessment), false)
  })
}

for (const college of [false, true]) test(`a late ${college ? 'College' : 'Summary'} lookup cannot cross accounts`, async t => {
  let releaseLookup
  const pending = new Promise(resolve => { releaseLookup = resolve })
  const { page, action, requests } = await openSummary(t, {
    college,
    lookup: async ({ reply, authorization }) => {
      assert.equal(authorization, 'Bearer student-a')
      await pending
      return reply({ attemptId: 12 })
    },
  })
  t.after(() => releaseLookup())
  const started = page.waitForRequest(request => new URL(request.url()).pathname === `/fixture${current}`)
  await action.click()
  await started
  await page.getByRole('button', { name: 'Logout', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Yes, log out' }).click()
  await page.waitForURL('**/login')
  await page.locator('[name=identifier]').fill('student-b')
  await page.locator('[name=password]').fill('synthetic-password')
  await page.locator('button[type=submit]').click()
  const destination = college ? '/college' : '/dashboard/summary'
  await page.waitForURL(`**${destination}`)
  if (college) await openCollegeTracking(page)
  await action.waitFor()
  const finished = page.waitForResponse(response => new URL(response.url()).pathname === `/fixture${current}`)
  releaseLookup()
  await (await finished).finished()
  assert.equal(new URL(page.url()).pathname, destination)
  assert.equal(await page.evaluate(key => sessionStorage.getItem(key), draftKey), null)
  assert.equal(await page.getByRole('dialog').count(), 0)
  assert.deepEqual(requests.filter(request => request.endpoint === current).map(request => request.authorization), ['Bearer student-a'])
})

test('College loads and refreshes without draft requests and can open saved Summary', async t => {
  const { page, requests } = await openSummary(t, { college: true })
  await page.reload()
  await page.getByText('View Assessment Summary', { exact: true }).waitFor()
  assert.ok(requests.some(request => request.endpoint === '/api/college/checkin/history'))
  assert.ok(requests.some(request => request.endpoint === '/api/college/checkin/status'))
  await page.getByText('View Assessment Summary', { exact: true }).click()
  await page.waitForURL('**/dashboard/summary')
  await page.getByText('Fixture Saved Program', { exact: true }).first().waitFor()
  assert.equal(requests.some(request => request.endpoint.startsWith(assessment)), false)
})

for (const unfinished of [true, false]) test(`College assessment action ${unfinished ? 'recovers the owned draft' : 'starts after the expected 404'}`, async t => {
  const { page, action, requests } = await openSummary(t, {
    college: true,
    cachedId: unfinished ? '99' : undefined,
    lookup: ({ reply, attemptId }) => unfinished && !attemptId ? reply({ attemptId: 12 }) : reply(legacy404, 404),
  })
  assert.equal(requests.some(request => request.endpoint === current), false)
  await action.click()
  await page.waitForURL('**/onboarding/profile')
  assert.equal(await page.evaluate(key => sessionStorage.getItem(key), draftKey), unfinished ? '12' : '40')
  assert.equal(requests.filter(request => request.endpoint === assessment && request.method === 'POST').length, unfinished ? 0 : 1)
})
