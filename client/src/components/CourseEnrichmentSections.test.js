import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import { getYearTabIndex } from '../utils/careerRoadmap.js'

const course = {
  program_duration_years: 5,
  year_levels: [1, 2, 3, 4, 5].map(year => ({ year, label: `Year ${year}`, overview: `Stored overview for year ${year}.` })),
  career_opportunities: [{ career_id: 1, career_title: 'Architect', estimated_monthly_salary_php: { display: 'Estimated PHP 16,000-42,000 per month' }, philippines_description: 'Stored architecture role description.', reference_year: 2026 }],
}

test('year navigation supports arrows, wraparound, Home and End for different program lengths', () => {
  for (const count of [1, 3, 4, 5, 6]) {
    assert.equal(getYearTabIndex('ArrowRight', count - 1, count), 0)
    assert.equal(getYearTabIndex('ArrowLeft', 0, count), count - 1)
    assert.equal(getYearTabIndex('Home', count - 1, count), 0)
    assert.equal(getYearTabIndex('End', 0, count), count - 1)
  }
  assert.equal(getYearTabIndex('ArrowDown', 1, 5), 2)
  assert.equal(getYearTabIndex('ArrowUp', 2, 5), 1)
  assert.equal(getYearTabIndex('Tab', 0, 5), null)
  assert.equal(getYearTabIndex('ArrowRight', 0, 0), null)
})

test('roadmap exposes accessible year tabs and careers retain source information in native disclosures', async () => {
  const vite = await createServer({ cacheDir: 'node_modules/.vite-career-sections-test', server: { middlewareMode: true, hmr: false }, appType: 'custom', optimizeDeps: { noDiscovery: true } })
  try {
    const { default: Sections } = await vite.ssrLoadModule('/src/components/CourseEnrichmentSections.jsx')
    const render = value => renderToStaticMarkup(React.createElement(Sections, { course: value }))
    const markup = render(course)
    assert.equal((markup.match(/role="tab"/g) || []).length, 5)
    assert.equal((markup.match(/aria-selected="true"/g) || []).length, 1)
    assert.equal((markup.match(/tabindex="-1"/g) || []).length, 4)
    assert.match(markup, /role="tabpanel"/)
    assert.match(markup, /Stored overview for year 1/)
    assert.doesNotMatch(markup, /Stored overview for year 2/)
    assert.match(markup, /<button[^>]*disabled=""[^>]*>.*?Previous year/)
    assert.match(markup, /Next year/)
    assert.match(markup, /<details/)
    assert.match(markup, /<summary/)
    assert.match(markup, /Stored architecture role description/)
    assert.match(markup, /Estimated PHP 16,000-42,000 per month/)
    assert.doesNotMatch(markup, /Reference year:/)
    assert.match(markup, /Salary figures are estimates/)
    assert.doesNotMatch(markup, /aria-valuenow|completed year|guaranteed/)
    const shortProgram = render({ ...course, program_duration_years: 3, year_levels: course.year_levels.slice(0, 3) })
    assert.equal((shortProgram.match(/role="tab"/g) || []).length, 3)
    const empty = render({})
    assert.match(empty, /year-by-year roadmap is not yet available/)
    assert.match(empty, /Career information is not yet available/)
    assert.doesNotMatch(empty, /role="tablist"/)
  } finally { await vite.close() }
})
