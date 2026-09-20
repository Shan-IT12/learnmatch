import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import jwt from 'jsonwebtoken'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { SKILL_DOMAINS } from '../config/recommendationConfig.js'
import authenticateAdmin from '../middleware/authenticateAdmin.js'
import { getAdminAnalytics } from '../services/adminAnalyticsService.js'
import { getAssessmentStatus } from '../services/assessmentCompletionService.js'

function analyticsDatabase({
  completionRows = [{
    total_users: 8,
    completed: 3,
    in_progress: 4,
    not_started: 1,
    recommendations_generated: 2,
  }],
  skillRows = SKILL_DOMAINS.map((dimension, index) => ({
    dimension,
    average_score: String(50 + index * 5),
    student_count: '3',
  })),
  personalityRows = [
    { mbti_type: 'INTJ', student_count: '2' },
    { mbti_type: 'ENFP', student_count: '1' },
  ],
  courseRows = [
    { course_id: 4, course_code: 'BSIT', course_name: 'Information Technology', appearance_count: '3' },
    { course_id: 7, course_code: 'BSN', course_name: 'Nursing', appearance_count: '2' },
  ],
} = {}) {
  const calls = []
  return {
    calls,
    query: async (sql) => {
      calls.push(sql)
      if (sql.includes('assessment_states')) return [completionRows]
      if (sql.includes('ranked_skill_responses')) return [skillRows]
      if (sql.includes('ranked_personality')) return [personalityRows]
      if (sql.includes('ranked_recommendations')) return [courseRows]
      throw new Error(`Unexpected SQL: ${sql}`)
    },
  }
}

test('analytics summary and assessment completion use one mutually exclusive state per student', async () => {
  const database = analyticsDatabase()
  const result = await getAdminAnalytics(database)

  assert.deepEqual(result.summary, {
    totalUsers: 8,
    completedAssessments: 3,
    assessmentCompletionRate: 37.5,
    recommendationsGenerated: 2,
  })
  assert.deepEqual(result.assessmentCompletion, {
    completed: 3,
    inProgress: 4,
    notStarted: 1,
  })
  assert.equal(Object.values(result.assessmentCompletion).reduce((sum, count) => sum + count, 0), 8)

  assert.equal(getAssessmentStatus({
    profileCount: 1, interestCount: 3, skillCount: 30, personalityCount: 1,
  }), 'Completed')
  assert.equal(getAssessmentStatus({
    profileCount: 1, interestCount: 0, skillCount: 0, personalityCount: 0,
  }), 'In Progress')
  assert.equal(getAssessmentStatus({}), 'Not Started')

  const sql = database.calls.find((query) => query.includes('assessment_states'))
  assert.match(sql, /profile_stats\.profile_count[^]*>= 1/)
  assert.match(sql, /interest_stats\.interest_count[^]*>= 3/)
  assert.match(sql, /skill_stats\.skill_count[^]*>= 30/)
  assert.match(sql, /personality_stats\.personality_count[^]*>= 1/)
  assert.match(sql, /COUNT\(DISTINCT recommendation\.user_id\)/)
  assert.match(sql, /JOIN RECOMMENDATION_ITEM item/)
})

test('average skills contain the six canonical domains on the existing percentage scale', async () => {
  const database = analyticsDatabase()
  const result = await getAdminAnalytics(database)

  assert.deepEqual(result.averageSkillScores.map(({ domain }) => domain), SKILL_DOMAINS)
  assert.deepEqual(result.averageSkillScores[0], {
    domain: 'Verbal', averagePercent: 50, studentCount: 3,
  })

  const sql = database.calls.find((query) => query.includes('ranked_skill_responses'))
  assert.match(sql, /ROW_NUMBER\(\) OVER/)
  assert.match(sql, /response_rank <= 30/)
  assert.match(sql, /HAVING COUNT\(\*\) = 30/)
  assert.match(sql, /COUNT\(DISTINCT dimension\) = 6/)
  for (const domain of SKILL_DOMAINS) {
    assert.match(sql, new RegExp(`SUM\\(dimension = '${domain.replace('/', '\\/')}'\\) = 5`))
  }
  assert.match(sql, /SUM\(response\.is_correct\) \/ COUNT\(\*\) \* 100/)
})

test('personality distribution counts only each student latest valid stored MBTI result', async () => {
  const database = analyticsDatabase()
  const result = await getAdminAnalytics(database)

  assert.deepEqual(result.personalityDistribution, [
    { type: 'INTJ', count: 2 },
    { type: 'ENFP', count: 1 },
  ])
  const sql = database.calls.find((query) => query.includes('ranked_personality'))
  assert.match(sql, /PARTITION BY user_id/)
  assert.match(sql, /ORDER BY taken_at DESC, assessment_id DESC/)
  assert.match(sql, /WHERE result_rank = 1/)
  assert.match(sql, /WHERE mbti_type IN \('ISTJ'/)
})

test('top courses count only latest persisted Top 3 snapshot per student and return Top 5', async () => {
  const database = analyticsDatabase()
  const result = await getAdminAnalytics(database)

  assert.deepEqual(result.topRecommendedCourses, [
    { courseId: 4, courseCode: 'BSIT', courseName: 'Information Technology', count: 3 },
    { courseId: 7, courseCode: 'BSN', courseName: 'Nursing', count: 2 },
  ])
  const sql = database.calls.find((query) => query.includes('ranked_recommendations'))
  assert.match(sql, /PARTITION BY user_id/)
  assert.match(sql, /ORDER BY generated_at DESC, recommendation_id DESC/)
  assert.match(sql, /item\.rank_position BETWEEN 1 AND 3/)
  assert.match(sql, /recommendation\.snapshot_rank = 1/)
  assert.match(sql, /JOIN COURSE course ON course\.course_id = item\.course_id/)
  assert.match(sql, /ORDER BY appearance_count DESC, course\.course_name ASC/)
  assert.match(sql, /LIMIT 5/)
})

test('analytics returns safe empty collections and zero completion rate when no data exists', async () => {
  const result = await getAdminAnalytics(analyticsDatabase({
    completionRows: [{
      total_users: 0,
      completed: 0,
      in_progress: 0,
      not_started: 0,
      recommendations_generated: 0,
    }],
    skillRows: [],
    personalityRows: [],
    courseRows: [],
  }))

  assert.equal(result.summary.assessmentCompletionRate, 0)
  assert.deepEqual(result.averageSkillScores, [])
  assert.deepEqual(result.personalityDistribution, [])
  assert.deepEqual(result.topRecommendedCourses, [])
})

function runMiddleware(headers) {
  return new Promise((resolve) => {
    const response = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this },
      json(body) { resolve({ status: this.statusCode, body }) },
    }
    authenticateAdmin({ headers }, response, () => resolve({ status: 200, next: true }))
  })
}

test('analytics route rejects missing and student tokens and allows admin tokens', async () => {
  const originalSecret = process.env.JWT_SECRET
  process.env.JWT_SECRET = 'admin-analytics-test-secret'
  try {
    assert.equal((await runMiddleware({})).status, 401)
    const studentToken = jwt.sign({ userId: 17 }, process.env.JWT_SECRET)
    assert.equal((await runMiddleware({ authorization: `Bearer ${studentToken}` })).status, 403)
    const adminToken = jwt.sign({ adminId: 1, role: 'admin' }, process.env.JWT_SECRET)
    assert.equal((await runMiddleware({ authorization: `Bearer ${adminToken}` })).status, 200)
  } finally {
    if (originalSecret === undefined) delete process.env.JWT_SECRET
    else process.env.JWT_SECRET = originalSecret
  }

  const testsDirectory = path.dirname(fileURLToPath(import.meta.url))
  const serverSource = fs.readFileSync(path.join(testsDirectory, '../server.js'), 'utf8')
  assert.match(serverSource, /app\.get\('\/api\/admin\/analytics', authenticateAdmin/)
})

test('analytics service contains only read queries and returns no private response fields', async () => {
  const database = analyticsDatabase()
  const result = await getAdminAnalytics(database)

  assert.ok(database.calls.every((sql) => /^\s*WITH\b/i.test(sql)))
  assert.ok(database.calls.every((sql) => !/\b(INSERT|UPDATE|DELETE|ALTER|DROP|TRUNCATE|CREATE)\b/i.test(sql)))
  assert.doesNotMatch(
    JSON.stringify(result).toLowerCase(),
    /password|otp|token|selected_option|factor_physical|height_cm|ai_narrative|prompt/
  )
})
