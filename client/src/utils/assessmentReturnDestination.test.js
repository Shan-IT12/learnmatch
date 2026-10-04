import test from 'node:test'
import assert from 'node:assert/strict'
import { getAssessmentReturnDestination } from './assessmentReturnDestination.js'

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
