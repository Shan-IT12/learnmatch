import test from 'node:test'
import assert from 'node:assert/strict'
import { getCurrentSemesterRecords, getPreviousSemesterRecords, getNextAcademicStage } from './collegeTrackingView.js'

test('modern history is separated by term_id even when labels are identical', () => {
  const history = [
    { checkinId: 1, termId: 10, semester: '1st Semester', phase: 'Early' },
    { checkinId: 2, termId: 20, semester: '1st Semester', phase: 'Early' },
  ]
  assert.deepEqual(getCurrentSemesterRecords(history, { termId: 20 }).map(({ checkinId }) => checkinId), [2])
  assert.deepEqual(getPreviousSemesterRecords(history, { termId: 20 }).map(({ checkinId }) => checkinId), [1])
})

test('client progression mirrors semester, optional Summer, and trimester rules', () => {
  assert.equal(getNextAcademicStage('1st Year', '1st Semester', 4, true, 'semester', 'SEM_1').termCode, 'SEM_2')
  assert.equal(getNextAcademicStage('1st Year', '2nd Semester', 4, true, 'semester', 'SEM_2', true).termCode, 'SUMMER_MIDYEAR')
  assert.equal(getNextAcademicStage('1st Year', '2nd Trimester', 4, true, 'trimester', 'TRI_2').termCode, 'TRI_3')
  assert.equal(getNextAcademicStage('1st Year', '3rd Trimester', 4, true, 'trimester', 'TRI_3').termCode, 'TRI_1')
})
