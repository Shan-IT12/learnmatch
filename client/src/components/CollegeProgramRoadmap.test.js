import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'

test('roadmap opens the current year and keeps other year descriptions out of the detail panel', async () => {
  const vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom', optimizeDeps: { noDiscovery: true } })
  try {
    const { default: Roadmap } = await vite.ssrLoadModule('/src/components/CollegeProgramRoadmap.jsx')
    const years = [1, 2, 3, 4, 5].map(year => ({ year, overview: `Focus for year ${year}` }))
    const markup = renderToStaticMarkup(React.createElement(Roadmap, { years, currentYear: 3, currentTerm: 'Second Semester', duration: 5 }))
    assert.equal((markup.match(/aria-pressed="true"/g) || []).length, 1)
    assert.equal((markup.match(/aria-pressed="false"/g) || []).length, 4)
    assert.match(markup, /Focus for year 3/)
    assert.doesNotMatch(markup, /Focus for year [1245]/)
    assert.match(markup, /You are here/)
    assert.match(markup, /Second Semester/)
    assert.doesNotMatch(markup, /Completed year/)
    const empty = renderToStaticMarkup(React.createElement(Roadmap))
    assert.match(empty, /roadmap for this course is currently unavailable/)
    assert.doesNotMatch(empty, /aria-pressed/)
  } finally {
    await vite.close()
  }
})
