import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const testsDirectory = path.dirname(fileURLToPath(import.meta.url))
const dashboardSource = fs.readFileSync(
  path.join(testsDirectory, '../../client/src/pages/admin/AdminDashboard.jsx'),
  'utf8'
)
const headerSource = fs.readFileSync(
  path.join(testsDirectory, '../../client/src/components/AdminHeader.jsx'),
  'utf8'
)

test('admin dashboard presents only the approved paper-aligned sections', () => {
  for (const heading of [
    'Registered Students',
    'Completed Assessments',
    'Assessments with Personal Factors',
    'Assessment Completion Rate',
    'Top Recommended Courses',
    'Course Popularity',
    'Recently Registered Users',
  ]) {
    assert.match(dashboardSource, new RegExp(heading))
  }

  for (const removedLabel of [
    'Active Courses',
    'Tracking Students',
    'Flagged Students',
    'Career Alignment Status',
    'Recommended Course Clusters',
    'Recent Activity',
    'No Check-in',
  ]) {
    assert.doesNotMatch(dashboardSource, new RegExp(removedLabel))
  }
})

test('personal-factor count and course popularity labels are unambiguous', () => {
  assert.match(dashboardSource, /consideredPersonalFactors\.toLocaleString\(\).*of\{' '\}/s)
  assert.match(dashboardSource, /completedAssessments\.toLocaleString\(\).*completed assessments/s)
  assert.match(dashboardSource, /labels: dashboard\.coursePopularity\.map\(\(\{ courseName \}\)/)
  assert.match(dashboardSource, /fullCourseNames: dashboard\.coursePopularity\.map/)
  assert.doesNotMatch(dashboardSource, /labels: dashboard\.coursePopularity\.map\(\(\{ courseCode/)
})

test('dashboard retains its existing admin header and admin-only API request', () => {
  assert.match(dashboardSource, /<AdminHeader currentPage="dashboard"/)
  assert.match(dashboardSource, /\/api\/admin\/dashboard/)
  assert.match(dashboardSource, /Authorization: `Bearer/)
  for (const route of ['/admin', '/admin/users', '/admin/courses', '/admin/analytics', '/admin/feedback']) {
    assert.match(headerSource, new RegExp(`to="${route}"`))
  }
})
