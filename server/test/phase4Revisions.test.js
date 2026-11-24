import test from 'node:test'
import assert from 'node:assert/strict'
import { getAdminFeedback } from '../services/adminFeedbackService.js'
import { getAdminAnalytics } from '../services/adminAnalyticsService.js'
import { validateFeedback } from '../services/requestValidationService.js'

test('getAdminFeedback returns 5-to-1 ratingDistribution with counts and percentages', async () => {
  let callIndex = 0
  const fakeDb = {
    async query() {
      callIndex += 1
      if (callIndex === 1) {
        return [[{ total_feedback: 4, average_rating: 4.3, recent_feedback: 3 }]]
      }
      if (callIndex === 2) {
        return [[{ category: 'Recommendations', feedback_count: 4 }]]
      }
      if (callIndex === 3) {
        return [[
          { rating: 5, rating_count: 2 },
          { rating: 4, rating_count: 1 },
          { rating: 3, rating_count: 1 },
        ]]
      }
      if (callIndex === 4) {
        return [[{ total: 4 }]]
      }
      return [[{
        feedback_id: 1,
        user_id: 10,
        rating: 5,
        category: 'Recommendations',
        submitted_at: '2026-11-24T00:00:00Z',
        comment_preview: 'Great course recommendations!',
      }]]
    },
  }

  const result = await getAdminFeedback(fakeDb, { page: 1, pageSize: 10 })
  assert.equal(result.summary.totalFeedback, 4)
  assert.equal(result.summary.averageRating, 4.3)
  assert.deepEqual(result.ratingDistribution, [
    { rating: 5, count: 2, percent: 50 },
    { rating: 4, count: 1, percent: 25 },
    { rating: 3, count: 1, percent: 25 },
    { rating: 2, count: 0, percent: 0 },
    { rating: 1, count: 0, percent: 0 },
  ])
})

test('getAdminAnalytics includes assessmentModes and collegeOverview metrics', async () => {
  const fakeDb = {
    async query(sql) {
      if (sql.includes('recommendations_generated')) {
        return [[{
          total_users: 20,
          completed: 12,
          in_progress: 3,
          not_started: 5,
          recommendations_generated: 12,
        }]]
      }
      if (sql.includes('student_domain_scores')) {
        return [[{ dimension: 'Numerical', average_score: 78.4, student_count: 12 }]]
      }
      if (sql.includes('ranked_personality')) {
        return [[{ mbti_type: 'INTJ', student_count: 4 }]]
      }
      if (sql.includes('appearance_count')) {
        return [[{ course_id: 1, course_code: 'BSCS', course_name: 'Bachelor of Computer Science', appearance_count: 9 }]]
      }
      if (sql.includes('latest_completed_attempt')) {
        return [[{ verified_count: 7, standard_count: 5 }]]
      }
      if (sql.includes('latest_alignment')) {
        return [[{ total_tracked: 8, on_track: 5, monitor: 2, needs_attention: 0, no_checkin: 1 }]]
      }
      if (sql.includes('latest_cycle_id')) {
        return [[{
          total_enrolled: 8,
          verified_count: 3,
          pending_review_count: 2,
          rejected_count: 1,
          unsubmitted_count: 2,
        }]]
      }
      return [[]]
    },
  }

  const result = await getAdminAnalytics(fakeDb)
  assert.deepEqual(result.assessmentModes, { verified: 7, standard: 5 })
  assert.equal(result.collegeOverview.totalTracked, 8)
  assert.deepEqual(result.collegeOverview.alignment, {
    onTrack: 5,
    monitor: 2,
    needsAttention: 0,
    noCheckin: 1,
  })
  assert.deepEqual(result.collegeOverview.enrollmentVerification, {
    totalEnrolled: 8,
    verified: 3,
    pendingReview: 2,
    rejected: 1,
    unsubmitted: 2,
  })
})

test('validateFeedback accepts all 5 Phase 4 categories, defaults blank to General, and rejects unknown values', () => {
  for (const category of [
    'General',
    'System Performance',
    'Assessment Experience',
    'Course Recommendations',
    'College Phase',
  ]) {
    const valid = validateFeedback({ rating: 5, category, comment: 'Helpful!' })
    assert.equal(valid.valid, true)
    assert.equal(valid.value.category, category)
  }

  const defaulted = validateFeedback({ rating: 4, comment: 'No category specified' })
  assert.equal(defaulted.valid, true)
  assert.equal(defaulted.value.category, 'General')

  const invalid = validateFeedback({ rating: 5, category: 'Invalid Category' })
  assert.equal(invalid.valid, false)
})
