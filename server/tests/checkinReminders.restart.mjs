import 'dotenv/config'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import mysql from 'mysql2/promise'
import { manilaDay } from '../services/checkinReminderService.js'

if (!['localhost', '127.0.0.1'].includes(process.env.DB_HOST) || process.env.NODE_ENV === 'production') throw new Error('Local development database required')
const database = `learnmatch_reminder_qa_${randomBytes(6).toString('hex')}`
const db = await mysql.createConnection({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT) || 3306, user: process.env.DB_USER, password: process.env.DB_PASSWORD })
const accepted = new Map()
let requests = 0
let providerError
const provider = createServer(async (req, res) => {
  try {
  let raw = ''
  for await (const chunk of req) raw += chunk
  const payload = JSON.parse(raw)
  assert.deepEqual(payload.to, ['fixture@example.test'])
  const key = req.headers['idempotency-key']
  assert.ok(key)
  requests++
  if (accepted.has(key)) assert.equal(accepted.get(key).raw, raw)
  else accepted.set(key, { raw, id: `mock-${accepted.size + 1}` })
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ id: accepted.get(key).id }))
  } catch (error) {
    providerError = error
    res.writeHead(409, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Mock provider payload mismatch' }))
  }
})
let assertions = 0
const check = (actual, expected) => { assert.deepEqual(actual, expected); assertions++ }
try {
  // Only additive SQL. A unique, synthetic QA database is retained for review.
  await db.query(`CREATE DATABASE \`${database}\``)
  await db.query(`USE \`${database}\``)
  const definitions = [
    ['USER_ACCOUNT', 'user_id INT PRIMARY KEY, username VARCHAR(80), email VARCHAR(255), is_active INT'],
    ['PROFILE', 'profile_id INT PRIMARY KEY, user_id INT, full_name VARCHAR(80)'],
    ['COLLEGE_TRACKING_CYCLE', 'tracking_cycle_id INT PRIMARY KEY, user_id INT, status VARCHAR(20)'],
    ['COLLEGE_TERM', 'term_id INT PRIMARY KEY, user_id INT, tracking_cycle_id INT, semester_start_date DATE, semester_end_date DATE, timing_mode VARCHAR(20), dates_source VARCHAR(40), initial_tracking_phase VARCHAR(10), semester VARCHAR(30), academic_year VARCHAR(10)'],
    ['SEMESTER_CHECKIN', 'checkin_id INT PRIMARY KEY, user_id INT, term_id INT, phase VARCHAR(10)'],
    ['CHECKIN_ALIGNMENT_RESPONSE', 'response_id INT PRIMARY KEY, checkin_id INT'],
  ]
  for (const [table, columns] of definitions) await db.query(`CREATE TABLE ${table} (${columns}) ENGINE=InnoDB`)
  const migration = await readFile(new URL('../migrations/20261104_add_checkin_reminders.sql', import.meta.url), 'utf8')
  for (const sql of migration.split(';').map(s => s.trim()).filter(Boolean)) await db.query(sql)
  await db.query("INSERT INTO USER_ACCOUNT VALUES (1,'fixture','fixture@example.test',1)")
  await db.query("INSERT INTO COLLEGE_TRACKING_CYCLE VALUES (1,1,'active')")
  const today = manilaDay()
  await db.query("INSERT INTO COLLEGE_TERM VALUES (1,1,1,?,DATE_ADD(?,INTERVAL 100 DAY),'exact','student_confirmed','Early','1st Semester','2026-2027')", [today, today])
  provider.listen(0, '127.0.0.1')
  await new Promise(resolve => provider.once('listening', resolve))
  const env = { ...process.env, DB_NAME: database, NODE_ENV: 'test', CHECKIN_REMINDER_EMAIL_MODE: 'dry-run', REMINDER_QA_PROVIDER_URL: `http://127.0.0.1:${provider.address().port}/emails` }
  // Empty values prevent dotenv from loading real provider credentials in children.
  env.RESEND_API_KEY = ''; env.RESEND_FROM_EMAIL = ''
  const run = (script, additions = {}) => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script], { cwd: new URL('..', import.meta.url), env: { ...env, ...additions }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''; let stderr = ''
    const timer = setTimeout(() => { child.kill(); reject(new Error('QA child did not exit within 20 seconds')) }, 20000)
    child.stdout.on('data', data => { stdout += data })
    child.stderr.on('data', data => { stderr += data })
    child.on('error', error => { clearTimeout(timer); reject(error) })
    child.on('exit', code => { clearTimeout(timer); resolve({ code, stdout, stderr }) })
  })
  const cron = await run('scripts/runCheckinReminders.mjs')
  check(cron.code, 0)
  check(cron.stdout.includes('"dryRun":1'), true)
  check(requests, 0)
  const crash = await run('tests/fixtures/reminderRestartWorker.mjs', { REMINDER_QA_CRASH: 'after-acceptance' })
  check(crash.code, 86)
  const [[claimed]] = await db.query('SELECT email_status, attempts, provider_id FROM CHECKIN_REMINDER')
  check(claimed, { email_status: 'sending', attempts: 1, provider_id: null })
  check(accepted.size, 1)
  // Advance only the synthetic retry timestamp, avoiding a real 5-minute wait.
  await db.query('UPDATE CHECKIN_REMINDER SET last_attempt_at = DATE_SUB(UTC_TIMESTAMP(), INTERVAL 6 MINUTE)')
  const recovered = await run('tests/fixtures/reminderRestartWorker.mjs')
  check(recovered.code, 0)
  const [[sent]] = await db.query('SELECT email_status, attempts, provider_id FROM CHECKIN_REMINDER')
  check(sent, { email_status: 'sent', attempts: 2, provider_id: 'mock-1' })
  check(requests, 2)
  check(accepted.size, 1) // Provider accepted the same stable key only once.
  check(providerError, undefined)
  check((await run('tests/fixtures/reminderRestartWorker.mjs')).code, 0)
  check(requests, 2)
  // Completion survives another fresh process and suppresses further work.
  await db.query("INSERT INTO SEMESTER_CHECKIN VALUES (1,1,1,'Early')")
  await db.query('INSERT INTO CHECKIN_ALIGNMENT_RESPONSE VALUES (1,1)')
  const completed = await run('tests/fixtures/reminderRestartWorker.mjs')
  check(completed.code, 0)
  check(completed.stdout.includes('"considered":0'), true)
  check(requests, 2)
  console.log(JSON.stringify({ result: 'PASS', assertions, mockProviderRequests: requests, mockProviderAcceptances: accepted.size, realEmails: 0, retainedLocalQaDatabase: database }))
} finally {
  await db.end()
  if (provider.listening) await new Promise(resolve => provider.close(resolve))
}
