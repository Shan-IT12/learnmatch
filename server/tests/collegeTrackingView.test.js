import test from 'node:test'
import assert from 'node:assert/strict'

import {
  getAlignmentTrend,
  getCurrentSemesterRecords,
} from '../../client/src/utils/collegeTrackingView.js'

test('alignment trends use only stored current-term results', () => {
  const college = { termId: 9 }
  const history = [
    { termId: 9, phase: 'End', alignmentPercent: 74 },
    { termId: 9, phase: 'Mid', alignmentPercent: 65 },
    { termId: 8, phase: 'Early', alignmentPercent: 99 },
  ]
  const records = getCurrentSemesterRecords(history, college)
  assert.deepEqual(records.map(({ phase }) => phase), ['Mid', 'End'])
  assert.deepEqual(getAlignmentTrend(records), { direction: 'improving', delta: 9 })
})

test('one completed check-in does not claim a trend', () => {
  assert.deepEqual(
    getAlignmentTrend([{ phase: 'Mid', alignmentPercent: 65 }]),
    { direction: 'insufficient', delta: null }
  )
  assert.deepEqual(getAlignmentTrend([]), { direction: 'insufficient', delta: null })
})
