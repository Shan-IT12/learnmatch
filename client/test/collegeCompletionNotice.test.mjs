import test from 'node:test'
import assert from 'node:assert/strict'
import { collegeCompletionNoticeKey, hasSeenCollegeCompletion, markCollegeCompletionSeen } from '../src/utils/collegeCompletionNotice.js'
import { clearUserAuth, storeUserAuth } from '../src/utils/userAuth.js'

const storage = () => {
  const values = new Map()
  return { get length() { return values.size }, key: index => [...values.keys()][index], getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key) }
}

test('completion is shown once per account and tracking cycle, retaining the choice across logout/login', () => {
  const local = storage(), session = storage()
  const college = { courseId: 4, trackingCycleId: 80 }
  const key = collegeCompletionNoticeKey(101, college)
  assert.equal(hasSeenCollegeCompletion(local, key), false)
  markCollegeCompletionSeen(local, key)
  assert.equal(hasSeenCollegeCompletion(local, key), true)
  storeUserAuth(local, { userId: 101, token: 'A', username: 'studentA' }, session)
  clearUserAuth(local, session)
  storeUserAuth(local, { userId: 101, token: 'new-A', username: 'renamed_student' }, session)
  assert.equal(hasSeenCollegeCompletion(local, collegeCompletionNoticeKey(local.getItem('userId'), college)), true)
  assert.equal(hasSeenCollegeCompletion(local, collegeCompletionNoticeKey(102, college)), false)
  assert.equal(hasSeenCollegeCompletion(local, collegeCompletionNoticeKey(101, { ...college, trackingCycleId: 81 })), false)
})

test('legacy completions use a stable account and term identity without changing tracking data', () => {
  const local = storage()
  const college = { courseId: 4, termId: 90, academicYear: '2026-2027', yearLevel: '3rd Year', semester: '2nd Semester' }
  const before = structuredClone(college)
  const key = collegeCompletionNoticeKey(103, college)
  markCollegeCompletionSeen(local, key)
  assert.equal(hasSeenCollegeCompletion(local, collegeCompletionNoticeKey('103', { ...college })), true)
  assert.equal(hasSeenCollegeCompletion(local, collegeCompletionNoticeKey(103, { ...college, termId: 91 })), false)
  assert.deepEqual(college, before)
  assert.equal(collegeCompletionNoticeKey(null, college), null)
  assert.equal(hasSeenCollegeCompletion(local, null), true)
})

test('unavailable browser storage does not break the dashboard or repeat during this visit', () => {
  const restricted = { getItem() { throw Error('unavailable') }, setItem() { throw Error('unavailable') } }
  const key = collegeCompletionNoticeKey(104, { courseId: 4, trackingCycleId: 82 })
  assert.equal(hasSeenCollegeCompletion(restricted, key), false)
  assert.doesNotThrow(() => markCollegeCompletionSeen(restricted, key))
  assert.equal(hasSeenCollegeCompletion(restricted, key), true)
})
