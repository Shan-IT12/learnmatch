import test from 'node:test'
import assert from 'node:assert/strict'

import {
  applyFactorApplicability,
  buildProfilePayload,
  deriveFactorApplicability,
  isPersonalFactorsComplete,
  shouldShowFactorDetails,
} from './profilePersonalFactors.js'

const saved = Object.freeze({
  personal_factor_answers: { physical: 'yes', health: 'no', financial: 'yes', family: 'unknown', work: 'yes' },
  physical_accessibility_areas: ['seeing', 'hearing'],
  physical_accessibility_difficulties: { seeing: 'some_difficulty', hearing: 'cannot_do' },
  factor_physical_impact: 2,
  factor_health_impact: null,
  factor_financial_impact: 1,
  factor_family_impact: null,
  factor_work_impact: 3,
  factor_distance: true,
})

test('structured values derive safe Yes and No applicability without fabricating details', () => {
  assert.deepEqual(deriveFactorApplicability(saved), {
    physical: 'yes', health: 'no', financial: 'yes', family: 'unknown', work: 'yes',
  })
  assert.equal(deriveFactorApplicability({}).physical, 'unknown')
})

test('profile completeness requires every Personal Factor and conditional physical details', () => {
  assert.equal(isPersonalFactorsComplete(saved), true)
  assert.equal(isPersonalFactorsComplete({}), true)
  assert.equal(isPersonalFactorsComplete({ ...saved, factor_financial_impact: null }), false)
  assert.equal(isPersonalFactorsComplete({ ...saved, physical_accessibility_difficulties: { seeing: 'some_difficulty' } }), false)
  assert.equal(isPersonalFactorsComplete({ ...saved, personal_factor_answers: { ...saved.personal_factor_answers, physical: 'no' }, factor_physical_impact: null, physical_accessibility_areas: [], physical_accessibility_difficulties: {} }), true)
})

test('No is explicit with no severity and clears stale physical details', () => {
  for (const factor of ['health', 'financial', 'family', 'work']) {
    assert.equal(applyFactorApplicability(saved, factor, 'no')[`factor_${factor}_impact`], null)
  }
  const physicalNo = applyFactorApplicability(saved, 'physical', 'no')
  assert.equal(physicalNo.factor_physical_impact, null)
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
    'personal_factor_answers',
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
  ], [2, null, 1, null, 3])
})

test('save/reload preserves No, Yes/slight, and nondisclosure as distinct choices', () => {
  for (const factor of ['physical', 'health', 'financial', 'family', 'work']) {
    for (const answer of ['yes', 'no', 'unknown']) {
      const changed = applyFactorApplicability({ ...saved, username: 'student' }, factor, answer)
      if (answer === 'yes') changed[`factor_${factor}_impact`] = 1
      const payload = JSON.parse(JSON.stringify(buildProfilePayload(changed)))
      assert.equal(deriveFactorApplicability(payload)[factor], answer)
      assert.equal(payload[`factor_${factor}_impact`], answer === 'yes' ? 1 : null)
      assert.equal(isPersonalFactorsComplete(payload), true)
    }
  }
})

test('historical impact 1 is visibly ambiguous and survives save without guessing', () => {
  const legacy = { ...saved, username: 'student', personal_factor_answers: null, factor_physical_impact: 1 }
  assert.equal(deriveFactorApplicability(legacy).physical, 'legacy_unknown')
  const payload = buildProfilePayload(legacy)
  assert.equal(payload.personal_factor_answers.physical, 'legacy_unknown')
  assert.equal(payload.factor_physical_impact, 1)
  assert.equal(deriveFactorApplicability(payload).physical, 'legacy_unknown')
})

test('preferring not to answer removes previously disclosed accessibility details', () => {
  const payload = buildProfilePayload(applyFactorApplicability({ ...saved, username: 'student' }, 'physical', 'unknown'))
  assert.deepEqual(payload.physical_accessibility_areas, [])
  assert.deepEqual(payload.physical_accessibility_difficulties, {})
  assert.equal(payload.factor_physical_impact, null)
  assert.equal(shouldShowFactorDetails({ physical: 'unknown' }, 'physical'), false)
})
