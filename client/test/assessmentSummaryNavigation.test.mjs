import { test } from 'node:test'
import assert from 'node:assert/strict'
import { collegePhasePath, hasSavedAssessmentSummary } from '../src/utils/assessmentSummaryNavigation.js'
import { getAssessmentReturnDestination, getSavedResultsPath } from '../src/utils/assessmentReturnDestination.js'

test('summary requires an authenticated saved result tied to a completed assessment', () => {
  for (const data of [null, {}, { recommendations: [] },
    { recommendation: { recommendation_id: 1 }, recommendations: [{}] },
    { recommendation: { assessment_id: 1, recommendation_id: 2 }, recommendations: [] }]) {
    assert.equal(hasSavedAssessmentSummary(data), false)
  }
  assert.equal(hasSavedAssessmentSummary({
    recommendation: { assessment_id: 1, recommendation_id: 2 }, recommendations: [{ course_code: 'QA' }],
  }), true)
})

test('College return uses active tracking and otherwise retains setup', () => {
  assert.equal(collegePhasePath({ active: true }), '/college')
  for (const status of [null, {}, { active: false }]) assert.equal(collegePhasePath(status), '/college/setup')
})

test('Results opened from Summary returns there even when College tracking is active', () => {
  for (const status of [null, { lifecycleStatus: 'active' }, { lifecycleStatus: 'paused' }]) {
    assert.deepEqual(getAssessmentReturnDestination(status, 'summary'), {
      path: '/dashboard/summary', label: 'Return to Summary Dashboard',
    })
  }
  assert.equal(getAssessmentReturnDestination({ lifecycleStatus: 'active' }).path, '/college')
  assert.equal(getAssessmentReturnDestination(null).path, '/dashboard/summary')
  assert.equal(getAssessmentReturnDestination({ lifecycleStatus: 'active' }, 'https://example.test').path, '/college')
})

test('resuming Results preserves the resolved return destination without regenerating recommendations', () => {
  assert.equal(getSavedResultsPath('', '/college'), '/results?saved=1&returnTo=college')
  assert.equal(getSavedResultsPath('returnTo=summary', '/dashboard/summary'), '/results?returnTo=summary&saved=1')
  assert.equal(getSavedResultsPath('returnTo=college&saved=0', '/dashboard/summary'), '/results?returnTo=summary&saved=1')
})
