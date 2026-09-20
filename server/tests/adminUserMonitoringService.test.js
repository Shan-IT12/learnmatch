import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import jwt from 'jsonwebtoken'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import authenticateAdmin from '../middleware/authenticateAdmin.js'
import { getAdminUserDetail, getAdminUsers } from '../services/adminUserMonitoringService.js'

function listDatabase({ total = 1, users = [] } = {}) {
  const calls = []
  return {
    calls,
    query: async (sql, values = []) => {
      calls.push({ sql, values })
      if (sql.includes('SELECT COUNT(*) AS total FROM user_monitoring')) return [[{ total }]]
      if (sql.includes('FROM user_monitoring')) return [users]
      throw new Error(`Unexpected SQL: ${sql}`)
    },
  }
}

const monitoredUser = {
  user_id: 17,
  email: 'student@example.edu',
  username: 'student17',
  is_active: 1,
  created_at: new Date('2026-09-01T00:00:00Z'),
  full_name: 'Sample Student',
  assessment_status: 'Completed',
  has_recommendation: 1,
  tracking_started: 1,
  alignment_status: 'On Track',
}

test('user list returns monitored users with truthful derived states and pagination', async () => {
  const database = listDatabase({ total: 21, users: [monitoredUser] })
  const result = await getAdminUsers(database, { page: 2, pageSize: 10 })

  assert.deepEqual(result.users[0], {
    userId: 17,
    displayName: 'Sample Student',
    email: 'student@example.edu',
    accountStatus: 'Active',
    assessmentStatus: 'Completed',
    recommendationStatus: 'Available',
    trackingStatus: 'Tracking Started',
    latestAlignment: 'On Track',
    registeredAt: monitoredUser.created_at,
  })
  assert.deepEqual(result.pagination, { page: 2, pageSize: 10, total: 21, totalPages: 3 })
  const listCall = database.calls.find(({ sql }) => sql.includes('ORDER BY created_at'))
  assert.deepEqual(listCall.values, [10, 10])
})

test('search and account, assessment, tracking, and alignment filters are parameterized', async () => {
  const database = listDatabase()
  await getAdminUsers(database, {
    search: 'Sample',
    account: 'inactive',
    assessment: 'in_progress',
    tracking: 'started',
    alignment: 'needs_attention',
  })

  const countCall = database.calls.find(({ sql }) => sql.includes('SELECT COUNT(*) AS total'))
  assert.match(countCall.sql, /full_name LIKE \? OR email LIKE \? OR username LIKE \?/)
  assert.match(countCall.sql, /is_active = \?/)
  assert.match(countCall.sql, /assessment_status = \?/)
  assert.match(countCall.sql, /tracking_started = \?/)
  assert.match(countCall.sql, /alignment_status = \?/)
  assert.deepEqual(countCall.values, [
    '%Sample%', '%Sample%', '%Sample%', 0, 'In Progress', 1, 'Needs Attention',
  ])

  const noCheckinDatabase = listDatabase()
  await getAdminUsers(noCheckinDatabase, { alignment: 'no_checkin', tracking: 'not_started' })
  const noCheckinSql = noCheckinDatabase.calls[0].sql
  assert.match(noCheckinSql, /alignment_status IS NULL/)
  assert.match(noCheckinSql, /tracking_started = \?/)
})

test('newer completed On Track check-in without AI analysis outranks an older analyzed Monitor check-in', async () => {
  const database = listDatabase({ users: [monitoredUser] })
  const result = await getAdminUsers(database)
  assert.equal(result.users[0].latestAlignment, 'On Track')

  const sql = database.calls[0].sql
  assert.match(sql, /FROM CHECKIN_ALIGNMENT_RESPONSE/)
  assert.match(sql, /HAVING COUNT\(response_id\) = 5/)
  assert.match(sql, /sc\.alignment_score IS NOT NULL/)
  assert.match(sql, /ROW_NUMBER\(\) OVER \(\s+PARTITION BY sc\.user_id/)
  assert.match(sql, /ORDER BY COALESCE\(sc\.checkin_date, sc\.created_at\) DESC, sc\.checkin_id DESC/)
  assert.match(sql, /latest_completed\.latest_rank = 1/)
  assert.doesNotMatch(sql, /AI_MISMATCH_ANALYSIS/)
  assert.match(sql, /ROUND\(sc\.alignment_score \* 100\)/)

  const neutral = await getAdminUsers(listDatabase({ users: [{ ...monitoredUser, alignment_status: null }] }))
  assert.equal(neutral.users[0].latestAlignment, null)
})

function detailDatabase({
  accountRows = [{
    user_id: 17,
    email: 'student@example.edu',
    username: 'student17',
    is_active: 1,
    created_at: new Date('2026-09-01T00:00:00Z'),
    full_name: 'Sample Student',
    profile_count: 1,
    interest_count: 4,
    skill_count: 30,
    personality_count: 1,
  }],
  personalityRows = [{ mbti_type: 'INTJ', taken_at: new Date('2026-09-02T00:00:00Z') }],
  skillRows = [{ answer_count: 30, correct_count: 24 }],
  recommendationRows = [{
    generated_at: new Date('2026-09-03T00:00:00Z'),
    rank_position: 1,
    match_score: '0.9125',
    course_id: 4,
    course_code: 'CRS004',
    course_name: 'Sample Course',
  }],
  termRows = [{
    term_id: 3,
    academic_year: '2026-2027',
    year_level: '2nd Year',
    semester: '1st Semester',
    timing_mode: 'exact',
    dates_source: 'student_confirmed',
    course_id: 4,
    course_code: 'CRS004',
    course_name: 'Sample Course',
  }],
  legacyRows = [],
  alignmentRows = [{
    completed_checkins: 2,
    alignment_score: '0.84',
    phase: 'Mid',
    gwa: null,
    latest_checkin_at: new Date('2026-09-04T00:00:00Z'),
  }],
} = {}) {
  const calls = []
  return {
    calls,
    query: async (sql, values = []) => {
      calls.push({ sql, values })
      if (sql.includes('FROM USER_ACCOUNT u')) return [accountRows]
      if (sql.includes('FROM PERSONALITY_ASSESSMENT')) return [personalityRows]
      if (sql.includes('latest_skill_assessment')) return [skillRows]
      if (sql.includes('FROM RECOMMENDATION recommendation')) return [recommendationRows]
      if (sql.includes('FROM COLLEGE_TERM term')) return [termRows]
      if (sql.includes('WITH completed AS')) return [alignmentRows]
      if (sql.includes('sc.term_id IS NULL')) return [legacyRows]
      throw new Error(`Unexpected SQL: ${sql}`)
    },
  }
}

test('valid user detail returns structured non-sensitive monitoring information', async () => {
  const database = detailDatabase()
  const result = await getAdminUserDetail(database, 17)

  assert.equal(result.account.displayName, 'Sample Student')
  assert.equal(result.assessment.status, 'Completed')
  assert.equal(result.assessment.mbtiType, 'INTJ')
  assert.deepEqual(result.assessment.skillScore, { correct: 24, total: 30, percent: 80 })
  assert.equal(result.recommendation.available, true)
  assert.equal(result.recommendation.courses[0].matchPercent, 91)
  assert.equal(result.tracking.started, true)
  assert.equal(result.tracking.latestAlignment, 'On Track')
  assert.equal(result.tracking.latestAlignmentPercent, 84)

  const alignmentSql = database.calls.find(({ sql }) => sql.includes('WITH completed AS')).sql
  assert.match(alignmentSql, /FROM CHECKIN_ALIGNMENT_RESPONSE/)
  assert.match(alignmentSql, /HAVING COUNT\(response_id\) = 5/)
  assert.doesNotMatch(alignmentSql, /AI_MISMATCH_ANALYSIS/)

  const serialized = JSON.stringify(result).toLowerCase()
  for (const forbidden of ['password', 'otp', 'token', 'ai_feedback', 'ai_narrative', 'prompt']) {
    assert.doesNotMatch(serialized, new RegExp(forbidden))
  }
  assert.ok(database.calls.every(({ sql }) => /^\s*(SELECT|WITH)\b/i.test(sql)))
  assert.ok(database.calls.every(({ sql }) => !/\b(INSERT|UPDATE|DELETE|ALTER|DROP|TRUNCATE|CREATE)\b/i.test(sql)))
})

test('newest completed Monitor check-in determines current status', async () => {
  const result = await getAdminUserDetail(detailDatabase({
    alignmentRows: [{
      completed_checkins: 3,
      alignment_score: '0.60',
      phase: 'Mid',
      gwa: null,
      latest_checkin_at: new Date('2026-09-05T00:00:00Z'),
    }],
  }), 17)

  assert.equal(result.tracking.latestAlignment, 'Monitor')
  assert.equal(result.tracking.latestAlignmentPercent, 60)
})

test('newest completed Needs Attention check-in determines current status', async () => {
  const result = await getAdminUserDetail(detailDatabase({
    alignmentRows: [{
      completed_checkins: 3,
      alignment_score: '0.20',
      phase: 'Mid',
      gwa: null,
      latest_checkin_at: new Date('2026-09-05T00:00:00Z'),
    }],
  }), 17)

  assert.equal(result.tracking.latestAlignment, 'Needs Attention')
  assert.equal(result.tracking.latestAlignmentPercent, 20)
})

test('completed On Track check-in without AI analysis still counts as completed', async () => {
  const database = detailDatabase({
    alignmentRows: [{
      completed_checkins: 1,
      alignment_score: '0.90',
      phase: 'Early',
      gwa: null,
      latest_checkin_at: new Date('2026-09-05T00:00:00Z'),
    }],
  })
  const result = await getAdminUserDetail(database, 17)

  assert.equal(result.tracking.completedCheckins, 1)
  assert.equal(result.tracking.latestAlignment, 'On Track')
  assert.doesNotMatch(
    database.calls.find(({ sql }) => sql.includes('WITH completed AS')).sql,
    /AI_MISMATCH_ANALYSIS/
  )
})

test('student with no completed check-in has no current alignment', async () => {
  const result = await getAdminUserDetail(detailDatabase({
    alignmentRows: [{
      completed_checkins: 0,
      alignment_score: null,
      phase: null,
      gwa: null,
      latest_checkin_at: null,
    }],
  }), 17)

  assert.equal(result.tracking.completedCheckins, 0)
  assert.equal(result.tracking.latestAlignment, null)
  assert.equal(result.tracking.latestAlignmentPercent, null)
})

test('unknown user returns null and legacy tracking is used only when no current term exists', async () => {
  assert.equal(await getAdminUserDetail(detailDatabase({ accountRows: [] }), 999), null)

  const database = detailDatabase({
    termRows: [],
    legacyRows: [{
      year_level: '3rd Year',
      semester: '2nd Semester',
      course_id: 7,
      course_code: 'CRS007',
      course_name: 'Legacy Course',
    }],
  })
  const result = await getAdminUserDetail(database, 17)
  assert.equal(result.tracking.started, true)
  assert.equal(result.tracking.course.courseName, 'Legacy Course')
  assert.equal(result.tracking.timingMode, 'manual')
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

test('user monitoring routes reject missing and student tokens and allow admin tokens', async () => {
  const originalSecret = process.env.JWT_SECRET
  process.env.JWT_SECRET = 'admin-user-monitoring-test-secret'
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
  assert.match(serverSource, /app\.get\('\/api\/admin\/users', authenticateAdmin/)
  assert.match(serverSource, /app\.get\('\/api\/admin\/users\/:userId', authenticateAdmin/)
})
