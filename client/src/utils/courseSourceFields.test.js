import test from 'node:test'
import assert from 'node:assert/strict'
import { COURSE_SOURCE_FIELDS, validateCourseSource } from '../../../shared/courseSourceFields.js'
import { savedSourceCoverage, sourceSupportLabels, sourceConfirmationPayload } from './sourceReviewForm.js'

test('editor validation returns field-specific errors and structured selections', () => {
  const invalid = validateCourseSource({ title: ' ', url: 'javascript:alert(1)', supported_fields: [], notes: 'x'.repeat(5001) })
  assert.deepEqual(Object.keys(invalid.errors).sort(), ['notes', 'supported_fields', 'title', 'url'])
  const valid = validateCourseSource({ title: ' Official curriculum ', url: 'https://example.edu/curriculum.pdf', supported_fields: ['duration', 'course_name'], notes: '' })
  assert.deepEqual(valid.errors, {})
  assert.deepEqual(valid.value.supported_fields, ['course_name', 'duration'])
  assert.equal(valid.value.title, 'Official curriculum')
  assert.equal(valid.value.notes, null)
  assert.equal(Object.keys(COURSE_SOURCE_FIELDS).length, 5)
  assert.ok(validateCourseSource({ ...valid.value, url: 'https:example.edu' }).errors.url)
  assert.ok(validateCourseSource({ ...valid.value, url: 'https://user:secret@example.edu' }).errors.url)
})

test('confirmation requires a current explicit checkbox and clean saved state, and sends no reviewer data', () => {
  const source = { review_token: 'saved-revision', reviewer_id: 999, reviewed_at: '1900-01-01' }
  assert.equal(sourceConfirmationPayload(source, null, false), null)
  assert.equal(sourceConfirmationPayload(source, 'old-revision', false), null)
  assert.equal(sourceConfirmationPayload(source, source.review_token, true), null)
  assert.equal(sourceConfirmationPayload({ ...source, is_removed: true }, source.review_token, false), null)
  assert.deepEqual(sourceConfirmationPayload(source, source.review_token, false), { confirmed: true, expected_token: 'saved-revision' })
})


test('saved coverage counts selected current claims, not implicit course-name context or old confirmations', () => {
  const partial = { supported_fields: ['duration', 'obtainable_skills'], is_removed: 0, reviews: [{ current: true, claim_snapshot: { course_name: { name: 'Synthetic target' }, duration: {}, obtainable_skills: 'Synthetic' } }] }
  assert.deepEqual(savedSourceCoverage([partial]), { confirmed: ['obtainable_skills', 'duration'], missing: ['course_name', 'description', 'matching_profile_evidence'] })
  assert.equal(sourceSupportLabels(partial), 'Obtainable skills, Duration')
  const extra = { ...partial, supported_fields: ['course_name', 'description', 'matching_profile_evidence'] }
  assert.deepEqual(savedSourceCoverage([partial, extra]).missing, [])
  assert.equal(savedSourceCoverage([{ ...extra, reviews: [{ current: false }] }, partial]).missing.length, 3)
  assert.equal(savedSourceCoverage([{ ...extra, is_removed: 1 }, partial]).missing.length, 3)
  assert.equal(savedSourceCoverage([{ ...extra, reviews: [] }, partial]).missing.length, 3)
  assert.deepEqual(partial.supported_fields, ['duration', 'obtainable_skills'])
})
