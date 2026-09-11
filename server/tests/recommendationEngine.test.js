import test from 'node:test'
import assert from 'node:assert/strict'

import {
  CLUSTER_WSM_WEIGHTS,
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

test('one selected hindering personal factor produces a score of 0', () => {
  const score = calculatePersonalFactorScore(
    { factor_physical: true },
    'HEALTHCARE SCIENCE CLUSTER'
  )

  assert.equal(score, 0)
})

test('multiple selected personal factors are averaged before normalization', () => {
  const score = calculatePersonalFactorScore(
    { factor_physical: true, factor_health: true, factor_financial: true },
    'EDUCATION CLUSTER'
  )

  assert.ok(Math.abs(score - 1 / 6) < 1e-12)
})

test('no selected personal factors produces the neutral score of 0.5', () => {
  assert.equal(calculatePersonalFactorScore({}, 'BUSINESS CLUSTER'), 0.5)
})

test('factor_distance does not affect the personal factor score', () => {
  const baseline = calculatePersonalFactorScore({}, 'AVIATION & MARITIME CLUSTER')
  const withDistance = calculatePersonalFactorScore(
    { factor_distance: true },
    'AVIATION & MARITIME CLUSTER'
  )

  assert.equal(withDistance, baseline)
})

test('factor_others does not affect the personal factor score', () => {
  const baseline = calculatePersonalFactorScore({}, 'CRIMINOLOGY CLUSTER')
  const withOthers = calculatePersonalFactorScore(
    { factor_others: 'Custom circumstance' },
    'CRIMINOLOGY CLUSTER'
  )

  assert.equal(withOthers, baseline)
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

test('course ranking sorts by score descending and course_code ascending on ties', () => {
  const ranked = rankCourses([
    { course_code: 'CRS010', finalScore: 0.8 },
    { course_code: 'CRS002', finalScore: 0.8 },
    { course_code: 'CRS003', finalScore: 0.9 },
  ])

  assert.deepEqual(
    ranked.map(({ course_code, rankPosition }) => ({ course_code, rankPosition })),
    [
      { course_code: 'CRS003', rankPosition: 1 },
      { course_code: 'CRS002', rankPosition: 2 },
      { course_code: 'CRS010', rankPosition: 3 },
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
    { course_code: 'CRS021', finalScore: 0.7 },
    { course_code: 'CRS020', finalScore: 0.7 },
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
