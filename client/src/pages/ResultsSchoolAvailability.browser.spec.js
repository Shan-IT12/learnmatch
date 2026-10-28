import { test, expect } from '@playwright/test'

for (const width of [1280, 375]) {
  test(`results school actions handle pending, empty, available and failed checks at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    page.on('pageerror', error => { throw error })
    await page.addInitScript(() => localStorage.setItem('token', 'synthetic-school-test'))
    await page.route(url => !['127.0.0.1', 'localhost'].includes(url.hostname), route => route.abort())
    let releaseChecks
    const checksReady = new Promise(resolve => { releaseChecks = resolve })
    let failedAttempts = 0
    await page.route('**/api/**', async route => {
      const path = new URL(route.request().url()).pathname
      if (path.endsWith('/schools')) {
        await checksReady
        if (path.includes('CRS003') && failedAttempts++ === 0) return route.fulfill({ status: 503, json: {} })
        return route.fulfill({ json: { schools: path.includes('CRS001') ? [] : [{ school_id: 1 }] } })
      }
      return route.fulfill({ json: path === '/api/results' ? {
        recommendations: [1, 2, 3].map(index => ({
          course_id: index, course_code: `CRS00${index}`, course_name: `Synthetic Course ${index}`,
          cluster_category: index === 1 ? 'LEGAL & PUBLIC SERVICE CLUSTER' : 'HEALTHCARE SCIENCE CLUSTER',
          rank_position: index, match_score: 80, ai_narrative: 'Synthetic course explanation.',
        })),
      } : path === '/api/mbti' ? { mbtiType: 'ESTJ' }
        : path === '/api/quiz/results' ? { domainScores: {
          Verbal: { correct: 1, total: 5 }, Numerical: { correct: 3, total: 5 },
          Spatial: { correct: 0, total: 5 },
        } } : path === '/api/profile' ? { profile: {
        personal_factor_answers: { health: 'yes', family: 'yes' },
        factor_health_impact: 2, factor_family_impact: 3,
      } } : {} })
    })
    await page.goto('/results')
    const buttons = page.getByRole('button', { name: 'Find Schools in SJDM', exact: true })
    await expect(buttons).toHaveCount(3)
    await expect(page.getByText('Extraverted • Sensing • Thinking • Judging', { exact: true })).toBeVisible()
    await expect(page.getByText('A direct, organized style that values practical evidence, clear decisions, and dependable execution.', { exact: true })).toBeVisible()
    const skills = page.getByText('Highest-scoring areas in this quiz', { exact: true }).locator('..')
    await expect(skills.locator('li').first()).toContainText('Numerical')
    await expect(skills.locator('li').first()).toContainText('3/5')
    await expect(skills.locator('li').nth(1)).toContainText('Verbal')
    for (const button of await buttons.all()) await expect(button).toBeDisabled()
    releaseChecks()
    await expect(buttons.nth(0)).toBeDisabled()
    await expect(buttons.nth(0)).toHaveAccessibleDescription(/Schools outside SJDM may offer it/)
    await expect(buttons.nth(1)).toBeEnabled()
    await expect(buttons.nth(2)).toHaveAccessibleDescription(/could not be checked/)
    await expect(buttons.nth(2)).toBeDisabled()
    await page.getByRole('button', { name: 'Try again', exact: true }).click()
    await expect(buttons.nth(2)).toBeEnabled()
    expect(failedAttempts).toBe(2)
    await page.getByText('How your personal factors were considered', { exact: true }).click()
    const healthExplanation = page.locator('details section').filter({ has: page.getByRole('heading', { name: /Health-related needs/ }) })
    await expect(healthExplanation).toContainText('2/4 impact')
    await expect(healthExplanation).toContainText('Considered for 2 of your 3 matches.')
    const familyExplanation = page.locator('details section').filter({ has: page.getByRole('heading', { name: /Family responsibilities/ }) })
    await expect(familyExplanation).toContainText('3/4 impact')
    await expect(familyExplanation).toContainText('Considered for all 3 of your matches.')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: `../.local-backups/results-school-availability-${width}.png`, fullPage: true })
    await buttons.nth(1).click()
    await expect(page).toHaveURL(/\/schools\/CRS002\?source=results$/)
  })
}
