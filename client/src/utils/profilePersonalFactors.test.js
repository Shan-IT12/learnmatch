import test from 'node:test'
import assert from 'node:assert/strict'

import {
  personalFactorsChanged,
  shouldOfferRetake,
  shouldWarnForPersonalFactorAttempt,
} from './profilePersonalFactors.js'

const saved = Object.freeze({
  factor_physical: false,
  factor_health: true,
  factor_financial: false,
  factor_family: false,
  factor_working_student: false,
  factor_others: '',
  factor_distance: true,
})

test('historical distance is ignored and restored supported values are unchanged', () => {
  assert.equal(personalFactorsChanged({ ...saved, factor_distance: false }, saved, false, false), false)
  assert.equal(personalFactorsChanged({ ...saved, factor_health: false }, saved, false, false), true)
})

test('Others selected state and text are both compared', () => {
  assert.equal(personalFactorsChanged(saved, saved, true, false), true)
  assert.equal(personalFactorsChanged({ ...saved, factor_others: 'New value' }, saved, true, true), true)
})

test('warning requires a recommendation and an actual unconfirmed change', () => {
  const changed = { ...saved, factor_family: true }
  const base = {
    confirmationGranted: false,
    nextProfile: changed,
    savedProfile: saved,
    nextOthersSelected: false,
    savedOthersSelected: false,
  }
  assert.equal(shouldWarnForPersonalFactorAttempt({ ...base, hasRecommendation: false }), false)
  assert.equal(shouldWarnForPersonalFactorAttempt({ ...base, hasRecommendation: true }), true)
  assert.equal(shouldWarnForPersonalFactorAttempt({ ...base, hasRecommendation: true, confirmationGranted: true }), false)
  assert.equal(shouldWarnForPersonalFactorAttempt({ ...base, hasRecommendation: true, nextProfile: saved }), false)
})

test('retake is offered only for recommendation owners with final factor changes', () => {
  assert.equal(shouldOfferRetake({ hasRecommendation: false, factorsChanged: true }), false)
  assert.equal(shouldOfferRetake({ hasRecommendation: true, factorsChanged: false }), false)
  assert.equal(shouldOfferRetake({ hasRecommendation: true, factorsChanged: true }), true)
})
