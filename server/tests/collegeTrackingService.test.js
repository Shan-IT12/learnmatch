import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'fs'

import {
  CollegeTrackingError,
  buildPhaseStates,
  calculateAlignmentResult,
  calculateNextAcademicStage,
  calculateSemesterTiming,
  createCollegeSetup,
  getCheckinHistory,
  normalizeApproximateDate,
  resolveTimingInput,
  startNextCheckin,
  startNextSemester,
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

test('calendar timing handles before, boundaries, active phases, end, and after', () => {
  const start = '2026-01-01'
  const end = '2026-04-11'
  const startMs = Date.parse(`${start}T00:00:00.000Z`)
  const day = 24 * 60 * 60 * 1000
  const timingAt = (offset) => calculateSemesterTiming(start, end, new Date(startMs + offset))

  assert.deepEqual(
    { phase: timingAt(-day).expectedPhase, progress: timingAt(-day).semesterProgress, state: timingAt(-day).semesterState },
    { phase: 'Early', progress: 0, state: 'upcoming' }
  )
  assert.equal(timingAt(0).expectedPhase, 'Early')
  assert.equal(timingAt(10 * day).expectedPhase, 'Early')
  assert.equal(timingAt(33 * day).expectedPhase, 'Early')
  assert.equal(timingAt(33 * day + 1).expectedPhase, 'Mid')
  assert.equal(timingAt(50 * day).expectedPhase, 'Mid')
  assert.equal(timingAt(66 * day).expectedPhase, 'Mid')
  assert.equal(timingAt(66 * day + 1).expectedPhase, 'End')
  assert.equal(timingAt(80 * day).expectedPhase, 'End')
  assert.deepEqual(
    { phase: timingAt(100 * day).expectedPhase, progress: timingAt(100 * day).semesterProgress },
    { phase: 'End', progress: 100 }
  )
  assert.deepEqual(
    { progress: timingAt(101 * day).semesterProgress, state: timingAt(101 * day).semesterState, ended: timingAt(101 * day).semesterEnded },
    { progress: 100, state: 'ended', ended: true }
  )
  assert.equal(
    calculateSemesterTiming(new Date(2026, 0, 1), new Date(2026, 3, 11), new Date(2026, 0, 1)).semesterProgress,
    0
  )
})

test('tracking states keep missed phases available and never fabricate completion', () => {
  const early = calculateSemesterTiming('2026-01-01', '2026-04-11', new Date('2026-01-10T00:00:00Z'))
  const mid = calculateSemesterTiming('2026-01-01', '2026-04-11', new Date('2026-02-20T00:00:00Z'))
  const end = calculateSemesterTiming('2026-01-01', '2026-04-11', new Date('2026-04-01T00:00:00Z'))

  assert.deepEqual(buildPhaseStates([], early).map(({ state }) => state), ['available', 'upcoming', 'upcoming'])
  assert.deepEqual(buildPhaseStates(['Early'], mid).map(({ state }) => state), ['completed', 'available', 'upcoming'])
  assert.deepEqual(buildPhaseStates([], mid).map(({ state }) => state), ['missed_available', 'available', 'upcoming'])
  assert.deepEqual(buildPhaseStates(['Early', 'Mid'], end).map(({ state }) => state), ['completed', 'completed', 'available'])
  assert.deepEqual(buildPhaseStates(['Early', 'Mid', 'End'], end).map(({ state }) => state), ['completed', 'completed', 'completed'])
})

test('legacy timing fallback exposes the next sequential phase', () => {
  const unavailable = calculateSemesterTiming(null, null)
  assert.deepEqual(
    buildPhaseStates(['Early'], unavailable, { legacyCurrentPhase: 'Early' }).map(({ state }) => state),
    ['completed', 'available', 'upcoming']
  )
  assert.deepEqual(
    buildPhaseStates(['Early', 'Mid'], unavailable, { legacyCurrentPhase: 'Mid' }).map(({ state }) => state),
    ['completed', 'completed', 'available']
  )
})

function setupPool({ activeCourse = true, existingCheckin = null } = {}) {
  const state = { inserts: 0, updates: 0, committed: false, rolledBack: false }
  const connection = {
    beginTransaction: async () => {},
    commit: async () => { state.committed = true },
    rollback: async () => { state.rolledBack = true },
    release: () => {},
    query: async (sql) => {
      if (sql.includes('FROM COURSE')) {
        return [activeCourse ? [{ course_id: 430, course_code: 'CRS001', course_name: 'Course One' }] : []]
      }
      if (sql.includes('FROM COLLEGE_TERM')) {
        return [existingCheckin ? [{ term_id: existingCheckin }] : []]
      }
      if (sql.includes('INSERT INTO COLLEGE_TERM')) {
        state.inserts += 1
        return [{ insertId: 88 }]
      }
      if (sql.includes('UPDATE COLLEGE_TERM')) {
        state.updates += 1
        return [{ affectedRows: 1 }]
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
    academicYear: '2026-2027',
    yearLevel: '2nd Year',
    semester: '1st Semester',
    semesterStartDate: '2026-08-01',
    semesterEndDate: '2026-12-15',
  }, () => ({ program_duration_years: 4 }))
  assert.equal(created.created, true)
  assert.equal(created.termId, 88)
  assert.equal(first.state.inserts, 1)

  const repeat = setupPool({ existingCheckin: 88 })
  const reused = await createCollegeSetup(repeat.pool, 7, {
    courseId: 430,
    academicYear: '2026-2027',
    yearLevel: '2nd Year',
    semester: '1st Semester',
    semesterStartDate: '2026-08-01',
    semesterEndDate: '2026-12-15',
  }, () => ({ program_duration_years: 4 }))
  assert.equal(reused.created, false)
  assert.equal(repeat.state.inserts, 0)
  assert.equal(repeat.state.updates, 1)
})

test('approximate schedule normalization is deterministic and supports cross-year terms', () => {
  assert.equal(normalizeApproximateDate({ month: 8, year: 2026, part: 'early' }, '2026-2027'), '2026-08-05')
  assert.equal(normalizeApproximateDate({ month: 8, year: 2026, part: 'middle' }, '2026-2027'), '2026-08-15')
  assert.equal(normalizeApproximateDate({ month: 8, year: 2026, part: 'late' }, '2026-2027'), '2026-08-25')

  const timing = resolveTimingInput({
    timingMode: 'approximate',
    approximateStart: { month: 11, year: 2026, part: 'middle' },
    approximateEnd: { month: 3, year: 2027, part: 'late' },
  }, '2026-2027', new Date('2027-01-15T00:00:00Z'))
  assert.equal(timing.semesterStartDate, '2026-11-15')
  assert.equal(timing.semesterEndDate, '2027-03-25')
  assert.equal(timing.datesSource, 'estimated')
  assert.equal(calculateSemesterTiming(timing.semesterStartDate, timing.semesterEndDate, new Date('2027-01-15T00:00:00Z')).expectedPhase, 'Mid')
})

test('approximate schedule rejects invalid ordering and years outside the academic year', () => {
  assert.throws(
    () => resolveTimingInput({
      timingMode: 'approximate',
      approximateStart: { month: 9, year: 2026, part: 'late' },
      approximateEnd: { month: 8, year: 2026, part: 'early' },
    }, '2026-2027'),
    (error) => error.code === 'INVALID_SEMESTER_DATES'
  )
  assert.throws(
    () => normalizeApproximateDate({ month: 8, year: 2028, part: 'early' }, '2026-2027'),
    (error) => error.code === 'INVALID_APPROXIMATE_DATE'
  )
})

test('no-date inputs preserve a known initial phase or use manual fallback', () => {
  for (const phase of ['Early', 'Mid', 'End']) {
    const resolved = resolveTimingInput({ timingMode: 'phase_only', initialTrackingPhase: phase }, '2026-2027')
    assert.equal(resolved.initialTrackingPhase, phase)
    assert.equal(resolved.semesterStartDate, null)
    assert.equal(resolved.semesterEndDate, null)
  }
  assert.deepEqual(resolveTimingInput({ timingMode: 'manual' }, '2026-2027'), {
    timingMode: 'manual',
    semesterStartDate: null,
    semesterEndDate: null,
    datesSource: null,
    initialTrackingPhase: null,
  })
})

test('late onboarding marks pre-tracking phases not recorded without fabricating completion', () => {
  const midTiming = calculateSemesterTiming('2026-01-01', '2026-04-11', new Date('2026-02-20T00:00:00Z'))
  const endTiming = calculateSemesterTiming('2026-01-01', '2026-04-11', new Date('2026-04-01T00:00:00Z'))
  assert.equal(resolveTimingInput({
    timingMode: 'exact',
    semesterStartDate: '2026-01-01',
    semesterEndDate: '2026-04-11',
  }, '2026-2027', new Date('2026-02-20T00:00:00Z')).initialTrackingPhase, 'Mid')
  assert.equal(resolveTimingInput({
    timingMode: 'exact',
    semesterStartDate: '2026-01-01',
    semesterEndDate: '2026-04-11',
  }, '2026-2027', new Date('2026-04-01T00:00:00Z')).initialTrackingPhase, 'End')
  assert.deepEqual(
    buildPhaseStates([], midTiming, { initialTrackingPhase: 'Mid' }).map(({ state }) => state),
    ['not_recorded', 'available', 'upcoming']
  )
  assert.deepEqual(
    buildPhaseStates([], endTiming, { initialTrackingPhase: 'End' }).map(({ state }) => state),
    ['not_recorded', 'not_recorded', 'available']
  )
})

test('College Setup rejects inactive or unavailable courses', async () => {
  const { pool, state } = setupPool({ activeCourse: false })
  await assert.rejects(
    createCollegeSetup(pool, 7, {
      courseId: 430,
      academicYear: '2026-2027',
      yearLevel: '2nd Year',
      semester: '1st Semester',
      semesterStartDate: '2026-08-01',
      semesterEndDate: '2026-12-15',
    }),
    (error) => error.code === 'COURSE_UNAVAILABLE' && error.status === 404
  )
  assert.equal(state.inserts, 0)
})

test('College Setup rejects a year level beyond the canonical program duration', async () => {
  const { pool, state } = setupPool()
  await assert.rejects(
    createCollegeSetup(pool, 7, {
      courseId: 430,
      academicYear: '2026-2027',
      yearLevel: '5th Year',
      semester: '1st Semester',
      semesterStartDate: '2026-08-01',
      semesterEndDate: '2026-12-15',
    }, () => ({ program_duration_years: 4 })),
    (error) => error.code === 'INVALID_PROGRAM_STAGE'
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
      if (sql.includes('FROM COLLEGE_TERM')) return [[]]
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

test('academic progression never skips semesters or exceeds the program duration', () => {
  assert.deepEqual(calculateNextAcademicStage('1st Year', '1st Semester', 4), {
    programCompleted: false,
    yearLevel: '1st Year',
    semester: '2nd Semester',
  })
  assert.deepEqual(calculateNextAcademicStage('1st Year', '2nd Semester', 4), {
    programCompleted: false,
    yearLevel: '2nd Year',
    semester: '1st Semester',
  })
  assert.deepEqual(calculateNextAcademicStage('5th Year', '2nd Semester', 5), {
    programCompleted: true,
    yearLevel: null,
    semester: null,
  })
  assert.throws(
    () => calculateNextAcademicStage('5th Year', '2nd Semester', 4),
    (error) => error.code === 'INVALID_PROGRAM_STAGE'
  )
})

function semesterProgressionPool({
  yearLevel = '1st Year',
  semester = '1st Semester',
  active = true,
  phases = ['Early', 'Mid', 'End'],
  existingTermId = null,
  endDate = '2020-12-15',
} = {}) {
  const state = { inserts: [], committed: false, rolledBack: false }
  const connection = {
    beginTransaction: async () => {},
    commit: async () => { state.committed = true },
    rollback: async () => { state.rolledBack = true },
    release: () => {},
    query: async (sql, values) => {
      if (sql.includes('FROM COLLEGE_TERM') && sql.includes('JOIN COURSE')) {
        return [[{
          term_id: 13,
          course_id: 430,
          course_code: 'CRS001',
          academic_year: '2020-2021',
          year_level: yearLevel,
          semester,
          semester_start_date: '2020-08-01',
          semester_end_date: endDate,
          is_active: active ? 1 : 0,
        }]]
      }
      if (sql.includes('COUNT(response.response_id)')) {
        return [phases.map((item) => ({
          phase: item,
          response_count: 5,
        }))]
      }
      if (sql.includes('SELECT term_id FROM COLLEGE_TERM')) {
        return [existingTermId ? [{ term_id: existingTermId }] : []]
      }
      if (sql.includes('INSERT INTO COLLEGE_TERM')) {
        state.inserts.push(values)
        return [{ insertId: 14 }]
      }
      throw new Error(`Unexpected SQL: ${sql}`)
    },
  }
  return { pool: { getConnection: async () => connection }, state }
}

test('explicit semester progression preserves history and creates only the next Early record', async () => {
  const firstSemester = semesterProgressionPool()
  const result = await startNextSemester(
    firstSemester.pool,
    7,
    { academicYear: '2020-2021', semesterStartDate: '2021-01-10', semesterEndDate: '2021-05-20' },
    () => ({ program_duration_years: 4 })
  )
  assert.deepEqual(result, {
    created: true,
    programCompleted: false,
    termId: 14,
    academicYear: '2020-2021',
    yearLevel: '1st Year',
    semester: '2nd Semester',
  })
  assert.deepEqual(firstSemester.state.inserts[0].slice(0, 7), [7, 430, '2020-2021', '1st Year', '2nd Semester', '2021-01-10', '2021-05-20'])
  assert.deepEqual(firstSemester.state.inserts[0].slice(7, 9), ['student_confirmed', 'exact'])
  assert.equal(firstSemester.state.committed, true)

  const secondSemester = semesterProgressionPool({ semester: '2nd Semester' })
  assert.equal(
    (await startNextSemester(
      secondSemester.pool,
      7,
      { academicYear: '2021-2022', semesterStartDate: '2021-08-01', semesterEndDate: '2021-12-15' },
      () => ({ program_duration_years: 4 })
    )).yearLevel,
    '2nd Year'
  )
  assert.deepEqual(secondSemester.state.inserts[0].slice(0, 7), [7, 430, '2021-2022', '2nd Year', '1st Semester', '2021-08-01', '2021-12-15'])
})

test('semester progression requires all three completed phases and stops after final year', async () => {
  const incomplete = semesterProgressionPool({ phases: ['Mid', 'End'] })
  await assert.rejects(
    startNextSemester(
      incomplete.pool,
      7,
      { academicYear: '2020-2021', semesterStartDate: '2021-01-10', semesterEndDate: '2021-05-20' },
      () => ({ program_duration_years: 4 })
    ),
    (error) => error.code === 'SEMESTER_NOT_COMPLETE' && error.status === 409
  )
  assert.equal(incomplete.state.inserts.length, 0)

  const finalSemester = semesterProgressionPool({
    yearLevel: '2nd Year',
    semester: '2nd Semester',
  })
  const completed = await startNextSemester(
    finalSemester.pool,
    7,
    {},
    () => ({ program_duration_years: 2 })
  )
  assert.deepEqual(completed, { created: false, programCompleted: true })
  assert.equal(finalSemester.state.inserts.length, 0)
})

test('semester progression safely reuses an already-created next term', async () => {
  const pending = semesterProgressionPool({ existingTermId: 22 })
  const result = await startNextSemester(
    pending.pool,
    7,
    { academicYear: '2020-2021', semesterStartDate: '2021-01-10', semesterEndDate: '2021-05-20' },
    () => ({ program_duration_years: 4 })
  )
  assert.deepEqual(result, {
    created: false,
    programCompleted: false,
    termId: 22,
    yearLevel: '1st Year',
    semester: '2nd Semester',
  })
  assert.equal(pending.state.inserts.length, 0)
})

test('semester cannot advance after the date alone or while End is missing', async () => {
  const endMissing = semesterProgressionPool({ phases: ['Early', 'Mid'] })
  await assert.rejects(
    startNextSemester(
      endMissing.pool,
      7,
      { academicYear: '2020-2021', semesterStartDate: '2021-01-10', semesterEndDate: '2021-05-20' },
      () => ({ program_duration_years: 4 })
    ),
    (error) => error.code === 'SEMESTER_NOT_COMPLETE'
  )

  const notEnded = semesterProgressionPool({ endDate: '2099-12-15' })
  await assert.rejects(
    startNextSemester(
      notEnded.pool,
      7,
      { academicYear: '2020-2021', semesterStartDate: '2021-01-10', semesterEndDate: '2021-05-20' },
      () => ({ program_duration_years: 4 })
    ),
    (error) => error.code === 'SEMESTER_NOT_COMPLETE'
  )
})

test('Third Semester and Summer require an explicit valid next academic stage', async () => {
  const summer = semesterProgressionPool({ semester: 'Summer', yearLevel: '2nd Year' })
  const result = await startNextSemester(
    summer.pool,
    7,
    {
      academicYear: '2021-2022',
      nextYearLevel: '3rd Year',
      nextSemester: '1st Semester',
      semesterStartDate: '2021-08-01',
      semesterEndDate: '2021-12-15',
    },
    () => ({ program_duration_years: 4 })
  )
  assert.deepEqual(result, {
    created: true,
    programCompleted: false,
    termId: 14,
    academicYear: '2021-2022',
    yearLevel: '3rd Year',
    semester: '1st Semester',
  })

  const invalid = semesterProgressionPool({ semester: '3rd Semester', yearLevel: '4th Year' })
  await assert.rejects(
    startNextSemester(
      invalid.pool,
      7,
      {
        academicYear: '2021-2022',
        nextYearLevel: '5th Year',
        nextSemester: '1st Semester',
        semesterStartDate: '2021-08-01',
        semesterEndDate: '2021-12-15',
      },
      () => ({ program_duration_years: 4 })
    ),
    (error) => error.code === 'INVALID_PROGRAM_STAGE'
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
          term_id: null,
          phase: 'Mid',
          academic_year: null,
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
  assert.equal(history[0].termId, null)
  assert.equal(history[0].academicYear, null)
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
    '/api/college/semester/advance',
    '/api/college/checkin/history',
  ]) {
    assert.match(serverSource, new RegExp(`app\\.(?:get|post)\\('${path.replaceAll('/', '\\/')}', authenticateToken`))
  }
})
