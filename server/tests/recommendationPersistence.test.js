import test from 'node:test'
import assert from 'node:assert/strict'

import { RecommendationDataError } from '../services/recommendationService.js'
import {
  getLatestSavedRecommendations,
  getOrCreateSavedRecommendations,
  getSavedRecommendationForAssessment,
  saveRecommendationSnapshot,
  validateTopThreeRecommendations,
} from '../services/recommendationPersistenceService.js'

const generatedRecommendations = [
  {
    rank_position: 1,
    course_id: 10,
    course_code: 'CRS001',
    course_name: 'Course One',
    course_abbreviation: 'C1',
    cluster_category: 'BUSINESS CLUSTER',
    match_score: 91.25,
    score_breakdown: {
      skill_match: 90,
      interest_match: 80,
      personality_match: 100,
      personal_factor_match: 50,
    },
    ai_narrative: null,
  },
  {
    rank_position: 2,
    course_id: 20,
    course_code: 'CRS002',
    course_name: 'Course Two',
    course_abbreviation: 'C2',
    cluster_category: 'EDUCATION CLUSTER',
    match_score: 82.5,
    score_breakdown: {
      skill_match: 70,
      interest_match: 75,
      personality_match: 100,
      personal_factor_match: 50,
    },
    ai_narrative: null,
  },
  {
    rank_position: 3,
    course_id: 30,
    course_code: 'CRS003',
    course_name: 'Course Three',
    course_abbreviation: 'C3',
    cluster_category: 'ARTS & MULTIMEDIA CLUSTER',
    match_score: 78,
    score_breakdown: {
      skill_match: 65,
      interest_match: 70,
      personality_match: 100,
      personal_factor_match: 50,
    },
    ai_narrative: null,
  },
]

const savedRows = generatedRecommendations.map((recommendation) => ({
  rank_position: recommendation.rank_position,
  course_id: recommendation.course_id,
  course_code: recommendation.course_code,
  course_name: recommendation.course_name,
  course_abbreviation: recommendation.course_abbreviation,
  cluster_category: recommendation.cluster_category,
  match_score: recommendation.match_score / 100,
  skill_match: recommendation.score_breakdown.skill_match / 100,
  interest_match: recommendation.score_breakdown.interest_match / 100,
  personality_match: recommendation.score_breakdown.personality_match / 100,
  personal_factor_match: recommendation.score_breakdown.personal_factor_match / 100,
  ai_narrative: null,
}))

function createPersistencePool({ failItemInsert = false } = {}) {
  const state = {
    began: false,
    committed: false,
    rolledBack: false,
    released: false,
    itemValues: [],
  }
  let itemInsertCount = 0
  const connection = {
    beginTransaction: async () => { state.began = true },
    commit: async () => { state.committed = true },
    rollback: async () => { state.rolledBack = true },
    release: () => { state.released = true },
    query: async (sql, values) => {
      if (sql.includes('FROM RECOMMENDATION') && !sql.includes('RECOMMENDATION_ITEM')) return [[]]
      if (sql.includes('FROM COURSE')) {
        return [[
          { course_id: 30, course_code: 'CRS003' },
          { course_id: 10, course_code: 'CRS001' },
          { course_id: 20, course_code: 'CRS002' },
        ]]
      }
      if (sql.includes('INSERT INTO RECOMMENDATION_ITEM')) {
        itemInsertCount += 1
        if (failItemInsert && itemInsertCount === 2) throw new Error('item insert failed')
        state.itemValues.push(values)
        return [{ insertId: itemInsertCount }]
      }
      if (sql.includes('INSERT INTO RECOMMENDATION')) return [{ insertId: 99 }]
      throw new Error(`Unexpected SQL: ${sql}`)
    },
  }
  return { pool: { getConnection: async () => connection }, state }
}

test('Top 3 persist in rank order and map stable course codes to canonical course IDs', async () => {
  const { pool, state } = createPersistencePool()
  const result = await saveRecommendationSnapshot(pool, 7, 11, [
    generatedRecommendations[2],
    generatedRecommendations[0],
    generatedRecommendations[1],
  ])

  assert.deepEqual(result, { created: true, recommendationId: 99 })
  assert.equal(state.began, true)
  assert.equal(state.committed, true)
  assert.equal(state.rolledBack, false)
  assert.equal(state.released, true)
  assert.deepEqual(state.itemValues.map((values) => ({
    courseId: values[1],
    matchScore: values[2],
    rank: values[7],
  })), [
    { courseId: 10, matchScore: 0.9125, rank: 1 },
    { courseId: 20, matchScore: 0.825, rank: 2 },
    { courseId: 30, matchScore: 0.78, rank: 3 },
  ])
})

test('snapshot validation rejects missing ranks and duplicate courses', () => {
  assert.throws(
    () => validateTopThreeRecommendations(generatedRecommendations.slice(0, 2)),
    RecommendationDataError
  )
  assert.throws(
    () => validateTopThreeRecommendations([
      generatedRecommendations[0],
      { ...generatedRecommendations[1], course_code: 'CRS001' },
      generatedRecommendations[2],
    ]),
    RecommendationDataError
  )
})

test('item insertion failure rolls back the entire snapshot transaction', async () => {
  const { pool, state } = createPersistencePool({ failItemInsert: true })

  await assert.rejects(
    saveRecommendationSnapshot(pool, 7, 11, generatedRecommendations),
    /item insert failed/
  )
  assert.equal(state.committed, false)
  assert.equal(state.rolledBack, true)
  assert.equal(state.released, true)
})

test('saved recommendation retrieval is scoped to the authenticated user', async () => {
  const requestedUsers = []
  const database = {
    query: async (sql, values) => {
      if (sql.includes('FROM RECOMMENDATION') && !sql.includes('RECOMMENDATION_ITEM')) {
        requestedUsers.push(values[0])
        return values[0] === 7
          ? [[{ recommendation_id: 99, assessment_id: 11, generated_at: new Date(0) }]]
          : [[]]
      }
      return [savedRows]
    },
  }

  const ownerResult = await getSavedRecommendationForAssessment(database, 7, 11)
  const otherUserResult = await getSavedRecommendationForAssessment(database, 8, 11)

  assert.deepEqual(requestedUsers, [7, 8])
  assert.equal(ownerResult.recommendations.length, 3)
  assert.equal(otherUserResult, null)
})

test('student without a saved recommendation receives a clean empty result', async () => {
  const database = { query: async () => [[]] }
  assert.deepEqual(
    await getLatestSavedRecommendations(database, 7),
    { recommendation: null, recommendations: [] }
  )
})

test('College retrieval is ordered, active-only, and does not invoke WSM', async () => {
  const calls = []
  const database = {
    query: async (sql, values) => {
      calls.push({ sql, values })
      if (!sql.includes('RECOMMENDATION_ITEM')) {
        return [[{ recommendation_id: 99, assessment_id: 11, generated_at: new Date(0) }]]
      }
      return [[savedRows[0], savedRows[2]]]
    },
  }

  const result = await getLatestSavedRecommendations(database, 7)
  assert.deepEqual(result.recommendations.map(({ rank_position }) => rank_position), [1, 3])
  assert.match(calls[1].sql, /c\.is_active = 1/)
  assert.match(calls[1].sql, /ORDER BY ri\.rank_position ASC/)
})

test('Results refresh reuses the saved snapshot without rerunning WSM or writing', async () => {
  let generatorCalls = 0
  let connectionRequests = 0
  const pool = {
    query: async (sql) => {
      if (sql.includes('FROM PERSONALITY_ASSESSMENT')) return [[{ assessment_id: 11 }]]
      if (sql.includes('FROM RECOMMENDATION') && !sql.includes('RECOMMENDATION_ITEM')) {
        return [[{ recommendation_id: 99, assessment_id: 11, generated_at: new Date(0) }]]
      }
      return [savedRows]
    },
    getConnection: async () => {
      connectionRequests += 1
      throw new Error('No write should occur')
    },
  }

  const result = await getOrCreateSavedRecommendations(pool, 7, async () => {
    generatorCalls += 1
    return generatedRecommendations
  })

  assert.equal(result.length, 3)
  assert.equal(generatorCalls, 0)
  assert.equal(connectionRequests, 0)
})

test('a duplicate concurrent insert reloads the snapshot instead of returning an error', async () => {
  let headerReads = 0
  const duplicateError = Object.assign(new Error('duplicate'), { code: 'ER_DUP_ENTRY' })
  const connection = {
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => {},
    release: () => {},
    query: async (sql) => {
      if (sql.includes('FROM RECOMMENDATION') && !sql.includes('RECOMMENDATION_ITEM')) return [[]]
      if (sql.includes('FROM COURSE')) {
        return [[
          { course_id: 10, course_code: 'CRS001' },
          { course_id: 20, course_code: 'CRS002' },
          { course_id: 30, course_code: 'CRS003' },
        ]]
      }
      if (sql.includes('INSERT INTO RECOMMENDATION')) throw duplicateError
      throw new Error(`Unexpected SQL: ${sql}`)
    },
  }
  const pool = {
    getConnection: async () => connection,
    query: async (sql) => {
      if (sql.includes('FROM PERSONALITY_ASSESSMENT')) return [[{ assessment_id: 11 }]]
      if (sql.includes('FROM RECOMMENDATION') && !sql.includes('RECOMMENDATION_ITEM')) {
        headerReads += 1
        return headerReads === 1
          ? [[]]
          : [[{ recommendation_id: 99, assessment_id: 11, generated_at: new Date(0) }]]
      }
      return [savedRows]
    },
  }

  const result = await getOrCreateSavedRecommendations(
    pool,
    7,
    async () => generatedRecommendations
  )
  assert.equal(result.length, 3)
  assert.equal(headerReads, 2)
})
