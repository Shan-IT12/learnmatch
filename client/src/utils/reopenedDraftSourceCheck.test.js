import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { pendingSourceAnalysisBinding } from '../../../shared/pendingSourceReview.js'

test('reopened checker reuses analysis-only UI, current form and backend draft identity without saving', async () => {
  const [page, saved, transient, checker] = await Promise.all([
    '../pages/admin/ManageCourses.jsx', '../components/admin/DraftCourseSources.jsx',
    '../components/admin/ReopenedDraftSourceCheck.jsx', '../components/admin/SourceFirstDraftSources.jsx',
  ].map(path => readFile(new URL(path, import.meta.url), 'utf8')))
  assert.match(page, /Number\(data.course.is_draft\) === 1 && Number\(data.course.is_active\) === 0 && !data.publication/)
  assert.match(page, /editingDraft && editingCourseId && !publication/)
  assert.match(saved, /formRevision, refreshKey, analysisSources.map/)
  assert.match(saved, /editor\?\.source_id === source.source_id/)
  assert.match(saved, /ReopenedDraftSourceCheck key=\{checkKey\}/)
  assert.match(transient, /SourceFirstDraftSources .*checkingOnly/)
  assert.doesNotMatch(transient, /fetch\(|saveCourse|publish|confirm/)
  const readOnly = checker.slice(checker.indexOf('if (checkingOnly)'), checker.indexOf('return <div data-validation-field="source_details"'))
  assert.match(readOnly, /Unsaved changes included/)
  assert.match(readOnly, /does not save, confirm or publish/)
  assert.doesNotMatch(readOnly, /request\('confirm'|onChange=|Save Source|Save Draft|Record Admin/)
  assert.match(checker, /course_id: courseId/)
  assert.match(checker, /epoch !== formEpoch.current/)
  assert.match(checker, /abort.current.abort\(\)/)
  assert.match(saved, /source.review_token\}:\$\{formRevision\}/)
})

test('checking bindings preserve inputs while changing with unsaved course or source details', () => {
  const course = { course_name: 'Synthetic existing draft', description: 'Keep this text', program_duration_years: 4, year_levels: [] }
  const source = { source_id: 5, title: 'Keep title', url: 'https://ched.gov.ph/original.pdf', supported_fields: ['description'], notes: 'Keep note' }
  const before = structuredClone({ course, source }), binding = pendingSourceAnalysisBinding(source, course)
  assert.notEqual(binding, pendingSourceAnalysisBinding(source, { ...course, description: 'Unsaved change' }))
  assert.notEqual(binding, pendingSourceAnalysisBinding({ ...source, url: 'https://ched.gov.ph/changed.pdf' }, course))
  assert.notEqual(binding, pendingSourceAnalysisBinding({ ...source, notes: 'New page reference' }, course))
  assert.deepEqual({ course, source }, before)
})
