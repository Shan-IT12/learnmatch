import { test, expect } from '@playwright/test'

async function seed(page) {
  await page.goto('/help')
  await page.evaluate(() => {
    localStorage.setItem('token', 'saved-student-token')
    localStorage.setItem('userId', '7')
    localStorage.setItem('username', 'Student')
    sessionStorage.setItem('learnmatch:assessment:skills', 'saved-draft')
    localStorage.setItem('adminToken', 'separate-admin-token')
  })
}

test.beforeEach(async ({ page }) => {
  page.on('pageerror', error => { throw error })
  await page.route(url => !['127.0.0.1', 'localhost'].includes(url.hostname), route => route.abort())
  await page.route('**/api/**', route => route.fulfill({ json: {} }))
  await page.route('**/api/auth/session', route => route.fulfill({ json: { userId: 7, username: 'Student' } }))
})

for (const path of ['/', '/login']) {
  test(`restores verified session at ${path} without flashing the entry page`, async ({ page }) => {
    await seed(page)
    let finish
    const pending = new Promise(resolve => { finish = resolve })
    await page.route('**/api/auth/session', async route => {
      expect(route.request().headers().authorization).toBe('Bearer saved-student-token')
      await pending
      await route.fulfill({ json: { userId: 7, username: 'VerifiedStudent' } })
    })
    await page.goto(path)
    await expect(page.getByRole('status')).toHaveText('Checking your session...')
    await expect(page.locator('h1')).toHaveCount(0)
    finish()
    await expect(page).toHaveURL(/\/dashboard$/)
    expect(await page.evaluate(() => localStorage.getItem('username'))).toBe('VerifiedStudent')
    expect(await page.evaluate(() => localStorage.getItem('token'))).toBe('saved-student-token')
    expect(await page.evaluate(() => sessionStorage.getItem('learnmatch:assessment:skills'))).toBe('saved-draft')
    await page.reload()
    await expect(page).toHaveURL(/\/dashboard$/)
  })
}

test('normal login persists across closing and reopening a tab', async ({ page, context }) => {
  await page.route('**/api/auth/login', route => route.fulfill({ json: { token: 'saved-student-token', userId: 7, username: 'Student' } }))
  await page.goto('/login')
  await page.locator('[name="identifier"]').fill('Student')
  await page.locator('[name="password"]').fill('Password1')
  await page.getByRole('button', { name: 'Log In', exact: true }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
  await page.close()
  const reopened = await context.newPage()
  await reopened.route('**/api/**', route => route.fulfill({ json: {} }))
  await reopened.route('**/api/auth/session', route => route.fulfill({ json: { userId: 7, username: 'Student' } }))
  await reopened.goto('/login')
  await expect(reopened).toHaveURL(/\/dashboard$/)
})

for (const status of [401, 403]) {
  test(`invalid session (${status}) clears student auth and shows login`, async ({ page }) => {
    await seed(page)
    await page.route('**/api/auth/session', route => route.fulfill({ status, json: { message: 'Expired or invalid' } }))
    await page.goto('/login')
    await expect(page.getByRole('heading', { name: 'Log in to LearnMatch' })).toBeVisible()
    expect(await page.evaluate(() => ['token', 'userId', 'username'].map(key => localStorage.getItem(key)))).toEqual([null, null, null])
    expect(await page.evaluate(() => localStorage.getItem('adminToken'))).toBe('separate-admin-token')
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Log in to LearnMatch' })).toBeVisible()
  })
}

for (const failure of ['network', 500, 503, 'invalid-response']) {
  test(`verification failure (${failure}) preserves session and supports retry`, async ({ page }) => {
    await seed(page)
    let failing = true
    await page.route('**/api/auth/session', route => failing
      ? failure === 'network' ? route.abort() : route.fulfill({ status: failure === 'invalid-response' ? 200 : failure, json: {} })
      : route.fulfill({ json: { userId: 7, username: 'Student' } }))
    await page.goto('/')
    await expect(page.getByRole('alert')).toContainText("couldn't verify your session")
    await expect(page.locator('h1')).toHaveCount(0)
    expect(await page.evaluate(() => localStorage.getItem('token'))).toBe('saved-student-token')
    failing = false
    await page.getByRole('button', { name: 'Retry' }).click()
    await expect(page).toHaveURL(/\/dashboard$/)
  })
}

test('a stalled verification times out with retry and preserves the token', async ({ page }) => {
  await seed(page)
  await page.clock.install()
  await page.route('**/api/auth/session', () => {})
  await page.goto('/login')
  await expect(page.getByRole('status')).toHaveText('Checking your session...')
  await page.clock.fastForward(15001)
  await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('token'))).toBe('saved-student-token')
})

test('logout removes session and reopening requires login without verification', async ({ page }) => {
  await seed(page)
  await page.goto('/')
  await expect(page).toHaveURL(/\/dashboard$/)
  await page.getByRole('button', { name: 'Logout', exact: true }).click()
  await page.getByRole('button', { name: 'Yes, log out' }).click()
  await expect(page.getByRole('heading', { name: 'Log in to LearnMatch' })).toBeVisible()
  let checks = 0
  await page.route('**/api/auth/session', route => { checks++; return route.abort() })
  await page.goto('/')
  await expect(page.getByRole('status')).toHaveCount(0)
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: 'Log in to LearnMatch' })).toBeVisible()
  expect(checks).toBe(0)
  expect(await page.evaluate(() => localStorage.getItem('token'))).toBeNull()
})

test('public links and admin login remain accessible with an unverifiable student session', async ({ page }) => {
  await seed(page)
  let checks = 0
  await page.route('**/api/auth/session', route => { checks++; return route.abort() })
  for (const path of ['/privacy', '/terms', '/about', '/help', '/courses/SYNTHETIC', '/admin/login']) {
    await page.goto(path)
    await expect(page).toHaveURL(new RegExp(`${path}$`))
    await expect(page.getByText('Checking your session...')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Retry', exact: true })).toHaveCount(0)
  }
  expect(checks).toBe(0)
  expect(await page.evaluate(() => localStorage.getItem('token'))).toBe('saved-student-token')
})
