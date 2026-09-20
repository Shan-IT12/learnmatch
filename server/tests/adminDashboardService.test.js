import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import jwt from 'jsonwebtoken'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import authenticateAdmin from '../middleware/authenticateAdmin.js'
import { getAdminDashboard } from '../services/adminDashboardService.js'

function dashboardDatabase({
  summary = {},
  registrations = [],
  alignment = [],
  clusters = [],
  activity = [],
} = {}) {
  const calls = []
  return {
    calls,
    query: async (sql, values) => {
      calls.push({ sql, values })
      if (sql.includes('AS total_users')) return [[summary]]
      if (sql.includes("DATE_FORMAT(created_at, '%Y-%m')")) return [registrations]
      if (sql.includes('GROUP BY status')) return [alignment]
      if (sql.includes('FROM RECOMMENDATION_ITEM')) return [clusters]
      if (sql.includes('activity_type')) return [activity]
      throw new Error(`Unexpected SQL: ${sql}`)
    },
  }
}

test('dashboard summary returns actual counts and counts flagged students once from their latest completed status', async () => {
  const database = dashboardDatabase({
    summary: {
      total_users: '18',
      active_courses: '312',
      tracking_students: '7',
      flagged_students: '3',
      total_feedback: '9',
    },
  })

  const result = await getAdminDashboard(database, { now: new Date('2026-09-20T00:00:00Z') })
  assert.deepEqual(result.summary, {
    totalUsers: 18,
    activeCourses: 312,
    trackingStudents: 7,
    flaggedStudents: 3,
    totalFeedback: 9,
  })

  const summarySql = database.calls.find(({ sql }) => sql.includes('AS total_users')).sql
  assert.match(summarySql, /SELECT user_id FROM COLLEGE_TERM\s+UNION\s+SELECT user_id FROM SEMESTER_CHECKIN/)
  assert.match(summarySql, /ROW_NUMBER\(\) OVER \(\s+PARTITION BY sc\.user_id/)
  assert.match(summarySql, /latest_rank = 1 AND status IN \('Monitor', 'Needs Attention'\)/)
  assert.doesNotMatch(summarySql, /INSERT|UPDATE|DELETE|ALTER/i)
})

test('alignment distribution uses one latest completed check-in per student and safely includes zero statuses', async () => {
  const database = dashboardDatabase({
    alignment: [
      { status: 'On Track', student_count: '4' },
      { status: 'Needs Attention', student_count: '1' },
    ],
  })

  const result = await getAdminDashboard(database)
  assert.deepEqual(result.alignmentDistribution, [
    { status: 'On Track', count: 4 },
    { status: 'Monitor', count: 0 },
    { status: 'Needs Attention', count: 1 },
  ])

  const alignmentSql = database.calls.find(({ sql }) => sql.includes('GROUP BY status')).sql
  assert.match(alignmentSql, /JOIN AI_MISMATCH_ANALYSIS/)
  assert.match(alignmentSql, /latest_rank = 1/)

  const empty = await getAdminDashboard(dashboardDatabase())
  assert.equal(empty.alignmentDistribution.reduce((sum, item) => sum + item.count, 0), 0)
})

test('registration trend is chronological, includes all six months, and fills missing months with zero', async () => {
  const database = dashboardDatabase({
    registrations: [
      { month_key: '2026-05', registration_count: '2' },
      { month_key: '2026-09', registration_count: '5' },
    ],
  })
  const result = await getAdminDashboard(database, { now: new Date('2026-09-20T12:00:00Z') })

  assert.deepEqual(result.registrationTrend.map(({ key }) => key), [
    '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09',
  ])
  assert.deepEqual(result.registrationTrend.map(({ count }) => count), [0, 2, 0, 0, 0, 5])
  const registrationCall = database.calls.find(({ sql }) => sql.includes('DATE_FORMAT'))
  assert.deepEqual(registrationCall.values, ['2026-04-01 00:00:00', '2026-10-01 00:00:00'])
})

test('recommended cluster appearances use canonical course clusters, descending Top N, and handle empty data', async () => {
  const database = dashboardDatabase({
    clusters: [
      { cluster_category: 'Education Cluster', appearance_count: '4' },
      { cluster_category: 'Business Cluster', appearance_count: '9' },
      { cluster_category: 'Engineering/STEM Cluster', appearance_count: '7' },
    ],
  })
  const result = await getAdminDashboard(database, { clusterLimit: 2 })
  assert.deepEqual(result.recommendedClusters, [
    { cluster: 'Business Cluster', count: 9 },
    { cluster: 'Engineering/STEM Cluster', count: 7 },
  ])
  const clusterSql = database.calls.find(({ sql }) => sql.includes('FROM RECOMMENDATION_ITEM')).sql
  assert.match(clusterSql, /JOIN COURSE c ON c\.course_id = item\.course_id/)
  assert.match(clusterSql, /GROUP BY c\.cluster_category/)

  const empty = await getAdminDashboard(dashboardDatabase())
  assert.deepEqual(empty.recommendedClusters, [])
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

test('dashboard route requires admin authentication; missing and student tokens are rejected', async () => {
  const originalSecret = process.env.JWT_SECRET
  process.env.JWT_SECRET = 'admin-dashboard-test-secret'
  try {
    assert.equal((await runMiddleware({})).status, 401)
    const studentToken = jwt.sign({ userId: 14, username: 'student' }, process.env.JWT_SECRET)
    assert.equal((await runMiddleware({ authorization: `Bearer ${studentToken}` })).status, 403)
    const adminToken = jwt.sign({ adminId: 1, role: 'admin' }, process.env.JWT_SECRET)
    assert.equal((await runMiddleware({ authorization: `Bearer ${adminToken}` })).status, 200)
  } finally {
    if (originalSecret === undefined) delete process.env.JWT_SECRET
    else process.env.JWT_SECRET = originalSecret
  }

  const testsDirectory = path.dirname(fileURLToPath(import.meta.url))
  const serverSource = fs.readFileSync(path.join(testsDirectory, '../server.js'), 'utf8')
  assert.match(serverSource, /app\.get\('\/api\/admin\/dashboard', authenticateAdmin/)
})
