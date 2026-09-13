import test from 'node:test'
import assert from 'node:assert/strict'

import { PARENT_CLUSTERS, SKILL_DOMAINS } from '../config/recommendationConfig.js'
import { calculateCourseScore, rankCourses } from '../services/recommendationEngine.js'
import {
  RecommendationInputError,
  buildClusterRiasecVector,
  buildStudentDomainScores,
  buildStudentRiasecVector,
  calculateClusterInterestScore,
  calculateClusterSkillScore,
  filterCoursesByCandidateClusters,
  rankClusters,
  scoreAndRankClusters,
  selectTopClusters,
  toDisplayPercent,
} from '../services/recommendationService.js'

test('canonical interest names produce the expected RIASEC totals', () => {
  const vector = buildStudentRiasecVector(['Drawing', 'Science Experiments'])

  assert.deepEqual(vector, { R: 0, I: 1, A: 1, S: 0, E: 0, C: 0 })
})

test('interest primary and secondary contributions accumulate as 1.0 and 0.5', () => {
  const vector = buildStudentRiasecVector([
    'Photography',
    'Building Gadgets',
  ])

  assert.deepEqual(vector, { R: 1.5, I: 0.5, A: 1, S: 0, E: 0, C: 0 })
})

test('unknown stored interests are rejected', () => {
  assert.throws(
    () => buildStudentRiasecVector(['Unmapped Interest']),
    RecommendationInputError
  )
})

test('display percentages are converted and rounded to two decimal places', () => {
  assert.equal(toDisplayPercent(0), 0)
  assert.equal(toDisplayPercent(0.123456), 12.35)
  assert.equal(toDisplayPercent(1), 100)
})

test('a complete latest skill assessment produces all six normalized domain scores', () => {
  const responses = SKILL_DOMAINS.flatMap((dimension) => (
    Array.from({ length: 5 }, (_, index) => ({
      dimension,
      is_correct: index < 3 ? 1 : 0,
    }))
  ))

  assert.deepEqual(
    buildStudentDomainScores(responses),
    Object.fromEntries(SKILL_DOMAINS.map((domain) => [domain, 0.6]))
  )
})

test('an incomplete latest skill assessment is rejected', () => {
  assert.throws(
    () => buildStudentDomainScores([
      { dimension: 'Verbal', is_correct: 1 },
    ]),
    RecommendationInputError
  )
})

const completeStudentScores = Object.freeze({
  Verbal: 0.6,
  Numerical: 0.8,
  'Abstract/Logical': 0.7,
  Spatial: 0.9,
  'Scientific Reasoning': 0.5,
  'Practical/Applied': 0.4,
})

const clusterScoringInput = Object.freeze({
  studentDomainScores: completeStudentScores,
  studentRiasecVector: Object.freeze({ R: 2, I: 1, A: 0, S: 1, E: 0, C: 0.5 }),
  mbtiType: 'ISTP',
  profileFactors: Object.freeze({}),
})

test('cluster skill score averages only the configured cluster domains', () => {
  const score = calculateClusterSkillScore(
    completeStudentScores,
    'ENGINEERING / STEM CLUSTER'
  )

  assert.ok(Math.abs(score - 0.8) < 1e-12)
})

test('cluster RIASEC vector uses ones for its two configured codes', () => {
  assert.deepEqual(
    buildClusterRiasecVector('ENGINEERING / STEM CLUSTER'),
    { R: 1, I: 1, A: 0, S: 0, E: 0, C: 0 }
  )
})

test('cluster interest score uses cosine similarity', () => {
  const studentVector = { R: 2, I: 2, A: 0, S: 0, E: 0, C: 0 }

  assert.ok(
    Math.abs(
      calculateClusterInterestScore(studentVector, 'ENGINEERING / STEM CLUSTER') - 1
    ) < 1e-12
  )
})

test('all 13 official parent clusters are scored', () => {
  const ranking = scoreAndRankClusters(clusterScoringInput)

  assert.equal(ranking.length, 13)
  assert.deepEqual(
    new Set(ranking.map((cluster) => cluster.cluster_category)),
    new Set(PARENT_CLUSTERS)
  )
})

test('cluster ranking is deterministic', () => {
  assert.deepEqual(
    scoreAndRankClusters(clusterScoringInput),
    scoreAndRankClusters(clusterScoringInput)
  )
})

test('cluster ranking resolves exact score ties by cluster name ascending', () => {
  const ranking = rankClusters([
    { cluster_category: 'EDUCATION CLUSTER', clusterScore: 0.5 },
    { cluster_category: 'BUSINESS CLUSTER', clusterScore: 0.5 },
  ])

  assert.deepEqual(
    ranking.map((cluster) => cluster.cluster_category),
    ['BUSINESS CLUSTER', 'EDUCATION CLUSTER']
  )
})

test('candidate-cluster selection returns only the top 3 ranked clusters', () => {
  const ranking = rankClusters([
    { cluster_category: 'BUSINESS CLUSTER', clusterScore: 0.7 },
    { cluster_category: 'EDUCATION CLUSTER', clusterScore: 0.9 },
    { cluster_category: 'ARTS & MULTIMEDIA CLUSTER', clusterScore: 0.8 },
    { cluster_category: 'CRIMINOLOGY CLUSTER', clusterScore: 0.6 },
  ])

  assert.deepEqual(
    selectTopClusters(ranking).map((cluster) => cluster.cluster_category),
    ['EDUCATION CLUSTER', 'ARTS & MULTIMEDIA CLUSTER', 'BUSINESS CLUSTER']
  )
})

test('only courses in the top 3 clusters proceed as candidate courses', () => {
  const candidateClusters = [
    { cluster_category: 'EDUCATION CLUSTER' },
    { cluster_category: 'ARTS & MULTIMEDIA CLUSTER' },
    { cluster_category: 'BUSINESS CLUSTER' },
  ]
  const courses = [
    { course_code: 'CRS001', cluster_category: 'BUSINESS CLUSTER' },
    { course_code: 'CRS002', cluster_category: 'CRIMINOLOGY CLUSTER' },
    { course_code: 'CRS003', cluster_category: 'EDUCATION CLUSTER' },
  ]

  assert.deepEqual(
    filterCoursesByCandidateClusters(courses, candidateClusters).map(
      (course) => course.course_code
    ),
    ['CRS001', 'CRS003']
  )
})

test('candidate courses retain deterministic course-level scoring and ranking', () => {
  const courses = [
    {
      course_code: 'CRS010',
      finalScore: calculateCourseScore({
        courseSkillMatch: 0.8,
        courseInterestMatch: 0.6,
        parentClusterPersonalityScore: 1,
        parentClusterPersonalFactorScore: 0.5,
        parentCluster: 'BUSINESS CLUSTER',
      }),
    },
    {
      course_code: 'CRS002',
      finalScore: calculateCourseScore({
        courseSkillMatch: 0.9,
        courseInterestMatch: 0.8,
        parentClusterPersonalityScore: 1,
        parentClusterPersonalFactorScore: 0.5,
        parentCluster: 'BUSINESS CLUSTER',
      }),
    },
  ]

  assert.deepEqual(
    rankCourses(courses).map((course) => course.course_code),
    ['CRS002', 'CRS010']
  )
})

test('the same student inputs produce the same cluster and course rankings', () => {
  const createRankings = () => {
    const clusters = scoreAndRankClusters(clusterScoringInput)
    const candidates = selectTopClusters(clusters)
    const courses = rankCourses(candidates.map((cluster, index) => ({
      course_code: `CRS00${index + 1}`,
      cluster_category: cluster.cluster_category,
      finalScore: calculateCourseScore({
        courseSkillMatch: 0.75,
        courseInterestMatch: 0.5,
        parentClusterPersonalityScore: cluster.personalityScore,
        parentClusterPersonalFactorScore: cluster.personalFactorScore,
        parentCluster: cluster.cluster_category,
      }),
    })))

    return { clusters, courses }
  }

  assert.deepEqual(createRankings(), createRankings())
})
