import { test, expect } from '@playwright/test'

test('search updates while typing IDs, username and email; clearing and repeated submit finish loading', async ({ page }) => {
  page.on('pageerror', error => { throw error })
  await page.addInitScript(() => localStorage.setItem('adminToken', 'synthetic-admin'))
  const searches = []
  await page.route('**/api/admin/users?**', route => {
    const params = new URL(route.request().url()).searchParams
    searches.push(params.get('search') || '')
    expect(params.get('page')).toBe('1')
    return route.fulfill({ json: {
      users: [{ userId: 17, username: 'student17', email: 'student@example.edu', accountStatus: 'Active', assessmentStatus: 'Completed', recommendationStatus: 'Available', trackingStatus: 'Not Started', registeredAt: '2026-10-01' }],
      pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
    } })
  })
  await page.goto('/admin/users')
  await expect(page.getByText('1 registered user', { exact: true })).toBeVisible()
  const input = page.getByRole('searchbox', { name: 'Search users' })
  for (const query of ['17', '#17', 'student17', 'student@example.edu']) {
    const before = searches.length
    await input.fill(query)
    await expect.poll(() => searches.length).toBe(before + 1)
    expect(searches.at(-1)).toBe(query)
    await expect(page.getByText('1 registered user', { exact: true })).toBeVisible()
    await expect(page.locator('table').getByText('student@example.edu', { exact: true })).toBeVisible()
  }
  const beforeClear = searches.length
  await page.getByRole('button', { name: 'Clear search', exact: true }).click()
  await expect.poll(() => searches.length).toBe(beforeClear + 1)
  expect(searches.at(-1)).toBe('')
  await expect(page.getByText('1 registered user', { exact: true })).toBeVisible()
  for (let index = 0; index < 2; index++) {
    const before = searches.length
    await page.getByRole('button', { name: 'Search', exact: true }).click()
    await expect.poll(() => searches.length).toBe(before + 1)
    await expect(page.getByText('1 registered user', { exact: true })).toBeVisible()
  }
  // Only the final input should be sent after a burst of typing.
  await page.clock.install()
  await page.clock.pauseAt(new Date())
  const beforeTyping = searches.length
  await input.fill('s')
  await input.fill('st')
  await input.fill('student17')
  expect(searches.length).toBe(beforeTyping)
  await page.clock.runFor(350)
  await expect.poll(() => searches.length).toBe(beforeTyping + 1)
  expect(searches.at(-1)).toBe('student17')
})
