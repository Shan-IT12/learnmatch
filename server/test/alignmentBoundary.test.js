import test from 'node:test'
import assert from 'node:assert/strict'
import { determineAlignmentStatus, calculateAlignmentResult } from '../services/collegeTrackingService.js'

test('all phases use an inclusive 70 percent high-alignment threshold without GWA', () => {
  for (const phase of ['Early', 'Mid', 'End']) {
    for (const [score, expected] of [[0, 'Needs Attention'], [40, 'Needs Attention'], [41, 'Monitor'], [69, 'Monitor'], [70, 'On Track'], [71, 'On Track'], [100, 'On Track']]) {
      assert.equal(determineAlignmentStatus(score, { phase }), expected)
    }
  }
})

test('End GWA retains the combined support rule at both thresholds', () => {
  for (const [score, gwa, expected] of [[70,75,'On Track'],[69,75,'Monitor'],[70,74,'Monitor'],[69,74,'Needs Attention']]) {
    assert.equal(determineAlignmentStatus(score, { phase: 'End', gwa }), expected)
  }
  const answers = [4,4,4,4,3].map((score,i)=>({question_number:i+1,score}))
  const result = calculateAlignmentResult(answers, { phase: 'Early' })
  assert.equal(result.alignmentPercent, 70)
  assert.equal(result.mismatchScore, 30)
  assert.equal(result.status, 'On Track')
})
