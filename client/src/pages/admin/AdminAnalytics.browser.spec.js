import { test, expect } from '@playwright/test'

const courses = Array.from({ length: 12 }, (_, index) => ({
  courseId: index + 1, courseCode: `C${index + 1}`,
  courseName: index === 0
    ? 'Bachelor of Science in Interdisciplinary Environmental Management major in Sustainable Community Development and Conservation'
    : `Recommended Course ${index + 1}`,
  count: 12 - index,
}))

async function openAnalytics(page, rows) {
  let requests = 0
  await page.addInitScript(() => localStorage.setItem('adminToken', 'local-fixture'))
  await page.route('**/api/**', async (route) => {
    if (!route.request().url().endsWith('/api/admin/analytics')) return route.abort()
    requests++
    await route.fulfill({ json: {
      summary: { totalUsers: 0, completedAssessments: 0, assessmentCompletionRate: 0, recommendationsGenerated: 0 },
      averageSkillScores: [], personalityDistribution: [],
      assessmentCompletion: { completed: 0, inProgress: 0, notStarted: 0 },
      topRecommendedCourses: rows,
    } })
  })
  await page.goto('http://127.0.0.1:5179/admin/analytics')
  await expect(page.getByRole('heading', { name: 'All Recommended Courses' })).toBeVisible()
  return () => requests
}

for (const width of [1280, 375]) {
  test(`compact, Show All, Show Less and long labels at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    const requestCount = await openAnalytics(page, courses)
    const initialRequests = requestCount()
    const chart = page.locator('#all-recommended-courses canvas')
    await expect(page.getByText('Showing 8 of 12 recommended courses')).toBeVisible()
    await expect(chart).toHaveAttribute('aria-label', 'Recommendation frequency for 8 courses')
    const compactHeight = (await chart.boundingBox()).height
    await page.getByRole('button', { name: 'Show All Courses' }).click()
    await expect(page.getByRole('button', { name: 'Show Less' })).toHaveAttribute('aria-expanded', 'true')
    await expect(page.getByText('Showing 12 of 12 recommended courses')).toBeVisible()
    await expect(chart).toHaveAttribute('aria-label', 'Recommendation frequency for 12 courses')
    await expect.poll(async () => (await chart.boundingBox()).height).toBeGreaterThan(compactHeight)
    const layout = await chart.evaluate(async (canvas) => {
      const { Chart } = await import('/node_modules/.vite/deps/chart__js.js')
      const chart = Chart.getChart(canvas)
      const y = chart.scales.y
      const labels = chart.data.labels
      return {
        labels, rows: chart.data.datasets[0].data.length,
        rowHeight: Math.abs(y.getPixelForTick(1) - y.getPixelForTick(0)),
        maxLines: Math.max(...labels.map((label) => label.length)),
        plotWidth: chart.chartArea.width,
        documentFits: document.documentElement.scrollWidth <= innerWidth,
      }
    })
    expect(layout.rows).toBe(12)
    expect(layout.labels[0].join(' ')).toContain('Sustainable Community Development')
    expect(layout.rowHeight).toBeGreaterThan(layout.maxLines * 16)
    expect(layout.plotWidth).toBeGreaterThan(150)
    expect(layout.documentFits).toBe(true)
    await page.locator('#all-recommended-courses').screenshot({ path: `../.local-backups/analytics-${width}.png` })
    await page.getByRole('button', { name: 'Show Less' }).click()
    await expect(page.getByText('Showing 8 of 12 recommended courses')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Show All Courses' })).toHaveAttribute('aria-expanded', 'false')
    await expect.poll(async () => (await chart.boundingBox()).height).toBe(compactHeight)
    expect(requestCount()).toBe(initialRequests)
  })
}

test('empty state has no chart or expand button', async ({ page }) => {
  await openAnalytics(page, [])
  await expect(page.getByText('No persisted course recommendations are available yet.')).toBeVisible()
  await expect(page.locator('#all-recommended-courses')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Show All Courses' })).toHaveCount(0)
})

test('eight courses need no expand control', async ({ page }) => {
  await openAnalytics(page, courses.slice(0, 8))
  await expect(page.getByText('Showing 8 of 8 recommended courses')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Show All Courses' })).toHaveCount(0)
})
