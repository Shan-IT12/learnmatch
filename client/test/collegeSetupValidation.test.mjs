import { test } from 'node:test'
import assert from 'node:assert/strict'
import { termDateErrors, validateCollegeSetup } from '../src/utils/collegeSetupValidation.js'

const valid = {
  selectedCourse: { course_id: 1 }, academicYear: '2026-2027', yearLevel: '1st Year', programDuration: 4,
  calendarType: 'semester', termCode: 'SEM_1', semester: '1st Semester', timingChoice: 'exact',
  semesterStartDate: '2026-08-01', semesterEndDate: '2026-12-01',
}
test('earlier and equal end dates explain the problem; correcting dates clears errors', () => {
  for (const end of ['2026-07-01', valid.semesterStartDate]) {
    assert.equal(validateCollegeSetup({ ...valid, semesterEndDate: end }).semesterEndDate,
      'The end date must be later than the start date.')
  }
  assert.deepEqual(validateCollegeSetup(valid), {})
  assert.deepEqual(termDateErrors('', '', ['2026', '2027'], { partial: true }), {})
})
test('missing fields and invalid calendar, year, dates and term position are blocked', () => {
  const missing = validateCollegeSetup({ ...valid, selectedCourse: null, yearLevel: '', termCode: '', semesterStartDate: '', semesterEndDate: '' })
  assert.deepEqual(Object.keys(missing), ['course', 'yearLevel', 'semester', 'semesterStartDate', 'semesterEndDate'])
  assert.ok(validateCollegeSetup({ ...valid, academicYear: '2026-2028' }).academicYear)
  assert.ok(validateCollegeSetup({ ...valid, semesterEndDate: '2028-01-01' }).semesterEndDate)
  assert.ok(validateCollegeSetup({ ...valid, semesterStartDate: '2026-02-30' }).semesterStartDate)
  assert.ok(validateCollegeSetup({ ...valid, timingChoice: 'unknown', semesterPosition: 'invalid' }).semesterPosition)
  assert.deepEqual(validateCollegeSetup({ ...valid, timingChoice: 'unknown', semesterPosition: 'Mid' }), {})
})
test('approximate schedules require complete dates in the academic year and a later end', () => {
  const input = { ...valid, timingChoice: 'approximate', semesterPosition: 'Early',
    approximateStart: { month: '8', year: '2026', part: 'early' },
    approximateEnd: { month: '12', year: '2026', part: 'late' } }
  assert.deepEqual(validateCollegeSetup(input), {})
  assert.ok(validateCollegeSetup({ ...input, approximateStart: {} }).approximateStart)
  assert.ok(validateCollegeSetup({ ...input, approximateEnd: input.approximateStart }).approximateEnd)
  assert.ok(validateCollegeSetup({ ...input, approximateEnd: { ...input.approximateEnd, year: '2028' } }).approximateEnd)
})
