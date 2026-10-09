import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'

test('review displays the complete College Phase setup and tracking preview', async () => {
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', optimizeDeps: { noDiscovery: true } })
  try {
    const { CollegeSetupReviewContent } = await vite.ssrLoadModule('/src/pages/college/CollegeSetupReview.jsx')
    const markup = renderToStaticMarkup(React.createElement(CollegeSetupReviewContent, {
      draft: {
        selectedCourse: { course_name: 'Bachelor of Science in Information Technology Major in Network Technology', course_abbreviation: 'BSIT' },
        academicYear: '2026-2027',
        yearLevel: '4th Year',
        calendarType: 'semester',
        semester: '1st Semester',
        timingChoice: 'exact',
        semesterStartDate: '2026-08-12',
        semesterEndDate: '2026-12-18',
      },
      onEdit: () => {},
      onConfirm: () => {},
    }))
    for (const text of ['Your College Phase', 'Bachelor of Science in Information Technology', 'Major in Network Technology', '2026–2027', '4th Year', 'Semester', '1st Semester', 'August 12, 2026', 'December 18, 2026', 'Early Check-in', 'Mid Check-in', 'End Check-in', 'Edit Setup', 'Confirm &amp; Start College Phase']) {
      assert.match(markup, new RegExp(text))
    }
  } finally {
    await vite.close()
  }
})
