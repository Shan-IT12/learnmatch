import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import jwt from 'jsonwebtoken'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import authenticateAdmin from '../middleware/authenticateAdmin.js'
import { getAdminFeedback, getAdminFeedbackDetail } from '../services/adminFeedbackService.js'

const persistedFeedback = {
  feedback_id: 12,
  user_id: 7,
  rating: 5,
  category: 'Suggestion',
  submitted_at: new Date('2026-09-18T08:30:00Z'),
  comment_preview: 'Please add more course comparison tools.',
  full_name: 'Sample Student',
  username: 'student7',
  email: 'student@example.edu',
}

function feedbackDatabase({
  summaryRows = [{ total_feedback: 12, average_rating: '4.3', recent_feedback: 5 }],
  categoryRows = [
    { category: 'General Feedback', feedback_count: 7 },
    { category: 'Suggestion', feedback_count: 5 },
  ],
  countRows = [{ total: 12 }],
  feedbackRows = [persistedFeedback],
} = {}) {
  const calls = []
  return {
    calls,
    query: async (sql, values = []) => {
      calls.push({ sql, values })
      if (sql.includes('total_feedback')) return [summaryRows]
      if (sql.includes('feedback_count')) return [categoryRows]
      if (sql.includes('SELECT COUNT(*) AS total ')) return [countRows]
      if (sql.includes('comment_preview')) return [feedbackRows]
      throw new Error(`Unexpected SQL: ${sql}`)
    },
  }
}

test('feedback list returns persisted records, aggregate metrics, and server pagination', async () => {
  const database = feedbackDatabase()
  const result = await getAdminFeedback(database, { page: 2, pageSize: 5 })

  assert.deepEqual(result.summary, {
    totalFeedback: 12,
    averageRating: 4.3,
    recentFeedback: 5,
  })
  assert.deepEqual(result.categoryDistribution, [
    { category: 'General Feedback', count: 7 },
    { category: 'Suggestion', count: 5 },
  ])
  assert.deepEqual(result.feedback[0], {
    feedbackId: 12,
    user: { userId: 7, displayName: 'Sample Student', email: 'student@example.edu' },
    rating: 5,
    category: 'Suggestion',
    submittedAt: persistedFeedback.submitted_at,
    commentPreview: 'Please add more course comparison tools.',
  })
  assert.deepEqual(result.pagination, { page: 2, pageSize: 5, total: 12, totalPages: 3 })

  const listCall = database.calls.find(({ sql }) => sql.includes('comment_preview'))
  assert.deepEqual(listCall.values, [5, 5])
  assert.match(listCall.sql, /ORDER BY feedback\.submitted_at DESC, feedback\.feedback_id DESC/)
})

test('search, real category and rating filters, and oldest ordering are parameterized', async () => {
  const database = feedbackDatabase()
  await getAdminFeedback(database, {
    search: 'course',
    category: 'Suggestion',
    rating: '4',
    sort: 'oldest',
  })

  const countCall = database.calls.find(({ sql }) => sql.includes('SELECT COUNT(*) AS total '))
  assert.match(countCall.sql, /profile\.full_name LIKE \? OR account\.username LIKE \? OR account\.email LIKE \?/)
  assert.match(countCall.sql, /feedback\.comment LIKE \? OR feedback\.category LIKE \?/)
  assert.match(countCall.sql, /feedback\.category = \?/)
  assert.match(countCall.sql, /feedback\.rating = \?/)
  assert.deepEqual(countCall.values, [
    '%course%', '%course%', '%course%', '%course%', '%course%', 'Suggestion', 4,
  ])

  const listCall = database.calls.find(({ sql }) => sql.includes('comment_preview'))
  assert.match(listCall.sql, /ORDER BY feedback\.submitted_at ASC, feedback\.feedback_id ASC/)
  assert.deepEqual(listCall.values.slice(-2), [10, 0])
})

test('empty feedback data and no search matches are handled safely', async () => {
  const result = await getAdminFeedback(feedbackDatabase({
    summaryRows: [{ total_feedback: 0, average_rating: null, recent_feedback: 0 }],
    categoryRows: [],
    countRows: [{ total: 0 }],
    feedbackRows: [],
  }))

  assert.deepEqual(result.summary, { totalFeedback: 0, averageRating: null, recentFeedback: 0 })
  assert.deepEqual(result.categoryDistribution, [])
  assert.deepEqual(result.feedback, [])
  assert.deepEqual(result.pagination, { page: 1, pageSize: 10, total: 0, totalPages: 1 })
})

test('missing profile uses username and then email as the safe identity fallback', async () => {
  const usernameResult = await getAdminFeedback(feedbackDatabase({
    feedbackRows: [{ ...persistedFeedback, full_name: null }],
  }))
  assert.equal(usernameResult.feedback[0].user.displayName, 'student7')

  const emailResult = await getAdminFeedback(feedbackDatabase({
    feedbackRows: [{ ...persistedFeedback, full_name: null, username: null }],
  }))
  assert.equal(emailResult.feedback[0].user.displayName, 'student@example.edu')
})

function detailDatabase(rows) {
  const calls = []
  return {
    calls,
    query: async (sql, values) => {
      calls.push({ sql, values })
      return [rows]
    },
  }
}

test('feedback detail returns full content and safe linked-user information', async () => {
  const database = detailDatabase([{
    ...persistedFeedback,
    comment: 'The full feedback message remains available in the detail view.',
  }])
  const result = await getAdminFeedbackDetail(database, 12)

  assert.equal(result.comment, 'The full feedback message remains available in the detail view.')
  assert.equal(result.user.userId, 7)
  assert.equal(result.user.displayName, 'Sample Student')
  assert.deepEqual(database.calls[0].values, [12])
  assert.doesNotMatch(JSON.stringify(result).toLowerCase(), /password|otp|token|assessment|factor_|height|weight/)
})

test('unknown or invalid feedback detail returns null', async () => {
  assert.equal(await getAdminFeedbackDetail(detailDatabase([]), 999), null)
  assert.equal(await getAdminFeedbackDetail(detailDatabase([]), 'invalid'), null)
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

test('feedback admin routes enforce admin authentication and preserve student submission', async () => {
  const originalSecret = process.env.JWT_SECRET
  process.env.JWT_SECRET = 'admin-feedback-test-secret'
  try {
    assert.equal((await runMiddleware({})).status, 401)
    const studentToken = jwt.sign({ userId: 7 }, process.env.JWT_SECRET)
    assert.equal((await runMiddleware({ authorization: `Bearer ${studentToken}` })).status, 403)
    const adminToken = jwt.sign({ adminId: 1, role: 'admin' }, process.env.JWT_SECRET)
    assert.equal((await runMiddleware({ authorization: `Bearer ${adminToken}` })).status, 200)
  } finally {
    if (originalSecret === undefined) delete process.env.JWT_SECRET
    else process.env.JWT_SECRET = originalSecret
  }

  const testsDirectory = path.dirname(fileURLToPath(import.meta.url))
  const serverSource = fs.readFileSync(path.join(testsDirectory, '../server.js'), 'utf8')
  assert.match(serverSource, /app\.get\('\/api\/admin\/feedback', authenticateAdmin/)
  assert.match(serverSource, /app\.get\('\/api\/admin\/feedback\/:feedbackId', authenticateAdmin/)
  assert.match(serverSource, /app\.post\('\/api\/feedback', authenticateToken/)
  assert.doesNotMatch(serverSource, /app\.(post|put|patch|delete)\('\/api\/admin\/feedback/)
})

test('feedback admin service executes read-only queries', async () => {
  const database = feedbackDatabase()
  await getAdminFeedback(database)
  await getAdminFeedbackDetail(detailDatabase([{ ...persistedFeedback, comment: 'Full message' }]), 12)

  const serviceSource = fs.readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), '../services/adminFeedbackService.js'),
    'utf8'
  )
  assert.doesNotMatch(serviceSource, /\b(INSERT|UPDATE|DELETE|ALTER|DROP|TRUNCATE|CREATE)\b/i)
  assert.ok(database.calls.every(({ sql }) => /^\s*SELECT\b/i.test(sql)))
})
