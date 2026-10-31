import { test, expect } from '@playwright/test'

async function openStreamingResults(page) {
  await page.addInitScript(() => {
    localStorage.setItem('token', 'synthetic-progress-test')
    const originalFetch = window.fetch.bind(window)
    window.fetch = (url, options) => {
      if (new URL(url, location.href).pathname === '/api/results') {
        if (options.headers.Accept !== 'text/event-stream') throw new Error('Expected live progress request')
        return Promise.resolve(new Response(new ReadableStream({ start(controller) {
          window.emitRecommendationEvent = (event, data) => controller.enqueue(new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
          window.closeRecommendationStream = () => controller.close()
        } }), { headers: { 'Content-Type': 'text/event-stream' } }))
      }
      return originalFetch(url, options)
    }
  })
  const pending = new Map()
  await page.route('**/api/**', route => { pending.set(new URL(route.request().url()).pathname, route) })
  await page.goto('/results')
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')
  return pending
}

test('real milestones fill the bar, metadata completes it, then results appear', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 })
  const pending = await openStreamingResults(page)
  const bar = page.getByRole('progressbar')
  for (const completed of [1, 2, 3, 4]) {
    await page.evaluate(completed => window.emitRecommendationEvent('progress', { completed, label: completed === 2 ? 'Preparing your course explanations' : 'Preparing your results' }), completed)
    await expect(bar).toHaveAttribute('aria-valuenow', String(completed * 20))
    if (completed === 2) {
      await expect(page.getByRole('status')).toContainText('Preparing your course explanations')
      await page.screenshot({ path: '../.local-backups/results-progress-40-mobile.png' })
    }
  }
  await page.evaluate(() => {
    window.emitRecommendationEvent('result', { recommendations: [1, 2, 3].map(i => ({ course_id: i, course_code: `CRS00${i}`, course_name: `Course ${i}`, rank_position: i, match_score: 80 })) })
    window.closeRecommendationStream()
  })
  await expect.poll(() => pending.size).toBe(6)
  await expect(bar).toHaveAttribute('aria-valuenow', '80')
  await pending.get('/api/interests').fulfill({ json: { interests: [] } })
  pending.delete('/api/interests')
  await expect(bar).toHaveAttribute('aria-valuenow', '83')
  await Promise.all([...pending.values()].map(route => route.fulfill({ json: {} })))
  await expect(bar).toHaveAttribute('aria-valuenow', '100')
  await expect(page.getByText('Your recommendations are ready', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Your Recommended Courses' })).toBeVisible()
  await expect(bar).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('a streamed failure offers retry and resets progress without claiming completion', async ({ page }) => {
  await openStreamingResults(page)
  await page.evaluate(() => {
    window.emitRecommendationEvent('progress', { completed: 2, label: 'Preparing explanations' })
    window.emitRecommendationEvent('error', { status: 500, message: 'Could not prepare results' })
    window.closeRecommendationStream()
  })
  await expect(page.getByRole('progressbar')).toHaveCount(0)
  await page.getByRole('button', { name: 'Try again', exact: true }).click()
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')
  await page.evaluate(() => {
    window.emitRecommendationEvent('error', { status: 400, message: 'Complete Personal Factors first.' })
    window.closeRecommendationStream()
  })
  await expect(page.getByText('Complete Personal Factors first.', { exact: true })).toBeVisible()
})
