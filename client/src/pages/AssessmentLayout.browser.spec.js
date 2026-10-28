import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  page.on('pageerror', error => { throw error })
  await page.addInitScript(() => {
    localStorage.setItem('token', 'synthetic-layout-test')
    sessionStorage.setItem('learnmatch:assessment:attempt-id', '1')
  })
  await page.route(url => !['127.0.0.1', 'localhost'].includes(url.hostname), route => route.abort())
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname
    return route.fulfill({ json: path.endsWith('/current') ? { attemptId: 1 }
      : path === '/api/college/status' ? { active: false }
      : path.startsWith('/api/public/courses/') ? { course: {
        course_code: 'CRS024', course_name: 'Synthetic Program', program_duration_years: 4,
        description: 'A synthetic program for layout checks.', obtainable_skills: ['Analysis'],
        year_levels: [1, 2, 3, 4].map(year => ({ year, label: `Year ${year}`, overview: 'Study and practice.' })),
        career_opportunities: [{ career_id: 1, career_title: 'Synthetic Career', philippines_description: 'A synthetic career description.' }],
      } } : {} })
  })
})

for (const width of [1280, 375]) {
  test(`interest navigation sits after Nature & Environment and saves before Next at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/onboarding/interests')
    const next = page.getByRole('button', { name: 'Next', exact: true })
    await expect(page.getByRole('button', { name: 'Drawing', exact: true })).toBeEnabled()
    await expect(next).toBeDisabled()
    await page.getByRole('button', { name: 'Drawing', exact: true }).click()
    await expect(page.getByText('1 / 10 activities selected', { exact: true })).toBeVisible()
    await next.scrollIntoViewIfNeeded()
    const nature = page.getByRole('region', { name: 'Nature & Environment' })
    const natureBox = await nature.boundingBox()
    const nextBox = await next.boundingBox()
    expect(nextBox.y).toBeGreaterThan(natureBox.y + natureBox.height)
    expect(await next.evaluate(element => getComputedStyle(element.parentElement).position)).toBe('static')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: `../.local-backups/interests-inline-${width}.png` })
    await page.getByRole('button', { name: 'Back', exact: true }).click()
    await expect(page).toHaveURL(/\/onboarding\/profile$/)
    await page.goto('/onboarding/interests')
    await expect(next).toBeEnabled()
    const submission = page.waitForRequest(request => new URL(request.url()).pathname === '/api/interests' && request.method() === 'POST')
    await next.click()
    expect((await submission).postDataJSON().interests.selected).toContain('Drawing')
    await expect(page).toHaveURL(/\/onboarding\/skills$/)
  })

  test(`career section links scroll smoothly and respect reduced motion at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/results/career-path/CRS024?returnTo=summary')
    await expect(page.getByRole('heading', { name: 'Synthetic Program', exact: true })).toBeVisible()
    await page.evaluate(() => {
      window.sectionScrolls = []
      const originalScroll = Element.prototype.scrollIntoView
      Element.prototype.scrollIntoView = function (options) {
        window.sectionScrolls.push({ id: this.id, behavior: options?.behavior })
        return originalScroll.call(this, options)
      }
    })
    await page.getByRole('link', { name: 'Discover careers' }).click()
    await expect.poll(() => page.evaluate(() => window.sectionScrolls.at(-1))).toEqual({ id: 'career-opportunities', behavior: 'smooth' })
    await expect(page.locator('#career-opportunities')).toBeInViewport()
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.getByRole('link', { name: 'Explore the roadmap' }).click()
    await expect.poll(() => page.evaluate(() => window.sectionScrolls.at(-1))).toEqual({ id: 'program-roadmap', behavior: 'instant' })
    await expect(page.locator('#program-roadmap')).toBeInViewport()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })
}
