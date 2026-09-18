import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'fs'

import {
  CollegeTrackingError,
  calculateAlignmentResult,
  createCollegeSetup,
  getCheckinHistory,
  startNextCheckin,
  submitCollegeCheckin,
} from '../services/collegeTrackingService.js'

const answersAt = (score) => [1, 2, 3, 4, 5].map((question_number) => ({ question_number, score }))

test('deterministic alignment uses existing survey and GWA thresholds', () => {
  assert.equal(calculateAlignmentResult(answersAt(5), { phase: 'Early' }).status, 'On Track')
  assert.equal(calculateAlignmentResult(answersAt(3), { phase: 'Mid' }).status, 'Monitor')
  assert.equal(calculateAlignmentResult(answersAt(1), { phase: 'Mid' }).status, 'Needs Attention')
  assert.equal(calculateAlignmentResult(answersAt(4), { phase: 'End', gwa: 74 }).status, 'Monitor')
  assert.equal(calculateAlignmentResult(answersAt(2), { phase: 'End', gwa: 80 }).status, 'Monitor')
  assert.equal(calculateAlignmentResult(answersAt(2), { phase: 'End', gwa: 74 }).status, 'Needs Attention')
})

test('check-in validation requires five unique 1-to-5 answers and End-only GWA', () => {
  assert.throws(
    () => calculateAlignmentResult(answersAt(5).slice(0, 4), { phase: 'Early' }),
    CollegeTrackingError
  )
  assert.throws(
    () => calculateAlignmentResult(answersAt(5), { phase: 'Early', gwa: 90 }),
    /End check-in/
  )
  assert.throws(
    () => calculateAlignmentResult(answersAt(5), { phase: 'End', gwa: 101 }),
    /0 to 100/
  )
})

function setupPool({ activeCourse = true, existingCheckin = null } = {}) {
  const state = { inserts: 0, committed: false, rolledBack: false }
  const connection = {
    beginTransaction: async () => {},
    commit: async () => { state.committed = true },
    rollback: async () => { state.rolledBack = true },
    release: () => {},
    query: async (sql) => {
      if (sql.includes('FROM COURSE')) {
        return [activeCourse ? [{ course_id: 430, course_code: 'CRS001', course_name: 'Course One' }] : []]
      }
      if (sql.includes('FROM SEMESTER_CHECKIN')) {
        return [existingCheckin ? [{ checkin_id: existingCheckin }] : []]
      }
      if (sql.includes('INSERT INTO SEMESTER_CHECKIN')) {
        state.inserts += 1
        return [{ insertId: 88 }]
      }
      throw new Error(`Unexpected SQL: ${sql}`)
    },
  }
  return { pool: { getConnection: async () => connection }, state }
}

test('College Setup persists an active internal course ID and is idempotent', async () => {
  const first = setupPool()
  const created = await createCollegeSetup(first.pool, 7, {
    courseId: 430,
    yearLevel: '2nd Year',
    semester: '1st Semester',
    startingPhase: 'Early',
  })
  assert.equal(created.created, true)
  assert.equal(created.checkinId, 88)
  assert.equal(first.state.inserts, 1)

  const repeat = setupPool({ existingCheckin: 88 })
  const reused = await createCollegeSetup(repeat.pool, 7, {
    courseId: 430,
    yearLevel: '2nd Year',
    semester: '1st Semester',
    startingPhase: 'Early',
  })
  assert.equal(reused.created, false)
  assert.equal(repeat.state.inserts, 0)
})

test('College Setup rejects inactive or unavailable courses', async () => {
  const { pool, state } = setupPool({ activeCourse: false })
  await assert.rejects(
    createCollegeSetup(pool, 7, {
      courseId: 430,
      yearLevel: '2nd Year',
      semester: '1st Semester',
      startingPhase: 'Early',
    }),
    (error) => error.code === 'COURSE_UNAVAILABLE' && error.status === 404
  )
  assert.equal(state.inserts, 0)
})

function submissionPool({ owner = true, existingResponses = 0 } = {}) {
  const state = { answers: [], analysis: null, update: null, committed: false, rolledBack: false }
  const connection = {
    beginTransaction: async () => {},
    commit: async () => { state.committed = true },
    rollback: async () => { state.rolledBack = true },
    release: () => {},
    query: async (sql, values) => {
      if (sql.includes('FROM SEMESTER_CHECKIN') && sql.includes('FOR UPDATE')) return [[{ checkin_id: 50 }]]
      if (sql.includes('response_count')) return [[{ response_count: existingResponses, analysis_count: 0 }]]
      if (sql.includes('INSERT INTO CHECKIN_ALIGNMENT_RESPONSE')) {
        state.answers.push(values)
        return [{ insertId: state.answers.length }]
      }
      if (sql.startsWith('UPDATE SEMESTER_CHECKIN')) {
        state.update = values
        return [{ affectedRows: 1 }]
      }
      if (sql.includes('INSERT INTO AI_MISMATCH_ANALYSIS')) {
        state.analysis = values
        return [{ insertId: 1 }]
      }
      throw new Error(`Unexpected SQL: ${sql}`)
    },
  }
  return {
    pool: {
      query: async () => [owner ? [{ checkin_id: 50, phase: 'End', course_name: 'Course One' }] : []],
      getConnection: async () => connection,
    },
    state,
  }
}

test('check-in submission enforces ownership and persists five answers, GWA, status, and fallback atomically', async () => {
  const denied = submissionPool({ owner: false })
  await assert.rejects(
    submitCollegeCheckin(denied.pool, 8, { checkinId: 50, answers: answersAt(4), gwa: 88 }),
    (error) => error.code === 'CHECKIN_NOT_FOUND' && error.status === 404
  )

  const allowed = submissionPool()
  const result = await submitCollegeCheckin(
    allowed.pool,
    7,
    { checkinId: 50, answers: answersAt(4), gwa: 88 },
    async () => ({ feedback: 'Safe feedback', recommendation: 'Safe next step' })
  )
  assert.equal(result.status, 'On Track')
  assert.equal(allowed.state.answers.length, 5)
  assert.deepEqual(allowed.state.update, [88, 0.75, 50])
  assert.deepEqual(allowed.state.analysis.slice(0, 3), [50, 25, 'On Track'])
  assert.equal(allowed.state.committed, true)
})

test('duplicate check-in submission is rejected without overwriting history', async () => {
  const duplicate = submissionPool({ existingResponses: 5 })
  await assert.rejects(
    submitCollegeCheckin(
      duplicate.pool,
      7,
      { checkinId: 50, answers: answersAt(4), gwa: 88 },
      async () => ({ feedback: 'Safe feedback', recommendation: 'Safe next step' })
    ),
    (error) => error.code === 'CHECKIN_ALREADY_SUBMITTED' && error.status === 409
  )
  assert.equal(duplicate.state.answers.length, 0)
  assert.equal(duplicate.state.rolledBack, true)
})

function phasePool(phase) {
  const state = { insertedPhase: null }
  const connection = {
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => {},
    release: () => {},
    query: async (sql, values) => {
      if (sql.includes('ORDER BY checkin_id DESC') && sql.includes('FOR UPDATE')) {
        return [[{ checkin_id: 50, course_id: 430, year_level: '2nd Year', semester: '1st Semester', phase }]]
      }
      if (sql.includes('response_count')) return [[{ response_count: 5 }]]
      if (sql.includes('SELECT checkin_id FROM SEMESTER_CHECKIN')) return [[]]
      if (sql.includes('INSERT INTO SEMESTER_CHECKIN')) {
        state.insertedPhase = values[3]
        return [{ insertId: 51 }]
      }
      throw new Error(`Unexpected SQL: ${sql}`)
    },
  }
  return { pool: { getConnection: async () => connection }, state }
}

test('completed Early and Mid check-ins advance sequentially while End completes the semester', async () => {
  const early = phasePool('Early')
  assert.deepEqual(await startNextCheckin(early.pool, 7), {
    created: true,
    checkinId: 51,
    phase: 'Mid',
  })
  assert.equal(early.state.insertedPhase, 'Mid')

  const mid = phasePool('Mid')
  assert.equal((await startNextCheckin(mid.pool, 7)).phase, 'End')
  assert.equal(mid.state.insertedPhase, 'End')

  const end = phasePool('End')
  await assert.rejects(
    startNextCheckin(end.pool, 7),
    (error) => error.code === 'CHECKINS_COMPLETE'
  )
})

test('history is user-scoped, ordered, and returned without update or delete queries', async () => {
  const calls = []
  const database = {
    query: async (sql, values) => {
      calls.push({ sql, values })
      return [[
        {
          checkin_id: 12,
          phase: 'Mid',
          year_level: '2nd Year',
          semester: '1st Semester',
          gwa: null,
          alignment_score: 0.75,
          checkin_date: new Date(0),
          course_code: 'CRS001',
          course_name: 'Course One',
          mismatch_score: 25,
          status: 'On Track',
          ai_feedback: 'Feedback',
          recommendation: 'Next step',
        },
      ]]
    },
  }
  const history = await getCheckinHistory(database, 7, 5)
  assert.equal(history[0].alignmentPercent, 75)
  assert.deepEqual(calls[0].values, [7, 5])
  assert.match(calls[0].sql, /ORDER BY sc\.checkin_id DESC/)
  assert.doesNotMatch(calls[0].sql, /UPDATE|DELETE/)
})

test('all College Phase routes require authentication', () => {
  const serverSource = fs.readFileSync(new URL('../server.js', import.meta.url), 'utf8')
  for (const path of [
    '/api/college/setup',
    '/api/college/status',
    '/api/college/checkin/pending',
    '/api/college/checkin',
    '/api/college/checkin/status',
    '/api/college/checkin/start',
    '/api/college/checkin/history',
  ]) {
    assert.match(serverSource, new RegExp(`app\\.(?:get|post)\\('${path.replaceAll('/', '\\/')}', authenticateToken`))
  }
})
