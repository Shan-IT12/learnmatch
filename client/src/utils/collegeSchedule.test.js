import test from 'node:test'
import assert from 'node:assert/strict'
import {
  calculateDisplayedSemesterPhase,
  getAcademicYearOptions,
  getCurrentAcademicYear,
  isApproximateEndAfterStart,
} from './collegeSchedule.js'

test('derives the current academic year across the June boundary', () => {
  assert.equal(getCurrentAcademicYear(new Date(2026, 4, 31)), '2025-2026')
  assert.equal(getCurrentAcademicYear(new Date(2026, 5, 1)), '2026-2027')
  assert.equal(getCurrentAcademicYear(new Date(2026, 8, 29)), '2026-2027')
})

test('generates both dropdown years from a hyphenated academic year', () => {
  assert.deepEqual(getAcademicYearOptions('2026-2027'), ['2026', '2027'])
})

test('supports an en dash and surrounding separator whitespace', () => {
  assert.deepEqual(getAcademicYearOptions(' 2026 – 2027 '), ['2026', '2027'])
})

test('returns no options for incomplete or non-consecutive academic years', () => {
  assert.deepEqual(getAcademicYearOptions('2026-'), [])
  assert.deepEqual(getAcademicYearOptions('2026-2028'), [])
})

test('approximate end must be strictly after the complete start selection', () => {
  const start = { month: '8', year: '2026', part: 'middle' }
  assert.equal(isApproximateEndAfterStart(start, { month: '8', year: '2026', part: 'early' }), false)
  assert.equal(isApproximateEndAfterStart(start, { month: '8', year: '2026', part: 'middle' }), false)
  assert.equal(isApproximateEndAfterStart(start, { month: '8', year: '2026', part: 'late' }), true)
  assert.equal(isApproximateEndAfterStart(start, { month: '1', year: '2027', part: 'early' }), true)
})

test('exact dates display Early, Mid, and End using the backend thirds rule', () => {
  assert.equal(calculateDisplayedSemesterPhase('2026-01-01', '2026-04-11', new Date(2026, 0, 10)), 'Early')
  assert.equal(calculateDisplayedSemesterPhase('2026-01-01', '2026-04-11', new Date(2026, 1, 20)), 'Mid')
  assert.equal(calculateDisplayedSemesterPhase('2026-01-01', '2026-04-11', new Date(2026, 3, 1)), 'End')
})
