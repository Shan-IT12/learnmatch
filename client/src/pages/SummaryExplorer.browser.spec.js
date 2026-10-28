import { test, expect } from '@playwright/test'

const course = {
  course_code: 'CRS024', course_name: 'Bachelor of Science in Information Technology',
  course_abbreviation: 'BSIT', description: 'Explore computing and technology careers.',
  obtainable_skills: ['Programming'], career_paths: ['Software developer'], career_opportunities: [],
}

test.beforeEach(async ({ page }) => {
  page.on('pageerror', error => { throw error })
  await page.addInitScript(() => {
    localStorage.setItem('token', 'synthetic-summary-test')
    localStorage.setItem('userId', '1')
    localStorage.setItem('username', 'SyntheticStudent')
  })
  await page.route(url => !['127.0.0.1', 'localhost'].includes(url.hostname), route => route.abort())
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname
    const json = path === '/api/college/status' ? { active: false }
      : path.endsWith('/schools') ? { course, location_scope: 'San Jose del Monte', schools: [] }
      : path === '/api/public/courses/CRS024' ? { course }
      : path.startsWith('/api/public/courses') ? { courses: [course] }
      : path === '/api/results' ? { recommendations: [{ ...course, match_score: 90 }] }
      : {}
    return route.fulfill({ json })
  })
})

for (const width of [1280, 375]) {
  test(`opening explorer from a scrolled summary starts at the top at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    // Keep the destination tall enough that inherited scrolling cannot be clamped away.
    await page.route('**/api/public/courses', route => route.fulfill({ json: {
      courses: Array.from({ length: 24 }, (_, index) => ({ ...course, course_code: `C${index}`, course_name: `Course ${index}` })),
    } }))
    await page.goto('/dashboard/summary')
    const explorer = page.getByRole('button', { name: 'Explore Courses' })
    await explorer.scrollIntoViewIfNeeded()
    expect(await page.evaluate(() => window.scrollY + document.body.scrollTop)).toBeGreaterThan(0)
    await explorer.click()
    await expect(page.getByRole('heading', { name: 'Find a course', exact: true })).toBeInViewport()
    await expect(page.getByRole('link', { name: 'View course details' })).toHaveCount(18)
    await expect.poll(() => page.evaluate(() => window.scrollY + document.body.scrollTop)).toBe(0)
  })

  test(`summary explorer round trip, search and refresh at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/dashboard/summary')
    const explorer = page.getByRole('region', { name: 'Explore more possibilities' })
    await expect(explorer).toBeVisible()
    await explorer.screenshot({ path: `../.local-backups/summary-explorer-${width}.png` })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await explorer.getByRole('button', { name: 'Explore Courses' }).click()
    await expect(page).toHaveURL(/\/courses\/search\?source=summary$/)
    await page.getByRole('textbox', { name: 'Search courses' }).fill('BSIT')
    await page.getByRole('button', { name: 'Search', exact: true }).click()
    await expect(page).toHaveURL(/q=BSIT&source=summary$/)
    await page.getByRole('link', { name: 'View course details' }).click()
    await expect(page).toHaveURL(/\/courses\/CRS024\?source=summary$/)
    await page.getByRole('link', { name: 'Back to Course Search' }).click()
    await expect(page.getByRole('textbox', { name: 'Search courses' })).toHaveValue('BSIT')
    await page.getByRole('link', { name: 'View course details' }).click()
    await page.reload()
    await page.getByRole('link', { name: 'Find Schools in SJDM' }).click()
    await expect(page).toHaveURL(/\/schools\/CRS024\?source=summary$/)
    await page.reload()
    await page.locator('main > a').filter({ hasText: 'Back to Course Overview' }).click()
    await expect(page).toHaveURL(/\/courses\/CRS024\?source=summary$/)
    await page.getByRole('link', { name: 'Back to Course Search' }).click()
    await page.reload()
    await page.getByRole('button', { name: 'Back to Summary Dashboard' }).click()
    await expect(page).toHaveURL(/\/dashboard\/summary$/)
    await expect(page.getByRole('heading', { name: 'Your LearnMatch report' })).toBeVisible()
  })
}
