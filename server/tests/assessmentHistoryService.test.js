import test from 'node:test'
import assert from 'node:assert/strict'

import {
  getAssessmentHistory,
  getAssessmentHistoryDetail,
} from '../services/assessmentHistoryService.js'

function itemRows({
  recommendationId,
  assessmentId,
  generatedAt,
  mbti = 'INTJ',
  startCourseId = 1,
  itemCount = 3,
}) {
  return Array.from({ length: itemCount }, (_, index) => ({
    recommendation_id: recommendationId,
    assessment_id: assessmentId,
    generated_at: generatedAt,
    mbti_type: mbti,
    score_ei: 60,
    score_ns: 70,
    score_tf: 55,
    score_jp: 65,
    rank_position: index + 1,
    match_score: 0.9 - index * 0.05,
    skill_match: 0.8,
    interest_match: 0.75,
    personality_match: 0.7,
    personal_factor_match: 0.65,
    ai_narrative: `Saved explanation ${index + 1}`,
    course_id: startCourseId + index,
    course_code: `CRS${String(startCourseId + index).padStart(3, '0')}`,
    course_name: `Course ${startCourseId + index}`,
    course_abbreviation: null,
    cluster_category: 'SCIENCE CLUSTER',
  }))
}

function databaseForUsers(rowsByUser) {
  const calls = []
  return {
    calls,
    query: async (sql, values) => {
      calls.push({ sql, values })
      return [rowsByUser.get(values[0]) ?? []]
    },
  }
}

test('student with no completed recommendation snapshots receives empty history', async () => {
  const database = databaseForUsers(new Map())
  assert.deepEqual(await getAssessmentHistory(database, 7), [])
})

test('one completed snapshot is numbered from completed recommendations and includes three items', async () => {
  const database = databaseForUsers(new Map([[7, itemRows({
    recommendationId: 10,
    assessmentId: 20,
    generatedAt: new Date('2026-01-01T00:00:00Z'),
  })]]))
  const history = await getAssessmentHistory(database, 7)
  assert.equal(history.length, 1)
  assert.equal(history[0].attempt_number, 1)
  assert.equal(history[0].mbti.type, 'INTJ')
  assert.equal(history[0].recommendations.length, 3)
  assert.equal(history[0].recommendations[0].match_score, 90)
})

test('multiple retakes are returned newest first with stable chronological attempt numbers', async () => {
  const rows = [
    ...itemRows({ recommendationId: 10, assessmentId: 20, generatedAt: new Date('2026-01-01'), startCourseId: 1 }),
    ...itemRows({ recommendationId: 11, assessmentId: 21, generatedAt: new Date('2026-02-01'), startCourseId: 4 }),
    ...itemRows({ recommendationId: 12, assessmentId: 22, generatedAt: new Date('2026-03-01'), startCourseId: 7 }),
  ]
  const history = await getAssessmentHistory(databaseForUsers(new Map([[7, rows]])), 7)
  assert.deepEqual(history.map(({ recommendation_id }) => recommendation_id), [12, 11, 10])
  assert.deepEqual(history.map(({ attempt_number }) => attempt_number), [3, 2, 1])
})

test('equal timestamps retain deterministic recommendation-id ordering', async () => {
  const timestamp = new Date('2026-03-01')
  const rows = [
    ...itemRows({ recommendationId: 10, assessmentId: 20, generatedAt: timestamp, startCourseId: 1 }),
    ...itemRows({ recommendationId: 11, assessmentId: 21, generatedAt: timestamp, startCourseId: 4 }),
  ]
  const history = await getAssessmentHistory(databaseForUsers(new Map([[7, rows]])), 7)
  assert.deepEqual(history.map(({ recommendation_id }) => recommendation_id), [11, 10])
  assert.deepEqual(history.map(({ attempt_number }) => attempt_number), [2, 1])
})

test('query excludes personality-only attempts and requires exactly valid ranks 1 through 3', async () => {
  const database = databaseForUsers(new Map([[7, itemRows({
    recommendationId: 10,
    assessmentId: 20,
    generatedAt: new Date('2026-01-01'),
    itemCount: 2,
  })]]))
  assert.deepEqual(await getAssessmentHistory(database, 7), [])
  assert.match(database.calls[0].sql, /HAVING COUNT\(\*\) = 3/)
  assert.match(database.calls[0].sql, /COUNT\(DISTINCT rank_position\) = 3/)
  assert.match(database.calls[0].sql, /SUM\(rank_position\) = 6/)
})

test('detail is scoped to authenticated ownership and rejects another user recommendation', async () => {
  const database = databaseForUsers(new Map([[7, itemRows({
    recommendationId: 10,
    assessmentId: 20,
    generatedAt: new Date('2026-01-01'),
  })]]))
  assert.equal((await getAssessmentHistoryDetail(database, 7, 10)).recommendation_id, 10)
  assert.equal(await getAssessmentHistoryDetail(database, 8, 10), null)
  assert.deepEqual(database.calls.map(({ values }) => values), [[7], [8]])
})

test('inactive historical courses are not filtered and history performs read-only queries only', async () => {
  const database = databaseForUsers(new Map([[7, itemRows({
    recommendationId: 10,
    assessmentId: 20,
    generatedAt: new Date('2026-01-01'),
  })]]))
  const result = await getAssessmentHistoryDetail(database, 7, 10)
  assert.equal(result.recommendations.length, 3)
  assert.doesNotMatch(database.calls[0].sql, /c\.is_active/)
  assert.ok(database.calls.every(({ sql }) => /^\s*SELECT/i.test(sql)))
  assert.ok(database.calls.every(({ sql }) => !/getOrCreate|INSERT|UPDATE|DELETE/i.test(sql)))
})

test('invalid recommendation identifiers return not found without touching the database', async () => {
  const database = databaseForUsers(new Map())
  assert.equal(await getAssessmentHistoryDetail(database, 7, 'invalid'), null)
  assert.equal(database.calls.length, 0)
})

