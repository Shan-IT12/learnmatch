import test from 'node:test'
import assert from 'node:assert/strict'

import {
  applyFactorApplicability,
  buildProfilePayload,
  deriveFactorApplicability,
  shouldShowFactorDetails,
} from './profilePersonalFactors.js'

const saved = Object.freeze({
  physical_accessibility_areas: ['seeing', 'hearing'],
  physical_accessibility_difficulties: { seeing: 'some_difficulty', hearing: 'cannot_do' },
  factor_physical_impact: 2,
  factor_health_impact: 1,
  factor_financial_impact: 1,
  factor_family_impact: 1,
  factor_work_impact: 3,
  factor_distance: true,
})

test('structured values derive safe Yes and No applicability without fabricating details', () => {
  assert.deepEqual(deriveFactorApplicability(saved), {
    physical: 'yes', health: 'no', financial: 'no', family: 'no', work: 'yes',
  })
  assert.equal(deriveFactorApplicability({}).physical, '')
})

test('No maps every factor to impact 1 and Physical No clears stale details', () => {
  for (const factor of ['health', 'financial', 'family', 'work']) {
    assert.equal(applyFactorApplicability(saved, factor, 'no')[`factor_${factor}_impact`], 1)
  }
  const physicalNo = applyFactorApplicability(saved, 'physical', 'no')
  assert.equal(physicalNo.factor_physical_impact, 1)
  assert.deepEqual(physicalNo.physical_accessibility_areas, [])
  assert.deepEqual(physicalNo.physical_accessibility_difficulties, {})
})

test('Yes reveals an unanswered impact instead of silently reusing No', () => {
  assert.equal(applyFactorApplicability({ factor_health_impact: 1 }, 'health', 'yes').factor_health_impact, '')
  assert.equal(shouldShowFactorDetails({ health: 'yes' }, 'health'), true)
  assert.equal(shouldShowFactorDetails({ health: 'no' }, 'health'), false)
})

test('all five factors serialize without removed Profile fields', () => {
  const payload = buildProfilePayload({ ...saved, username: ' student_name ', full_name: 'Legacy Name', height_cm: 170, weight_kg: 65, factor_others: 'Legacy text' })
  assert.deepEqual(Object.keys(payload), [
    'username',
    'physical_accessibility_areas',
    'physical_accessibility_difficulties',
    'factor_physical_impact',
    'factor_health_impact',
    'factor_financial_impact',
    'factor_family_impact',
    'factor_work_impact',
  ])
  assert.equal(payload.username, 'student_name')
  assert.deepEqual([
    payload.factor_physical_impact,
    payload.factor_health_impact,
    payload.factor_financial_impact,
    payload.factor_family_impact,
    payload.factor_work_impact,
  ], [2, 1, 1, 1, 3])
})
