import test from 'node:test'
import assert from 'node:assert/strict'

import {
  CLUSTER_WSM_WEIGHTS,
  PERSONAL_FACTOR_RELEVANCE,
  PARENT_CLUSTERS,
  validateRecommendationConfig,
} from '../config/recommendationConfig.js'
import {
  calculateClusterScore,
  calculateCourseScore,
  calculateCourseSkillMatch,
  calculatePersonalFactorScore,
  calculatePersonalityScore,
  calculateRiasecCosineSimilarity,
  getMbtiRiasecPair,
  normalizePersonalFactorImpact,
  rankCourses,
} from '../services/recommendationEngine.js'

test('all 13 parent clusters have WSM weights that sum to 1', () => {
  assert.equal(PARENT_CLUSTERS.length, 13)
  assert.equal(validateRecommendationConfig(), true)

  for (const cluster of PARENT_CLUSTERS) {
    const sum = Object.values(CLUSTER_WSM_WEIGHTS[cluster]).reduce(
      (total, weight) => total + weight,
      0
    )
    assert.ok(Math.abs(sum - 1) < 1e-12, `${cluster} weights sum to ${sum}`)
  }
})

test('course skill match calculates a weighted normalized score', () => {
  const score = calculateCourseSkillMatch(
    { Verbal: 0.8, Numerical: 0.4, Spatial: 1 },
    [
      { skill_domain: 'Verbal', weight: 2 },
      { skill_domain: 'Numerical', weight: 3 },
      { skill_domain: 'Spatial', weight: 1 },
    ]
  )

  assert.ok(Math.abs(score - (0.8 * 2 + 0.4 * 3 + 1 * 1) / 6) < 1e-12)
})

test('omitted course skill domains are excluded from the denominator', () => {
  const score = calculateCourseSkillMatch(
    { Verbal: 1, Numerical: 0, Spatial: 0 },
    [{ skill: 'Verbal', weight: 3 }]
  )

  assert.equal(score, 1)
})

test('course skill match rejects non-integer course weights', () => {
  assert.throws(
    () => calculateCourseSkillMatch(
      { Verbal: 0.8 },
      [{ skill_domain: 'Verbal', weight: 1.5 }]
    ),
    RangeError
  )
})

test('RIASEC cosine similarity is 1 for identical vectors', () => {
  const vector = { R: 2, I: 1, A: 0, S: 3, E: 1, C: 2 }
  assert.ok(Math.abs(calculateRiasecCosineSimilarity(vector, vector) - 1) < 1e-12)
})

test('RIASEC cosine similarity returns 0 safely for a zero vector', () => {
  const zero = { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 }
  const course = { R: 1, I: 2, A: 3, S: 0, E: 0, C: 1 }

  assert.equal(calculateRiasecCosineSimilarity(zero, course), 0)
  assert.equal(calculateRiasecCosineSimilarity(course, zero), 0)
})

test('MBTI types resolve to their configured RIASEC pairs', () => {
  assert.deepEqual(getMbtiRiasecPair('ISTJ'), ['R', 'C'])
  assert.deepEqual(getMbtiRiasecPair('enfp'), ['A', 'S'])
  assert.deepEqual(getMbtiRiasecPair('ENTJ'), ['E', 'C'])
})

test('personality score is 1 when an MBTI RIASEC code overlaps the cluster', () => {
  assert.equal(calculatePersonalityScore('ISTP', 'ENGINEERING / STEM CLUSTER'), 1)
})

test('personality score is 0 when no MBTI RIASEC code overlaps the cluster', () => {
  assert.equal(calculatePersonalityScore('ISTJ', 'EDUCATION CLUSTER'), 0)
})

const noImpactResponses = Object.freeze({
  physical: 1,
  health: 1,
  financial: 1,
  family: 1,
  work: 1,
})

test('Personal Factor impact responses normalize from 1-4 to 0-1', () => {
  assert.equal(normalizePersonalFactorImpact(1), 0)
  assert.equal(normalizePersonalFactorImpact(2), 1 / 3)
  assert.equal(normalizePersonalFactorImpact(3), 2 / 3)
  assert.equal(normalizePersonalFactorImpact(4), 1)
})

test('Personal Factor normalization rejects missing and out-of-range responses', () => {
  for (const value of [undefined, null, 0, 5, 1.5, 'high']) {
    assert.throws(() => normalizePersonalFactorImpact(value), RangeError)
  }
})

test('all response-1 values produce the neutral 0.5 score in every cluster', () => {
  for (const cluster of PARENT_CLUSTERS) {
    assert.equal(calculatePersonalFactorScore(noImpactResponses, cluster), 0.5)
  }
})

test('the exact 13-by-5 relevance matrix is configured', () => {
  assert.deepEqual(PERSONAL_FACTOR_RELEVANCE, {
    'HEALTHCARE SCIENCE CLUSTER': { physical: 1, health: 1, financial: 1, family: 1, work: 1 },
    'HUMANITIES & SOCIAL SCIENCE CLUSTER': { physical: 0, health: 0, financial: 0, family: 1, work: 1 },
    'BUSINESS CLUSTER': { physical: 0, health: 0, financial: 0, family: 1, work: 1 },
    'HOSPITALITY & TOURISM CLUSTER': { physical: 1, health: 0, financial: 0, family: 1, work: 1 },
    'AVIATION & MARITIME CLUSTER': { physical: 1, health: 1, financial: 0, family: 1, work: 1 },
    'LEGAL & PUBLIC SERVICE CLUSTER': { physical: 0, health: 0, financial: 0, family: 1, work: 1 },
    'EDUCATION CLUSTER': { physical: 0, health: 0, financial: 0, family: 1, work: 1 },
    'ARTS & MULTIMEDIA CLUSTER': { physical: 1, health: 0, financial: 0, family: 1, work: 1 },
    'CRIMINOLOGY CLUSTER': { physical: 1, health: 1, financial: 1, family: 1, work: 1 },
    'AGRICULTURE & ENVIRONMENTAL CLUSTER': { physical: 1, health: 0, financial: 0, family: 1, work: 1 },
    'SCIENCE & MATHEMATICS CLUSTER': { physical: 0, health: 0, financial: 0, family: 0, work: 0 },
    'SPORTS & PHYSICAL EDUCATION CLUSTER': { physical: 1, health: 1, financial: 0, family: 1, work: 1 },
    'ENGINEERING / STEM CLUSTER': { physical: 1, health: 0, financial: 0, family: 1, work: 1 },
  })
})

test('only relevant factors reduce the cluster score', () => {
  const responses = { ...noImpactResponses, physical: 4 }
  assert.equal(calculatePersonalFactorScore(responses, 'HEALTHCARE SCIENCE CLUSTER'), 0.4)
  assert.equal(calculatePersonalFactorScore(responses, 'BUSINESS CLUSTER'), 0.5)
})

test('multiple relevant impacts accumulate with a floor of zero', () => {
  const maximumImpact = Object.fromEntries(Object.keys(noImpactResponses).map((key) => [key, 4]))
  assert.equal(calculatePersonalFactorScore(maximumImpact, 'HEALTHCARE SCIENCE CLUSTER'), 0)
  assert.equal(calculatePersonalFactorScore(maximumImpact, 'BUSINESS CLUSTER'), 0.3)
})

test('legacy profiles without structured responses use the neutral score', () => {
  assert.equal(calculatePersonalFactorScore(null, 'BUSINESS CLUSTER'), 0.5)
  assert.equal(calculatePersonalFactorScore(undefined, 'BUSINESS CLUSTER'), 0.5)
})

test('Other Context and legacy fields cannot change a complete structured score', () => {
  const baseline = calculatePersonalFactorScore(noImpactResponses, 'CRIMINOLOGY CLUSTER')
  assert.equal(calculatePersonalFactorScore({
    ...noImpactResponses,
    factor_others: 'Private circumstances',
    factor_health: true,
    factor_others_classification_status: 'MATCHED',
  }, 'CRIMINOLOGY CLUSTER'), baseline)
})

test('cluster score applies the configured deterministic WSM weights', () => {
  const score = calculateClusterScore(
    {
      skillScore: 0.8,
      interestScore: 0.6,
      personalityScore: 1,
      personalFactorScore: 0.5,
    },
    'BUSINESS CLUSTER'
  )

  assert.ok(Math.abs(score - 0.78) < 1e-12)
})

test('course score applies course components and inherited cluster components', () => {
  const score = calculateCourseScore({
    courseSkillMatch: 0.8,
    courseInterestMatch: 0.5,
    parentClusterPersonalityScore: 1,
    parentClusterPersonalFactorScore: 0.5,
    parentCluster: 'ENGINEERING / STEM CLUSTER',
  })

  assert.ok(Math.abs(score - 0.715) < 1e-12)
})

test('equal final course scores use course-level matches before stable course_id', () => {
  const ranked = rankCourses([
    { course_id: 10, course_code: 'CRS010', finalScore: 0.8, scoreBreakdown: { skillMatch: 0.7, interestMatch: 0.9 } },
    { course_id: 2, course_code: 'CRS002', finalScore: 0.8, scoreBreakdown: { skillMatch: 0.8, interestMatch: 0.5 } },
    { course_id: 3, course_code: 'CRS003', finalScore: 0.9, scoreBreakdown: { skillMatch: 0.5, interestMatch: 0.5 } },
    { course_id: 1, course_code: 'CRS001', finalScore: 0.8, scoreBreakdown: { skillMatch: 0.8, interestMatch: 0.5 } },
  ])

  assert.deepEqual(
    ranked.map(({ course_code, rankPosition }) => ({ course_code, rankPosition })),
    [
      { course_code: 'CRS003', rankPosition: 1 },
      { course_code: 'CRS001', rankPosition: 2 },
      { course_code: 'CRS002', rankPosition: 3 },
      { course_code: 'CRS010', rankPosition: 4 },
    ]
  )
})

test('the same inputs always produce the same score and ranking', () => {
  const scoreInput = {
    courseSkillMatch: 0.75,
    courseInterestMatch: 0.25,
    parentClusterPersonalityScore: 1,
    parentClusterPersonalFactorScore: 0.5,
    parentCluster: 'SCIENCE & MATHEMATICS CLUSTER',
  }
  const courses = [
    { course_id: 21, course_code: 'CRS021', finalScore: 0.7 },
    { course_id: 20, course_code: 'CRS020', finalScore: 0.7 },
  ]

  const first = {
    score: calculateCourseScore(scoreInput),
    ranked: rankCourses(courses),
  }
  const second = {
    score: calculateCourseScore(scoreInput),
    ranked: rankCourses(courses),
  }

  assert.deepEqual(second, first)
})
