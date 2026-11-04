import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import { reminderTarget, manilaDay, canRetry, runReminders, listReminders } from '../services/checkinReminderService.js'
import { buildReminderEmail, reminderEmailConfig, sendReminderEmail } from '../services/reminderEmailService.js'
import { createCheckinReminderRouter } from '../routes/checkinReminderRoutes.js'
import { calculateSemesterTiming, buildPhaseStates, getNextSequentialCheckinPhase, calculateAlignmentResult, startNextCheckin } from '../services/collegeTrackingService.js'

const term = { term_id: 1, timing_mode: 'exact', dates_source: 'student_confirmed', semester_start_date: '2026-08-01', semester_end_date: '2026-11-09', initial_tracking_phase: 'Early', semester: '1st Semester', academic_year: '2026-2027' }
const date = day => new Date(`${day}T00:00:00+08:00`)
test('Manila midnight and upcoming/due/final boundaries', () => {
  assert.equal(manilaDay(new Date('2026-07-31T16:00:00Z')), '2026-08-01')
  for (const [day, stage] of [['2026-07-24', null], ['2026-07-25', 'upcoming'], ['2026-07-31', 'upcoming'], ['2026-08-01', 'due'], ['2026-08-07', 'due'], ['2026-08-08', 'overdue']]) {
    assert.equal(reminderTarget(term, [], date(day))?.stage || null, stage)
  }
})
test('phase targets follow existing 33/66 percent rules, sequential completion and initial phase', () => {
  const mid = reminderTarget(term, ['Early'], date('2026-09-04'))
  assert.equal(mid.dueDate, '2026-09-04')
  assert.equal(calculateSemesterTiming(term.semester_start_date, term.semester_end_date, new Date(`${mid.dueDate}T00:00:00Z`)).expectedPhase, 'Mid')
  const end = reminderTarget(term, ['Early', 'Mid'], date('2026-10-07'))
  assert.equal(end.dueDate, '2026-10-07')
  assert.equal(reminderTarget(term, ['Early', 'Mid', 'End']), null)
  assert.equal(reminderTarget({ ...term, initial_tracking_phase: 'End' }, [], date('2026-10-07')).phase, 'End')
  assert.equal(reminderTarget({ ...term, semester_end_date: '2026-08-31' }, ['Early'], date('2026-08-11')).dueDate, '2026-08-11')
})
test('missing, estimated, malformed and reversed dates do not create deadlines', () => {
  for (const changes of [{ semester_start_date: null }, { semester_end_date: '2026-02-30' }, { semester_end_date: '2026-01-01' }, { timing_mode: 'manual' }, { timing_mode: 'phase_only' }, { timing_mode: 'approximate' }, { dates_source: 'estimated' }]) assert.equal(reminderTarget({ ...term, ...changes }), null)
})
test('safe configuration and escaped branded email with no assessment fields', async () => {
  assert.equal(reminderEmailConfig({}).mode, 'dry-run')
  assert.throws(() => reminderEmailConfig({ CHECKIN_REMINDER_EMAIL_MODE: 'live' }))
  const payload = buildReminderEmail({ full_name: '<Student>', email: 'test@example.test', password: 'SECRET', score: 95 }, { title: 'Reminder', message: 'Check in', semester: '1st', phase: 'Early', dueDate: '2026-08-01' }, 7, { LEARNMATCH_PUBLIC_URL: 'https://learnmatch.example', RESEND_FROM_EMAIL: 'team@example.test' })
  assert.match(payload.html, /&lt;Student&gt;/)
  assert.match(payload.html, /checkin\?reminder=7/)
  assert.match(payload.html, /notifications=1/)
  assert.doesNotMatch(JSON.stringify(payload), /SECRET|score/)
  await assert.rejects(sendReminderEmail(payload, 'key', { env: {}, fetchImpl: () => assert.fail('Dry-run must not send') }))
  let headers
  const env = { CHECKIN_REMINDER_EMAIL_MODE: 'live', LEARNMATCH_PUBLIC_URL: 'https://learnmatch.example', RESEND_API_KEY: 'fake', RESEND_FROM_EMAIL: 'team@example.test' }
  await sendReminderEmail(payload, 'key', { env, fetchImpl: async (_url, options) => { headers = options.headers; return { ok: true, json: async () => ({ id: 'receipt' }) } } })
  assert.equal(headers['Idempotency-Key'], 'key')
})

// Stateful database double: persisted rows survive separate worker invocations.
// Real MySQL lock/constraint behavior needs the documented staging integration run.
function fixture() {
  const state = { completed: [], rows: [], enabled: 1, email: 'student@example.test', active: 1, locked: false, term: { ...term } }
  const db = {
    release() {}, async beginTransaction() { state.beforeDelivery?.() }, async commit() {}, async rollback() {},
    async query(sql, params = []) {
      if (sql.includes('GET_LOCK')) { const acquired = state.locked ? 0 : 1; state.locked = true; return [[{ acquired }]] }
      if (sql.includes('RELEASE_LOCK')) { state.locked = false; return [[]] }
      if (sql.includes('SELECT DISTINCT t.user_id')) return [[{ user_id: 2 }]]
      if (sql.includes('SELECT t.*')) return [state.active && state.term ? [state.term] : []]
      if (sql.includes('SELECT sc.phase')) return [state.completed.map(phase => ({ phase }))]
      if (sql.includes('INSERT INTO CHECKIN_REMINDER (')) {
        const key = params.join('|')
        if (!state.rows.some(r => r.key === key)) state.rows.push({ key, reminder_id: state.rows.length + 1, email_status: 'pending', attempts: 0 })
        return [{}]
      }
      if (sql.includes('TIMESTAMPDIFF')) return [[state.rows.find(r => r.key === params.join('|'))]]
      if (sql.includes('SELECT u.email')) return [[{ email: state.email, is_active: state.active, email_enabled: state.enabled, username: 'Test' }]]
      if (sql.includes('SELECT email, is_active')) return [[{ email: state.email, is_active: state.active }]]
      if (sql.includes('SELECT email_enabled')) return [[{ email_enabled: state.enabled }]]
      if (sql.includes("SET email_status = 'sending'")) {
        Object.assign(state.rows.find(r => r.reminder_id === params[1]), { email_status: 'sending', payload: params[0], first_attempt_at: 'persisted', attempt_age: 600, retry_age: 600 })
        state.rows.find(r => r.reminder_id === params[1]).attempts++
        return [{}]
      }
      if (sql.includes("SET email_status = 'sent'")) { state.rows.find(r => r.reminder_id === params[1]).email_status = 'sent'; return [{}] }
      if (sql.includes("SET email_status = 'review'")) { state.rows.find(r => r.reminder_id === params[0]).email_status = 'review'; return [{}] }
      if (sql.includes('FOR UPDATE')) return [[]]
      throw new Error(`Unhandled fixture query: ${sql}`)
    },
  }
  return { state, db, pool: { getConnection: async () => db } }
}
const options = { now: date('2026-08-01'), mode: 'live', buildPayload: user => ({ to: [user.email] }) }
test('repeated jobs and restart retain sent state, dry run does not consume delivery', async () => {
  const { state, pool } = fixture()
  let sends = 0
  const send = async () => { sends++; return { id: 'receipt' } }
  assert.equal((await runReminders(pool, { ...options, mode: 'dry-run', send })).dryRun, 1)
  assert.equal(state.rows[0].attempts, 0)
  await runReminders(pool, { ...options, send })
  await runReminders(pool, { ...options, send })
  assert.equal(sends, 1)
  assert.equal(state.rows.length, 1)
})
test('ambiguous failures retry identical payload/key, then stop before provider expiry', async () => {
  const { state, pool } = fixture()
  const calls = []
  const send = async (payload, key) => { calls.push([payload, key]); throw new Error('timeout') }
  assert.equal((await runReminders(pool, { ...options, send })).failed, 1)
  await runReminders(pool, { ...options, send })
  assert.deepEqual(calls[0], calls[1])
  state.rows[0].attempt_age = 23 * 3600
  assert.equal((await runReminders(pool, { ...options, send })).review, 1)
  assert.equal(calls.length, 2)
  assert.equal(canRetry({ email_status: 'sending', first_attempt_at: 'x', attempt_age: 600, retry_age: 10, attempts: 1 }), false)
})
test('completion, changed schedule, opt-out, invalid/unverified addresses and concurrent workers suppress delivery', async () => {
  for (const mutate of [s => { s.completed = ['Early', 'Mid', 'End'] }, s => { s.term.semester_start_date = '2026-10-01' }, s => { s.enabled = 0 }, s => { s.email = '' }, s => { s.email = 'invalid' }, s => { s.active = 0 }, s => { s.locked = true }]) {
    const { state, pool } = fixture()
    mutate(state)
    await runReminders(pool, { ...options, send: () => assert.fail('Must not send') })
  }
})
test('read state persists and completed reminders no longer appear pending', async () => {
  const { state, db } = fixture()
  // Use a term near today to exercise the API clock without patching global time.
  state.term.semester_start_date = manilaDay()
  state.term.semester_end_date = new Date(Date.parse(`${manilaDay()}T00:00:00Z`) + 100 * 86400000).toISOString().slice(0, 10)
  const first = await listReminders(db, 2)
  assert.equal(first.notifications.length, 1)
  state.rows[0].read_at = 'persisted'
  assert.equal((await listReminders(db, 2)).notifications[0].read, true)
  state.completed = ['Early', 'Mid', 'End']
  assert.deepEqual((await listReminders(db, 2)).notifications, [])
})
test('completion after claiming but before sending is rechecked', async () => {
  const { state, pool } = fixture()
  state.beforeDelivery = () => { state.completed = ['Early', 'Mid', 'End'] }
  const result = await runReminders(pool, { ...options, send: () => assert.fail('Completed check-in must not send') })
  assert.equal(result.sent, 0)
  assert.equal(result.failed, 0)
})
test('old notification cannot start a check-in in a newly advanced term', async () => {
  let rolledBack = false
  const db = { async beginTransaction() {}, release() {}, async rollback() { rolledBack = true }, async query() { return [[{ term_id: 99 }]] } }
  await assert.rejects(startNextCheckin({ getConnection: async () => db }, 2, { phase: 'Early', termId: 1 }), { code: 'STALE_REMINDER' })
  assert.equal(rolledBack, true)
})
test('HTTP routes require authentication and scope reads/actions to the authenticated owner', async () => {
  const queries = []
  const db = { query: async (sql, params) => { queries.push([sql, params]); return sql.startsWith('UPDATE') ? [{ affectedRows: 0 }] : [[]] } }
  const app = express()
  app.use(express.json())
  app.use('/notifications', createCheckinReminderRouter(db, (req, res, next) => { if (!req.headers.authorization) return res.sendStatus(401); req.user = { userId: 2 }; next() }))
  const server = app.listen(0, '127.0.0.1')
  await new Promise(resolve => server.once('listening', resolve))
  const base = `http://127.0.0.1:${server.address().port}/notifications`
  try {
    assert.equal((await fetch(base)).status, 401)
    const headers = { Authorization: 'test', 'Content-Type': 'application/json' }
    assert.equal((await fetch(`${base}/5/read`, { method: 'PATCH', headers, body: JSON.stringify({ userId: 99 }) })).status, 404)
    assert.deepEqual(queries.at(-1)[1], ['5', 2])
    assert.equal((await fetch(`${base}/5/open`, { method: 'POST', headers })).status, 404)
    assert.deepEqual(queries.at(-1)[1], ['5', 2])
    assert.equal((await fetch(`${base}/bad/read`, { method: 'PATCH', headers })).status, 400)
    assert.equal((await fetch(`${base}/preferences`, { method: 'PUT', headers, body: '{"emailEnabled":"false"}' })).status, 400)
  } finally { await new Promise(resolve => server.close(resolve)) }
})
test('college timing, phase sequence and alignment regression smoke checks', () => {
  assert.equal(getNextSequentialCheckinPhase(['Early']), 'Mid')
  assert.equal(buildPhaseStates(['Early'], { timingAvailable: false, expectedPhase: 'Mid' })[0].state, 'completed')
  assert.equal(calculateSemesterTiming(null, null).timingAvailable, false)
  const result = calculateAlignmentResult([1, 2, 3, 4, 5].map(question_number => ({ question_number, score: 5 })), { phase: 'End', gwa: 85 })
  assert.equal(result.alignmentPercent, 100)
  assert.equal(result.status, 'On Track')
})
