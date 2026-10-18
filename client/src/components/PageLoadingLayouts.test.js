import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { createServer } from 'vite'

// Verify that loading screens use real page landmarks and responsive grids.
test('loading retains each page shell and its own content geometry', async () => {
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: key => key === 'username' ? 'Student' : 'test' } })
  const vite = await createServer({ cacheDir: 'node_modules/.vite-page-layout-test', server: { middlewareMode: true, hmr: false }, appType: 'custom', optimizeDeps: { noDiscovery: true } })
  try {
    for (const [path, markers] of [
      ['SummaryDashboard', ['Your LearnMatch report', 'max-w-[1240px]', 'md:grid-cols-2', 'Skills Quiz', 'Personal Factors', 'Top Recommendation']],
      ['Dashboard', ['Your LearnMatch journey', 'lg:grid-cols-[1.55fr_1fr]', 'Assessment steps']],
      ['Profile', ['Your profile', 'max-w-4xl', 'Account Username', 'Personal Factors']],
      ['ProfileEdit', ['max-w-5xl', 'Account username', 'Personal Factors']],
      ['college/CollegeDashboard', ['Career Alignment Tracking', 'lg:grid-cols-[1.5fr_1fr]', 'Course Roadmap']],
      ['CourseSearch', ['Find a course', 'Sort', 'motion-stagger grid gap-4']],
      ['PublicCourseDetails', ['Skills you can develop', 'Possible career paths', 'md:grid-cols-2']],
    ]) {
      const { default: Page } = await vite.ssrLoadModule(`/src/pages/${path}.jsx`)
      const markup = renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(Page)))
      assert.match(markup, /<nav/, path)
      assert.match(markup, /<main/, path)
      assert.match(markup, /aria-busy="true"/, path)
      assert.match(markup, /aria-hidden="true" inert=""/, path)
      for (const marker of markers) assert.ok(markup.includes(marker), `${path}: ${marker}`)
      assert.doesNotMatch(markup, /LoadingSkeleton|Getting things ready/)
    }
  } finally {
    await vite.close()
    if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage)
    else delete globalThis.localStorage
  }
})
