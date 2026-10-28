import test from 'node:test'
import assert from 'node:assert/strict'
import { getPersonalFactorExplanation } from '../../../shared/personalFactorExplanation.js'

test('explains field-specific factors using the scoring relevance rules', () => {
  const factors = getPersonalFactorExplanation({
    personal_factor_answers: { health: 'yes', family: 'yes' },
    factor_health_impact: 2, factor_family_impact: 3,
  }, [
    { course_code: 'A', course_name: 'Public Administration', cluster_category: 'LEGAL & PUBLIC SERVICE CLUSTER' },
    { course_code: 'B', course_name: 'Nursing', cluster_category: 'HEALTHCARE SCIENCE CLUSTER' },
  ])
  assert.deepEqual(factors.map(factor => [factor.factor, factor.impact]), [['health', 2], ['family', 3]])
  assert.deepEqual(factors[0].courses.map(course => course.applied), [0, 1])
  assert.deepEqual(factors[1].courses.map(course => course.applied), [1, 1])
})

test('undisclosed answers and No responses do not appear as reported impacts', () => {
  assert.deepEqual(getPersonalFactorExplanation({
    personal_factor_answers: { health: 'unknown', family: 'no', work: 'legacy_unknown' },
    factor_health_impact: 4, factor_family_impact: 3, factor_work_impact: 4,
  }), [])
  assert.deepEqual(getPersonalFactorExplanation(), [])
})

test('missing cluster metadata is shown as unknown instead of inventing relevance', () => {
  const [factor] = getPersonalFactorExplanation({ factor_health_impact: 2 }, [{ course_code: 'A' }])
  assert.equal(factor.courses[0].applied, null)
})

test('an explicitly disclosed impact of 1 remains visible without treating No as an impact', () => {
  const factors = getPersonalFactorExplanation({
    personal_factor_answers: { health: 'yes', family: 'no' },
    factor_health_impact: 1,
  })
  assert.deepEqual(factors.map(factor => [factor.factor, factor.impact]), [['health', 1]])
})
