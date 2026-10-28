import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  page.on('pageerror', error => { throw error })
  await page.addInitScript(() => localStorage.setItem('token', 'synthetic-personality-test'))
  await page.route(url => !['127.0.0.1', 'localhost'].includes(url.hostname), route => route.abort())
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname
    return route.fulfill({ json: path === '/api/mbti'
      ? { mbtiType: 'ESTJ', scores: { EI: 57, NS: 42, TF: 60, JP: 70 } }
      : path === '/api/college/status' ? { active: false } : {} })
  })
})

for (const width of [1280, 375]) {
  test(`personality letters explore saved scores without changing the result at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    const writes = []
    page.on('request', request => {
      if (request.url().includes('/api/mbti') && request.method() !== 'GET') writes.push(request.method())
    })
    await page.goto('/onboarding/personality')
    const tabs = page.getByRole('tab')
    const panel = page.getByRole('tabpanel')
    await expect(tabs).toHaveCount(4)
    await expect(tabs.nth(0)).toHaveAttribute('aria-selected', 'true')
    await expect(panel).toContainText('57%')
    await tabs.nth(1).click()
    await expect(panel).toHaveAccessibleName('S Sensing')
    await expect(panel).toContainText('58%')
    await expect(panel).toContainText('Why S instead of N?')
    await tabs.nth(1).press('ArrowRight')
    await expect(tabs.nth(2)).toBeFocused()
    await expect(panel).toContainText('Why T instead of F?')
    await tabs.nth(2).press('End')
    await expect(panel).toContainText('70%')
    await page.getByRole('button', { name: 'Explore Extraversion' }).click()
    await expect(tabs.nth(0)).toBeFocused()
    await tabs.nth(0).press('ArrowLeft')
    await expect(tabs.nth(3)).toBeFocused()
    await tabs.nth(3).press('Home')
    await expect(panel).toContainText('57%')
    expect(writes).toEqual([])
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: `../.local-backups/personality-interactive-${width}.png`, fullPage: true })
    await page.reload()
    await expect(page.getByRole('heading', { name: 'ESTJ', exact: true })).toBeAttached()
    await expect(panel).toContainText('57%')
    await page.getByRole('button', { name: 'Continue to Recommendations' }).click()
    await expect(page).toHaveURL(/\/results$/)
  })
}
