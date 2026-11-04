// Opt-in integration QA. Temporary tables shadow application tables only on
// this dedicated connection. No real student records or emails are touched.
import assert from 'node:assert/strict'
import express from 'express'
import pool from '../config/db.js'
import { runReminders, manilaDay } from '../services/checkinReminderService.js'
import { createCheckinReminderRouter } from '../routes/checkinReminderRoutes.js'

if (!['127.0.0.1', 'localhost'].includes(process.env.DB_HOST) || process.env.NODE_ENV === 'production') {
  throw new Error('This integration test requires a local development database')
}
const db = await pool.getConnection()
let server
let assertions = 0
const check = (actual, expected) => { assert.deepEqual(actual, expected); assertions++ }
const temporary = [
  ['USER_ACCOUNT', 'user_id INT PRIMARY KEY, username VARCHAR(80), email VARCHAR(255), is_active INT'],
  ['PROFILE', 'profile_id INT PRIMARY KEY, user_id INT, full_name VARCHAR(80)'],
  ['COLLEGE_TRACKING_CYCLE', 'tracking_cycle_id INT PRIMARY KEY, user_id INT, status VARCHAR(20)'],
  ['COLLEGE_TERM', 'term_id INT PRIMARY KEY, user_id INT, tracking_cycle_id INT, semester_start_date DATE, semester_end_date DATE, timing_mode VARCHAR(20), dates_source VARCHAR(40), initial_tracking_phase VARCHAR(10), semester VARCHAR(30), academic_year VARCHAR(10)'],
  ['SEMESTER_CHECKIN', 'checkin_id INT PRIMARY KEY, user_id INT, term_id INT, phase VARCHAR(10)'],
  ['CHECKIN_ALIGNMENT_RESPONSE', 'response_id INT PRIMARY KEY, checkin_id INT'],
]
try {
  for (const [table, columns] of temporary) await db.query(`CREATE TEMPORARY TABLE ${table} (${columns}) ENGINE=InnoDB`)
  for (const table of ['CHECKIN_REMINDER', 'CHECKIN_REMINDER_PREFERENCE']) {
    const [[schema]] = await db.query(`SHOW CREATE TABLE ${table}`)
    // Temporary InnoDB tables cannot have foreign keys. Keep actual columns,
    // indexes and types, but remove FK clauses from this isolated test copy.
    const ddl = schema['Create Table'].split('\n').filter(line => !line.trimStart().startsWith('CONSTRAINT')).join('\n')
      .replace('CREATE TABLE', 'CREATE TEMPORARY TABLE').replace(/,\n\)/, '\n)')
    await db.query(ddl)
  }
  await db.query("INSERT INTO USER_ACCOUNT VALUES (1,'fixture','fixture@example.test',1),(2,'other','other@example.test',1)")
  await db.query("INSERT INTO COLLEGE_TRACKING_CYCLE VALUES (1,1,'active')")
  const today = manilaDay()
  await db.query("INSERT INTO COLLEGE_TERM VALUES (1,1,1,?,DATE_ADD(?, INTERVAL 100 DAY),'exact','student_confirmed','Early','1st Semester','2026-2027')", [today, today])
  const connection = { query: db.query.bind(db), beginTransaction: db.beginTransaction.bind(db), commit: db.commit.bind(db), rollback: db.rollback.bind(db), release() {} }
  const fixturePool = { getConnection: async () => connection, query: connection.query }
  const app = express()
  app.use(express.json())
  app.use('/notifications', createCheckinReminderRouter(fixturePool, (req, res, next) => {
    if (!['1', '2'].includes(req.headers['x-test-user'])) return res.sendStatus(401)
    req.user = { userId: Number(req.headers['x-test-user']) }; next()
  }))
  server = app.listen(0, '127.0.0.1')
  await new Promise(resolve => server.once('listening', resolve))
  const url = `http://127.0.0.1:${server.address().port}/notifications`
  const request = async (path = '', method = 'GET', body, user = 1) => {
    const response = await fetch(url + path, { method, headers: { 'x-test-user': String(user), 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })
    return { status: response.status, body: await response.json() }
  }
  const first = await request()
  check(first.status, 200)
  check(first.body.notifications.length, 1)
  const id = first.body.notifications[0].id
  check((await request('/preferences', 'PUT', { emailEnabled: false })).body.emailEnabled, false)
  check((await request()).body.emailEnabled, false)
  check((await request('', 'GET', undefined, 2)).body.emailEnabled, true)
  check((await request(`/${id}/read`, 'PATCH', undefined, 2)).status, 404)
  check((await request(`/${id}/read`, 'PATCH')).status, 200)
  check((await request()).body.notifications[0].read, true)
  check((await request(`/${id}/open`, 'POST', undefined, 2)).status, 404)
  let sends = 0
  const calls = []
  const options = { mode: 'live', buildPayload: user => ({ to: [user.email], subject: 'Synthetic test' }), send: async (payload, key) => { sends++; calls.push({ payload, key }); return { id: 'mock-receipt' } } }
  await runReminders(fixturePool, options)
  check(sends, 0) // Opt-out enforced by the worker, not just the UI.
  await request('/preferences', 'PUT', { emailEnabled: true })
  check((await request()).body.emailEnabled, true)
  await runReminders(fixturePool, { ...options, mode: 'dry-run' })
  check(sends, 0)
  await runReminders(fixturePool, options)
  await runReminders(fixturePool, options)
  check(sends, 1)
  const [[receipt]] = await db.query('SELECT email_status, attempts, provider_id FROM CHECKIN_REMINDER WHERE reminder_id = ?', [id])
  check(receipt, { email_status: 'sent', attempts: 1, provider_id: 'mock-receipt' })
  const [[count]] = await db.query('SELECT COUNT(*) AS n FROM CHECKIN_REMINDER')
  check(count.n, 1)
  // Separate connection proves advisory lock exclusion in actual MySQL.
  const blocker = await pool.getConnection()
  try {
    await blocker.query("SELECT GET_LOCK('learnmatch-checkin-reminders', 0)")
    check((await runReminders(fixturePool, options)).busy, true)
  } finally { await blocker.query("SELECT RELEASE_LOCK('learnmatch-checkin-reminders')"); blocker.release() }
  // Advance test clock to overdue; its first attempt simulates an ambiguous failure.
  const later = new Date(`${today}T00:00:00+08:00`); later.setTime(later.getTime() + 7 * 86400000)
  let failedCall
  const failure = await runReminders(fixturePool, { ...options, now: later, send: async (payload, key) => { failedCall = { payload, key }; throw new Error('Mock timeout') } })
  check(failure.failed, 1)
  await db.query("UPDATE CHECKIN_REMINDER SET last_attempt_at = DATE_SUB(UTC_TIMESTAMP(), INTERVAL 6 MINUTE) WHERE stage = 'overdue'")
  await runReminders(fixturePool, { ...options, now: later })
  check(calls.at(-1), failedCall)
  await runReminders(fixturePool, { ...options, now: later })
  check(sends, 2)
  // Committed completion immediately removes pending UI/email eligibility.
  await db.query("INSERT INTO SEMESTER_CHECKIN VALUES (1,1,1,'Early')")
  await db.query('INSERT INTO CHECKIN_ALIGNMENT_RESPONSE VALUES (1,1)')
  check((await request()).body.notifications.length, 0)
  await runReminders(fixturePool, { ...options, now: later })
  check(sends, 2)
  check((await request(`/${id}/open`, 'POST')).status, 409)
  console.log(JSON.stringify({ result: 'PASS', assertions, realEmails: 0, realStudentWrites: 0, storage: 'connection-local temporary MySQL tables' }))
} finally {
  if (server) await new Promise(resolve => server.close(resolve))
  db.destroy() // MySQL automatically removes all temporary test tables.
  await pool.end()
}
