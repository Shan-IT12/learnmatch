import test from 'node:test'
import assert from 'node:assert/strict'

import { getFeedbackDashboardPath, getFeedbackEntryContext } from './feedbackNavigation.js'

test('explicit College context returns Feedback to the College Dashboard', () => {
  const context = getFeedbackEntryContext('college', 'dashboard')
  assert.equal(context, 'college')
  assert.equal(getFeedbackDashboardPath(context), '/college')
})

test('stored College context keeps refresh navigation deterministic', () => {
  const context = getFeedbackEntryContext(undefined, 'college')
  assert.equal(getFeedbackDashboardPath(context), '/college')
})

test('normal dashboard context does not redirect into College Phase', () => {
  const context = getFeedbackEntryContext('dashboard', 'college')
  assert.equal(context, 'dashboard')
  assert.equal(getFeedbackDashboardPath(context), '/dashboard')
})

test('unknown context uses the normal dashboard fallback', () => {
  assert.equal(getFeedbackDashboardPath(getFeedbackEntryContext(undefined, undefined)), '/dashboard')
})
