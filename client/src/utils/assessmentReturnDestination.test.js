import test from 'node:test'
import assert from 'node:assert/strict'
import { getAssessmentCancelDestination, getAssessmentReturnDestination } from './assessmentReturnDestination.js'

test('active College Phase assessment results return to College Dashboard', () => {
  assert.deepEqual(getAssessmentReturnDestination({ lifecycleStatus: 'active' }), {
    path: '/college',
    label: 'Return to College Dashboard',
  })
})

test('users without an active College Phase return to Summary Dashboard', () => {
  for (const status of [null, {}, { lifecycleStatus: 'paused' }, { lifecycleStatus: 'ended' }]) {
    assert.deepEqual(getAssessmentReturnDestination(status), {
      path: '/dashboard/summary',
      label: 'Go to Summary Dashboard',
    })
  }
})

test('assessment cancellation returns active College users to College Dashboard', () => {
  assert.deepEqual(getAssessmentCancelDestination(true), {
    path: '/college',
    label: 'Return to College Dashboard',
  })
})

test('assessment cancellation returns non-college users to the main Dashboard', () => {
  assert.deepEqual(getAssessmentCancelDestination(false), {
    path: '/dashboard',
    label: 'Return to Dashboard',
  })
})
