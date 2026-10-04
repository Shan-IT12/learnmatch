import test from 'node:test'
import assert from 'node:assert/strict'
import { getCheckinHistoryRecords, getCurrentSemesterRecords, getPreviousSemesterRecords, getNextAcademicStage, hasDisplayableGwa } from './collegeTrackingView.js'

test('modern history is separated by term_id even when labels are identical', () => {
  const history = [
    { checkinId: 1, termId: 10, semester: '1st Semester', phase: 'Early' },
    { checkinId: 2, termId: 20, semester: '1st Semester', phase: 'Early' },
  ]
  assert.deepEqual(getCurrentSemesterRecords(history, { termId: 20 }).map(({ checkinId }) => checkinId), [2])
  assert.deepEqual(getPreviousSemesterRecords(history, { termId: 20 }).map(({ checkinId }) => checkinId), [1])
})

test('check-in history includes current-term records and sorts newest first', () => {
  const history = [
    { checkinId: 7, termId: 20, phase: 'Early' },
    { checkinId: 9, termId: 20, phase: 'Mid' },
    { checkinId: 3, termId: 10, phase: 'End' },
  ]
  assert.deepEqual(getCheckinHistoryRecords(history).map(({ checkinId }) => checkinId), [9, 7, 3])
  assert.equal(history[0].checkinId, 7)
})

test('GWA is shown only for End check-ins with a valid stored value', () => {
  assert.equal(hasDisplayableGwa({ phase: 'Early', gwa: 91 }), false)
  assert.equal(hasDisplayableGwa({ phase: 'Mid', gwa: 88 }), false)
  assert.equal(hasDisplayableGwa({ phase: 'End', gwa: null }), false)
  assert.equal(hasDisplayableGwa({ phase: 'End', gwa: 'not recorded' }), false)
  assert.equal(hasDisplayableGwa({ phase: 'End', gwa: 87.5 }), true)
})

test('client progression uses regular terms while retaining legacy Summer progression', () => {
  assert.equal(getNextAcademicStage('1st Year', '1st Semester', 4, true, 'semester', 'SEM_1').termCode, 'SEM_2')
  assert.equal(getNextAcademicStage('1st Year', '2nd Semester', 4, true, 'semester', 'SEM_2', true).termCode, 'SEM_1')
  assert.equal(getNextAcademicStage('1st Year', '2nd Trimester', 4, true, 'trimester', 'TRI_2').termCode, 'TRI_3')
  assert.equal(getNextAcademicStage('1st Year', '3rd Trimester', 4, true, 'trimester', 'TRI_3').termCode, 'TRI_1')
})
