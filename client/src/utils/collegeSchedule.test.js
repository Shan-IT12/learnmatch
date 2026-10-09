import test from 'node:test'
import assert from 'node:assert/strict'
import {
  calculateDisplayedSemesterPhase,
  getAcademicYearOptions,
  getCollegeSetupAcademicYear,
  getCurrentAcademicYear,
  getFutureAcademicYearRanges,
  isApproximateEndAfterStart,
} from './collegeSchedule.js'

test('derives the current academic year across the June boundary', () => {
  assert.equal(getCurrentAcademicYear(new Date(2026, 9, 1)), '2026-2027')
  assert.equal(getCurrentAcademicYear(new Date(2027, 0, 1)), '2026-2027')
  assert.equal(getCurrentAcademicYear(new Date(2027, 5, 1)), '2027-2028')
})

test('new setup uses the current year while resume preserves its saved academic year', () => {
  const today = new Date(2027, 5, 1)
  assert.equal(getCollegeSetupAcademicYear('setup', '2024-2025', today), '2027-2028')
  assert.equal(getCollegeSetupAcademicYear('resume', '2024-2025', today), '2024-2025')
})

test('generates both dropdown years from a hyphenated academic year', () => {
  assert.deepEqual(getAcademicYearOptions('2026-2027'), ['2026', '2027'])
})

test('offers only the current and future full academic-year ranges', () => {
  assert.deepEqual(getFutureAcademicYearRanges(new Date(2026, 9, 4), 3), [
    '2026-2027',
    '2027-2028',
    '2028-2029',
  ])
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
  assert.equal(calculateDisplayedSemesterPhase('2026-01-01', '2026-04-11', new Date(2025, 11, 31)), 'NOT_STARTED')
  assert.equal(calculateDisplayedSemesterPhase('2026-01-01', '2026-04-11', new Date(2026, 0, 10)), 'Early')
  assert.equal(calculateDisplayedSemesterPhase('2026-01-01', '2026-04-11', new Date(2026, 1, 20)), 'Mid')
  assert.equal(calculateDisplayedSemesterPhase('2026-01-01', '2026-04-11', new Date(2026, 3, 1)), 'End')
  assert.equal(calculateDisplayedSemesterPhase('2026-01-01', '2026-04-11', new Date(2026, 3, 12)), 'ENDED')
})
