import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import jwt from 'jsonwebtoken'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { ADMIN_JWT_AUDIENCE, USER_JWT_AUDIENCE, jwtSignOptions } from '../config/security.js'
import pool from '../config/db.js'
import authenticateAdmin from '../middleware/authenticateAdmin.js'
import { getAdminDashboard } from '../services/adminDashboardService.js'

function dashboardDatabase({
  summary = {}, registrations = [], courses = [], recentUsers = [],
} = {}) {
  const calls = []
  return {
    calls,
    query: async (sql, values) => {
      calls.push({ sql, values })
      if (sql.includes('AS registered_students')) return [[summary]]
      if (sql.includes("DATE_FORMAT(created_at, '%Y-%m')")) return [registrations]
      if (sql.includes('WITH ranked_recommendations')) return [courses]
      if (sql.includes('ORDER BY created_at DESC, user_id DESC')) return [recentUsers]
      throw new Error(`Unexpected SQL: ${sql}`)
    },
  }
}

test('summary uses student accounts and the existing complete-assessment definition', async () => {
  const database = dashboardDatabase({
    summary: {
      registered_students: '18', completed_assessments: '9',
      completed_with_personal_factors: '7',
    },
  })

  const result = await getAdminDashboard(database)
  assert.deepEqual(result.summary, {
    registeredStudents: 18,
    completedAssessments: 9,
    consideredPersonalFactors: 7,
    assessmentCompletionRate: 50,
  })

  const summarySql = database.calls.find(({ sql }) => sql.includes('AS registered_students')).sql
  assert.match(summarySql, /FROM USER_ACCOUNT account/)
  assert.doesNotMatch(summarySql, /FROM ADMIN|JOIN ADMIN/)
  assert.match(summarySql, /COALESCE\(profile_stats\.profile_count, 0\) >= 1/)
  assert.match(summarySql, /COALESCE\(interest_stats\.interest_count, 0\) >= 3/)
  assert.match(summarySql, /COALESCE\(skill_stats\.skill_count, 0\) >= 30/)
  assert.match(summarySql, /COALESCE\(personality_stats\.personality_count, 0\) >= 1/)
  assert.doesNotMatch(summarySql, /INSERT|UPDATE|DELETE|ALTER/i)
})

test('personal-factor count is limited to completed assessments and effective scoring categories', async () => {
  const database = dashboardDatabase()
  await getAdminDashboard(database)
  const sql = database.calls.find(({ sql: query }) => query.includes('AS registered_students')).sql

  assert.match(sql, /state\.status = 'Completed' AND COALESCE\(factors\.has_personal_factors, 0\) = 1/)
  for (const factor of ['physical', 'health', 'financial', 'family', 'working_student']) {
    assert.match(sql, new RegExp(`factor_${factor}`))
  }
  assert.match(sql, /factor_others_classification_status = 'MATCHED'/)
  assert.match(sql, /GROUP BY user_id/)
  assert.doesNotMatch(sql, /factor_distance/)
})

test('assessment completion rate is rounded and safely handles no registered students', async () => {
  const partial = await getAdminDashboard(dashboardDatabase({
    summary: { registered_students: '6', completed_assessments: '2' },
  }))
  assert.equal(partial.summary.assessmentCompletionRate, 33.3)

  const empty = await getAdminDashboard(dashboardDatabase())
  assert.equal(empty.summary.assessmentCompletionRate, 0)
  assert.equal(empty.summary.registeredStudents, 0)
})

test('registration trend is chronological, student-only, and fills missing months with zero', async () => {
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
  assert.match(registrationCall.sql, /FROM USER_ACCOUNT/)
  assert.doesNotMatch(registrationCall.sql, /ADMIN/)
  assert.deepEqual(registrationCall.values, ['2026-04-01 00:00:00', '2026-10-01 00:00:00'])
})

test('course metrics use individual courses from each student latest saved Top 3', async () => {
  const database = dashboardDatabase({
    courses: [
      { course_id: '2', course_code: 'BSIT', course_name: 'Information Technology', appearance_count: '9' },
      { course_id: '3', course_code: 'BSCS', course_name: 'Computer Science', appearance_count: '6' },
      { course_id: '4', course_code: 'BSA', course_name: 'Accountancy', appearance_count: '3' },
    ],
  })
  const result = await getAdminDashboard(database, { courseLimit: 2 })

  assert.deepEqual(result.coursePopularity, [
    { courseId: 2, courseCode: 'BSIT', courseName: 'Information Technology', count: 9 },
    { courseId: 3, courseCode: 'BSCS', courseName: 'Computer Science', count: 6 },
    { courseId: 4, courseCode: 'BSA', courseName: 'Accountancy', count: 3 },
  ])
  assert.deepEqual(result.topRecommendedCourses, result.coursePopularity)
  const courseCall = database.calls.find(({ sql }) => sql.includes('WITH ranked_recommendations'))
  assert.match(courseCall.sql, /PARTITION BY user_id/)
  assert.match(courseCall.sql, /snapshot_rank = 1/)
  assert.match(courseCall.sql, /rank_position BETWEEN 1 AND 3/)
  assert.match(courseCall.sql, /GROUP BY course\.course_id, course\.course_code, course\.course_name/)
  assert.doesNotMatch(courseCall.sql, /cluster_category/)
  assert.deepEqual(courseCall.values, [2])
})

test('recent users are student accounts in newest-first order without activity events', async () => {
  const database = dashboardDatabase({
    recentUsers: [
      { user_id: '8', username: 'new_student', created_at: '2026-09-18T03:00:00.000Z' },
    ],
  })
  const result = await getAdminDashboard(database, { recentUserLimit: 4 })

  assert.deepEqual(result.recentlyRegisteredUsers, [{
    userId: 8, username: 'new_student', registeredAt: '2026-09-18T03:00:00.000Z',
  }])
  const call = database.calls.find(({ sql }) => sql.includes('ORDER BY created_at DESC, user_id DESC'))
  assert.match(call.sql, /FROM USER_ACCOUNT/)
  assert.doesNotMatch(call.sql, /FEEDBACK|CHECKIN|ADMIN/)
  assert.deepEqual(call.values, [4])
})

test('empty dashboard data returns stable empty collections', async () => {
  const result = await getAdminDashboard(dashboardDatabase())
  assert.deepEqual(result.coursePopularity, [])
  assert.deepEqual(result.topRecommendedCourses, [])
  assert.deepEqual(result.recentlyRegisteredUsers, [])
  assert.equal(result.registrationTrend.length, 6)
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

test('dashboard route remains admin-only', async () => {
  const originalSecret = process.env.JWT_SECRET
  const originalQuery = pool.query
  process.env.JWT_SECRET = 'admin-dashboard-test-secret'
  pool.query = async () => [[{ admin_id: 1 }]]
  try {
    assert.equal((await runMiddleware({})).status, 401)
    const studentToken = jwt.sign({ userId: 14, username: 'student' }, process.env.JWT_SECRET, jwtSignOptions(USER_JWT_AUDIENCE, '10m'))
    assert.equal((await runMiddleware({ authorization: `Bearer ${studentToken}` })).status, 403)
    const adminToken = jwt.sign({ adminId: 1, role: 'admin' }, process.env.JWT_SECRET, jwtSignOptions(ADMIN_JWT_AUDIENCE, '10m'))
    assert.equal((await runMiddleware({ authorization: `Bearer ${adminToken}` })).status, 200)
  } finally {
    if (originalSecret === undefined) delete process.env.JWT_SECRET
    else process.env.JWT_SECRET = originalSecret
    pool.query = originalQuery
  }

  const testsDirectory = path.dirname(fileURLToPath(import.meta.url))
  const serverSource = fs.readFileSync(path.join(testsDirectory, '../server.js'), 'utf8')
  assert.match(serverSource, /app\.get\('\/api\/admin\/dashboard', authenticateAdmin/)
})
