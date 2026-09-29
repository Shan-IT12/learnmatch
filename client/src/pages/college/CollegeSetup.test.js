import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import { getAcademicYearOptions } from '../../utils/collegeSchedule.js'
import { buildCollegeSetupPayload } from '../../utils/collegeSchedule.js'

test('renders both approximate year dropdowns with the active academic-year options', async () => {
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: 'custom',
    optimizeDeps: { noDiscovery: true },
  })

  try {
    const { ApproximateScheduleFields } = await vite.ssrLoadModule('/src/pages/college/CollegeSetup.jsx')
    const schedule = { month: '', year: '', part: '' }
    const academicYears = getAcademicYearOptions('2026-2027')
    const markup = renderToStaticMarkup(React.createElement(ApproximateScheduleFields, {
      academicYears,
      approximateStart: schedule,
      approximateEnd: schedule,
      setApproximateStart: () => {},
      setApproximateEnd: () => {},
    }))

    const yearSelects = [...markup.matchAll(/<select aria-label="([^"]+ year)"[^>]*>(.*?)<\/select>/g)]
    assert.deepEqual(yearSelects.map((match) => match[1]), [
      'Around when did your term start? year',
      'Around when will your term end? year',
    ])

    for (const [, , optionsMarkup] of yearSelects) {
      const options = [...optionsMarkup.matchAll(/<option value="([^"]*)"(?: selected="")?>([^<]+)<\/option>/g)]
        .map((match) => ({ value: match[1], label: match[2] }))
      assert.deepEqual(options, [
        { value: '', label: 'Year' },
        { value: '2026', label: '2026' },
        { value: '2027', label: '2027' },
      ])
    }
  } finally {
    await vite.close()
  }
})

test('Resume renders the existing program without recommendation or course-selection controls', async () => {
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: 'custom',
    optimizeDeps: { noDiscovery: true },
  })
  try {
    const { ResumeProgramCard } = await vite.ssrLoadModule('/src/pages/college/CollegeSetup.jsx')
    const markup = renderToStaticMarkup(React.createElement(ResumeProgramCard, {
      course: { course_id: 395, course_name: 'Bachelor of Science in Mathematics' },
    }))
    assert.match(markup, /Current Program/)
    assert.match(markup, /Bachelor of Science in Mathematics/)
    assert.match(markup, /resuming tracking for your existing program/)
    assert.doesNotMatch(markup, /What course are you enrolled in\?|Based on your recommendations|type="search"/)
  } finally {
    await vite.close()
  }
})

test('Resume payload omits client course identity while Change Program retains it', async () => {
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: 'custom',
    optimizeDeps: { noDiscovery: true },
  })
  try {
    const course = { course_id: 395, course_name: 'Bachelor of Science in Mathematics' }
    const enrollment = { academicYear: '2027-2028', yearLevel: '4th Year', termCode: 'SEM_1' }
    assert.deepEqual(buildCollegeSetupPayload('resume', course, enrollment), enrollment)
    assert.equal(buildCollegeSetupPayload('change', course, enrollment).courseId, 395)
  } finally {
    await vite.close()
  }
})
