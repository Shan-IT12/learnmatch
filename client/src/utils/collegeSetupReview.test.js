import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createCollegePhaseConfirmer,
  getCollegeSetupEditNavigation,
  getCollegeSetupScheduleReview,
  shouldReviewCollegeSetup,
} from './collegeSetupReview.js'

const draft = {
  selectedCourse: { course_id: 12, course_name: 'Bachelor of Science in Information Technology Major in Network Technology' },
  academicYear: '2026-2027',
  yearLevel: '4th Year',
  calendarType: 'semester',
  semester: '1st Semester',
  timingChoice: 'exact',
  semesterStartDate: '2026-08-12',
  semesterEndDate: '2026-12-18',
  payload: { courseId: 12, academicYear: '2026-2027' },
}

test('only a new setup proceeds to review before creating a cycle', () => {
  assert.equal(shouldReviewCollegeSetup('setup'), true)
  assert.equal(shouldReviewCollegeSetup('resume'), false)
  assert.equal(shouldReviewCollegeSetup('change'), false)
  assert.equal(shouldReviewCollegeSetup('restart'), false)
})

test('Edit Setup returns the complete unchanged draft', () => {
  assert.deepEqual(getCollegeSetupEditNavigation(draft), {
    to: '/college/setup',
    options: { state: { setupDraft: draft } },
  })
})

test('schedule review formats exact, approximate, and unknown timing modes', () => {
  assert.deepEqual(getCollegeSetupScheduleReview(draft), {
    label: 'Term Schedule',
    value: 'August 12, 2026 – December 18, 2026',
  })
  assert.match(getCollegeSetupScheduleReview({ ...draft, timingChoice: 'approximate', approximateStart: { part: 'early', month: '8', year: '2026' }, approximateEnd: { part: 'late', month: '12', year: '2026' }, semesterPosition: 'Mid' }).value, /Early August 2026.*Late December 2026.*Mid phase/)
  assert.match(getCollegeSetupScheduleReview({ ...draft, timingChoice: 'unknown', semesterPosition: 'Early' }).value, /Exact dates unknown.*Early phase/)
})

test('confirmation is lazy, creates once on double confirmation, and redirects once', async () => {
  let requests = 0
  let redirects = 0
  const fetchImpl = async (url, options) => {
    requests += 1
    assert.match(url, /\/api\/college\/setup$/)
    assert.deepEqual(JSON.parse(options.body), draft.payload)
    await new Promise((resolve) => setTimeout(resolve, 5))
    return { ok: true, json: async () => ({ created: true }) }
  }
  const confirm = createCollegePhaseConfirmer({ apiUrl: 'https://example.test', token: 'token', draft, fetchImpl, onSuccess: () => { redirects += 1 } })

  assert.equal(requests, 0)
  await Promise.all([confirm(), confirm()])
  await confirm()
  assert.equal(requests, 1)
  assert.equal(redirects, 1)
})
