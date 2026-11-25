import test from 'node:test'
import assert from 'node:assert/strict'
import { deriveFactorApplicability, personalFactorResponses } from '../shared/personalFactors.js'
import { getPersonalFactorExplanation } from '../../shared/personalFactorExplanation.js'
import { validateProfile } from '../services/requestValidationService.js'
import { calculatePersonalFactorScore, normalizePersonalFactorImpact } from '../services/recommendationEngine.js'
import { PARENT_CLUSTERS } from '../config/recommendationConfig.js'
import { AI_EXPLANATION_INSTRUCTIONS, buildPersonalFactorGuidanceContext } from '../services/recommendationExplanationService.js'

test('No, Prefer not to say, and Yes -> No impact all map to neutral 0 in WSM scoring', () => {
  const profile = {
    personal_factor_answers: {
      physical: 'no',
      health: 'prefer_not_to_say',
      financial: 'yes',
      family: 'prefer_not_to_say',
      work: 'no',
    },
    factor_physical_impact: null,
    factor_health_impact: null,
    factor_financial_impact: 0,
    factor_family_impact: null,
    factor_work_impact: null,
  }

  assert.deepEqual(deriveFactorApplicability(profile), {
    physical: 'no',
    health: 'prefer_not_to_say',
    financial: 'yes',
    family: 'prefer_not_to_say',
    work: 'no',
  })

  const responses = personalFactorResponses(profile)
  assert.deepEqual(responses, {
    physical: 0,
    health: 0,
    financial: 0,
    family: 0,
    work: 0,
  })

  assert.equal(normalizePersonalFactorImpact(0), 0)
  assert.equal(normalizePersonalFactorImpact(1), 0)
  assert.equal(normalizePersonalFactorImpact(4), 1)
  for (const cluster of PARENT_CLUSTERS) {
    assert.equal(calculatePersonalFactorScore(responses, cluster), 0.5)
  }
})

test('validateProfile accepts prefer_not_to_say, 0 (No impact), and multi-select health_wellbeing_areas', () => {
  const validPayload = {
    username: 'student_01',
    personal_factor_answers: {
      physical: 'prefer_not_to_say',
      health: 'yes',
      financial: 'yes',
      family: 'no',
      work: 'prefer_not_to_say',
    },
    physical_accessibility_areas: [],
    physical_accessibility_difficulties: {},
    health_wellbeing_areas: ['physical_health', 'mental_emotional'],
    factor_physical_impact: null,
    factor_health_impact: 0,
    factor_financial_impact: 3,
    factor_family_impact: null,
    factor_work_impact: null,
  }

  const result = validateProfile(validPayload)
  assert.equal(result.valid, true)
  assert.deepEqual(result.value.health_wellbeing_areas, ['physical_health', 'mental_emotional'])
  assert.equal(result.value.factor_health_impact, 0)
  assert.equal(result.value.personal_factor_answers.physical, 'prefer_not_to_say')

  const missingHealthAreas = validateProfile({ ...validPayload, health_wellbeing_areas: [] })
  assert.equal(missingHealthAreas.valid, false)

  const leakedHealthAreas = validateProfile({
    ...validPayload,
    personal_factor_answers: { ...validPayload.personal_factor_answers, health: 'prefer_not_to_say' },
    factor_health_impact: null,
    health_wellbeing_areas: ['mental_emotional'],
  })
  assert.equal(leakedHealthAreas.valid, false)
})

test('AI explanation guidance context and UI explanation exclude Prefer not to say and No impact factors', () => {
  const profile = {
    personal_factor_answers: {
      physical: 'prefer_not_to_say',
      health: 'yes',
      financial: 'yes',
      family: 'no',
      work: 'yes',
    },
    factor_physical_impact: null,
    factor_health_impact: 0,
    factor_financial_impact: 3,
    factor_family_impact: null,
    factor_work_impact: 2,
  }

  const guidance = buildPersonalFactorGuidanceContext(profile)
  assert.deepEqual(guidance.map(item => item.factor), ['financial', 'work'])

  const uiExplanation = getPersonalFactorExplanation(profile, [
    { course_code: 'BSCS', course_name: 'BS Computer Science', cluster_category: PARENT_CLUSTERS[0] },
  ])
  assert.deepEqual(uiExplanation.map(item => item.factor), ['financial', 'work'])

  assert.match(AI_EXPLANATION_INSTRUCTIONS, /Prefer not to say/i)
  assert.match(AI_EXPLANATION_INSTRUCTIONS, /No impact/i)
  assert.match(AI_EXPLANATION_INSTRUCTIONS, /clinical, medical, or diagnostic/i)
  assert.match(AI_EXPLANATION_INSTRUCTIONS, /supportive guidance/i)
  assert.match(AI_EXPLANATION_INSTRUCTIONS, /never as limitations, barriers, or course exclusions/i)
})
