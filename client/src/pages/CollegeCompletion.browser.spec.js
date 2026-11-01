import { test, expect } from '@playwright/test'

async function completedCollege(page, { complete = true } = {}) {
  await page.addInitScript(() => {
    localStorage.setItem('token', 'local-fixture')
    localStorage.setItem('username', 'Student')
  })
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname
    let json = {}
    if (path === '/api/college/status') json = { active: true, lifecycleStatus: 'active', courseId: 26, courseCode: 'CRS026', courseName: 'Computer Science', yearLevel: '4th Year', semester: '2nd Semester', calendarType: 'semester', termCode: 'SEM_2', academicYear: '2026-2027', termId: 1 }
    if (path === '/api/public/courses/CRS026') json = { course: { program_duration_years: 4, year_levels: [] } }
    if (path === '/api/college/checkin/status') json = { state: complete ? 'complete' : 'due', progressionEligible: complete, completedPhases: complete ? ['Early', 'Mid', 'End'] : ['Early', 'Mid'] }
    if (path === '/api/college/checkin/history') json = { history: [{ checkinId: 1, termId: 1, phase: 'End', alignmentPercent: 80, status: 'On Track', feedback: 'Your course is working well for you.', recommendation: 'Keep up your study routine.' }] }
    if (path === '/api/college/checkin/results/1') json = { result: { checkinId: 1, courseName: 'Computer Science', phase: 'End', termLabel: '2nd Semester', alignmentPercent: 80, status: 'On Track', feedback: 'Your course is working well for you.', recommendation: 'Keep up your study routine.' } }
    return route.fulfill({ json })
  })
  await page.route(url => !['localhost', '127.0.0.1'].includes(url.hostname), route => route.abort())
  await page.goto('/college')
}

for (const width of [375, 1280]) {
  test(`completion popup dismisses, restores dashboard, and reopens at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 800 })
    await completedCollege(page)
    const dialog = page.getByRole('dialog', { name: 'Congratulations, you did it!' })
    await expect(dialog).toBeVisible()
    await expect(dialog).toHaveCSS('animation-name', 'college-popup-in')
    await expect(dialog.getByRole('button', { name: 'Close congratulations' })).toBeFocused()
    await expect(dialog.locator('.college-completion-confetti > span').first()).toHaveCSS('animation-iteration-count', 'infinite')
    await page.keyboard.press('Shift+Tab')
    await expect(dialog.getByRole('button', { name: 'Back to dashboard' })).toBeFocused()
    await page.screenshot({ path: testInfo.outputPath(`completion-popup-${width}.png`) })
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden')
    const reopen = page.getByRole('button', { name: 'View celebration' })
    await reopen.click()
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Back to dashboard' }).evaluate(button => button.click())
    await expect(dialog).toHaveAttribute('data-closing', 'true')
    await expect(dialog).toHaveCSS('animation-name', 'college-popup-out')
    await expect(dialog).toHaveCount(0)
    await expect(reopen).toBeFocused()
    await reopen.click()
    await dialog.getByRole('button', { name: 'Close congratulations' }).click()
    await expect(dialog).toHaveCount(0)
  })
}

test('confetti respects reduced motion and unfinished final terms do not celebrate', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await completedCollege(page)
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCSS('animation-name', 'none')
  await expect(page.locator('.college-completion-confetti > span').first()).toHaveCSS('animation-name', 'none')
  await page.getByRole('button', { name: 'Back to dashboard' }).click()
  await completedCollege(page, { complete: false })
  await expect(page.getByText('Tracking status: Active')).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('View Completed Check-in opens its saved result and survives refresh without starting a check-in', async ({ page }) => {
  const requests = []
  page.on('request', request => { if (request.url().includes('/api/college/checkin')) requests.push({ url: request.url(), method: request.method() }) })
  await completedCollege(page)
  await page.getByRole('button', { name: 'Back to dashboard', exact: true }).click()
  await page.getByRole('button', { name: 'View Completed Check-in', exact: true }).click()
  await expect(page).toHaveURL(/\/college\/checkin\/results\/1$/)
  for (let visit = 0; visit < 2; visit++) {
    await expect(page.getByRole('heading', { name: 'What your result means' })).toBeVisible()
    await expect(page.getByText('80%', { exact: true })).toBeVisible()
    await expect(page.getByText('Your course is working well for you.', { exact: true })).toBeVisible()
    await expect(page.getByText('Keep up your study routine.', { exact: true })).toBeVisible()
    if (visit === 0) await page.reload()
  }
  expect(requests.every(request => request.method === 'GET')).toBe(true)
  expect(requests.some(request => /\/(pending|start)(?:\?|$)/.test(request.url))).toBe(false)
})

test('missing saved check-in shows an error with a way back to the dashboard', async ({ page }) => {
  await completedCollege(page, { complete: false })
  await page.route('**/api/college/checkin/results/999', route => route.fulfill({ status: 404, json: { message: 'Completed check-in not found.' } }))
  await page.goto('/college/checkin/results/999')
  await expect(page.getByRole('alert')).toHaveText('Completed check-in not found.')
  await expect(page.getByRole('button', { name: 'Back to College Dashboard' })).toBeVisible()
})
