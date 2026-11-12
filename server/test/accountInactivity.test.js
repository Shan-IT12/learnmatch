import test from 'node:test'
import assert from 'node:assert/strict'
import bcrypt from 'bcrypt'
import pool from '../config/db.js'
import { loginUser, verifyOtp } from '../controllers/authController.js'
import { inactivityAction, recordSuccessfulLogin, runInactivityChecks } from '../services/accountInactivityService.js'
import { buildInactivityEmail, inactivityEmailConfig, sendInactivityEmail } from '../services/inactivityEmailService.js'

const DAY = 86400000
const stamp = ms => new Date(ms).toISOString().replace('T', ' ').replace('Z', '')
const start = Date.UTC(2026, 0, 1)
const account = () => ({ user_id: 1, email: 'student@example.com', is_active: 1,
  inactivity_tracking_started_at: stamp(start), last_successful_login_at: null,
  inactivity_generation: 0, inactivity_warning_sent_at: null, inactivity_delete_after: null,
  inactivity_final_sent_at: null, inactivity_eligible_at: null })

// Stateful database double exercises the job, committed claims, rollback, and
// generation races. Real MySQL locking/cascade verification remains a rollout gate.
function fixture() {
  const f = { user: account(), emails: [], now: start + 365 * DAY, locked: false, deliveries: [], sql: [] }
  let snapshot
  const db = {
    async query(input, params = []) {
      const sql = typeof input === 'string' ? input : input.sql
      f.sql.push(sql)
      if (sql.includes('GET_LOCK')) { if (f.locked) return [[{ acquired: 0 }]]; f.locked = true; return [[{ acquired: 1 }]] }
      if (sql.includes('RELEASE_LOCK')) { f.locked = false; return [[{}]] }
      if (sql.startsWith('SELECT user_id FROM USER_ACCOUNT')) return [[{ user_id: 1 }]]
      if (sql.includes('AS job_now')) {
        assert.equal(input.dateStrings, true)
        return [[{ ...f.user, job_now: stamp(f.now) }]]
      }
      if (sql.startsWith('INSERT INTO ACCOUNT_INACTIVITY_EMAIL')) {
        if (!f.emails.some(r => r.generation === params[1] && r.stage === params[2])) f.emails.push({ email_id: f.emails.length + 1, generation: params[1], stage: params[2], email_status: 'pending', attempts: 0, first_attempt_at: null })
        return [{}]
      }
      if (sql.includes('FROM ACCOUNT_INACTIVITY_EMAIL WHERE')) {
        const r = f.emails.find(r => r.generation === params[1] && r.stage === params[2])
        return [[{ ...r, attempt_age: (f.now - r.first_attempt_at) / 1000, retry_age: (f.now - r.last_attempt_at) / 1000 }]]
      }
      if (sql.startsWith('UPDATE ACCOUNT_INACTIVITY_EMAIL')) {
        const r = f.emails.find(r => r.email_id === params.at(-1))
        if (sql.includes("= 'review'")) r.email_status = 'review'
        if (sql.includes("= 'sending'")) Object.assign(r, { email_status: 'sending', attempts: r.attempts + 1, first_attempt_at: r.first_attempt_at ?? f.now, last_attempt_at: f.now, payload: params[0] })
        if (sql.includes("= 'sent'")) Object.assign(r, { email_status: 'sent', provider_id: params[0] })
        return [{}]
      }
      if (sql.startsWith('UPDATE USER_ACCOUNT')) {
        if (sql.includes('last_successful_login_at =')) {
          assert.match(sql, /UTC_TIMESTAMP\(3\)/)
          Object.assign(f.user, { last_successful_login_at: stamp(f.now), inactivity_generation: f.user.inactivity_generation + 1,
            inactivity_warning_sent_at: null, inactivity_delete_after: null, inactivity_final_sent_at: null, inactivity_eligible_at: null })
        } else if (sql.includes('inactivity_warning_sent_at =')) Object.assign(f.user, { inactivity_warning_sent_at: stamp(f.now), inactivity_delete_after: stamp(f.now + 30 * DAY) })
        else if (sql.includes('inactivity_final_sent_at =')) Object.assign(f.user, { inactivity_final_sent_at: stamp(f.now), inactivity_delete_after: stamp(Math.max(Date.parse(f.user.inactivity_delete_after.replace(' ', 'T') + 'Z'), f.now + 7 * DAY)) })
        else if (sql.includes('inactivity_eligible_at =')) f.user.inactivity_eligible_at = stamp(f.now)
        else assert.fail(sql)
        return [{ affectedRows: 1 }]
      }
      assert.fail(`Unhandled SQL: ${sql}`)
    },
    async beginTransaction() {
      if (f.beforeLock) { const hook = f.beforeLock; f.beforeLock = null; await hook() }
      snapshot = structuredClone({ user: f.user, emails: f.emails })
    },
    async commit() { snapshot = null },
    async rollback() { if (snapshot) { Object.assign(f, snapshot); snapshot = null } },
    release() {},
  }
  f.db = db
  f.pool = { async getConnection() { return db } }
  f.run = options => runInactivityChecks(f.pool, { mode: 'live',
    buildPayload: (u, stage) => ({ to: [u.email], subject: stage }),
    send: async (payload, key) => { f.deliveries.push({ payload, key }); return { id: key } }, ...options })
  return f
}

test('365-day boundary, unknown history, unverified and active accounts', () => {
  const u = account()
  assert.equal(inactivityAction(u, start + 365 * DAY - 1), null)
  assert.equal(inactivityAction(u, start + 365 * DAY), 'warning')
  assert.equal(inactivityAction(u, NaN), null)
  assert.equal(inactivityAction({ ...u, inactivity_tracking_started_at: null }, start + 500 * DAY), null)
  assert.equal(inactivityAction({ ...u, is_active: 0 }, start + 500 * DAY), null)
  assert.equal(inactivityAction({ ...u, last_successful_login_at: stamp(start + 364 * DAY) }, start + 500 * DAY), null)
})

test('warning, final reminder, duplicate execution, exact eligibility boundary', async () => {
  const f = fixture()
  assert.equal((await f.run()).sent, 1)
  assert.equal(f.user.inactivity_delete_after, stamp(start + 395 * DAY))
  assert.equal((await f.run()).sent, 0)
  f.now = start + 388 * DAY - 1
  assert.equal((await f.run()).sent, 0)
  f.now++
  assert.equal((await f.run()).sent, 1)
  assert.equal((await f.run()).sent, 0)
  f.now = start + 395 * DAY - 1
  assert.equal((await f.run()).eligible, 0)
  f.now++
  assert.equal((await f.run()).eligible, 1)
  assert.equal((await f.run()).eligible, 0)
  assert.equal(f.deliveries.length, 2)
  assert.ok(f.sql.every(sql => !/DELETE FROM/.test(sql)))
})

test('delayed final reminder extends deadline and failed delivery cannot confer eligibility', async () => {
  const f = fixture()
  await f.run()
  f.now += 40 * DAY
  assert.equal((await f.run({ send: async () => { throw new Error('timeout') } })).failed, 1)
  assert.equal(f.user.inactivity_final_sent_at, null)
  assert.equal(f.user.inactivity_eligible_at, null)
  f.now += 5 * 60000
  assert.equal((await f.run()).sent, 1)
  assert.equal(f.user.inactivity_delete_after, stamp(f.now + 7 * DAY))
})

test('ambiguous retry retains key/payload; expired retry goes to review', async () => {
  const f = fixture()
  let attempted
  await f.run({ send: async (payload, key) => { attempted = { payload, key }; throw new Error('lost receipt') } })
  assert.equal(f.user.inactivity_warning_sent_at, null)
  assert.equal((await f.run()).sent, 0)
  f.now += 5 * 60000
  await f.run()
  assert.deepEqual(f.deliveries[0], attempted)
  const g = fixture()
  await g.run({ send: async () => { throw new Error('timeout') } })
  g.now += 23 * 3600000
  assert.equal((await g.run()).review, 1)
  assert.equal((await g.run()).review, 1)
  assert.equal(g.deliveries.length, 0)
})

test('successful login cancels all states, including eligibility and stale claimed work', async () => {
  for (const stage of ['warning', 'final', 'eligible']) {
    const f = fixture()
    await f.run()
    if (stage !== 'warning') { f.now += 23 * DAY; await f.run() }
    if (stage === 'eligible') { f.now += 7 * DAY; await f.run() }
    await recordSuccessfulLogin(f.db, 1)
    assert.equal(f.user.last_successful_login_at, stamp(f.now))
    assert.equal(f.user.inactivity_generation, 1)
    for (const k of ['inactivity_warning_sent_at', 'inactivity_delete_after', 'inactivity_final_sent_at', 'inactivity_eligible_at']) assert.equal(f.user[k], null)
    assert.equal((await f.run()).considered, 0)
  }
  const f = fixture()
  f.beforeLock = () => recordSuccessfulLogin(f.db, 1)
  assert.equal((await f.run()).sent, 0)
  assert.equal(f.deliveries.length, 0)
  assert.equal(f.user.last_successful_login_at, stamp(f.now))
})

test('overlapping jobs skip, dry-run has no writes, active users receive no email', async () => {
  const f = fixture()
  f.locked = true
  assert.equal((await f.run()).busy, true)
  f.locked = false
  assert.equal((await f.run({ mode: 'dry-run' })).dryRun, 1)
  assert.equal(f.emails.length, 0)
  assert.equal(f.user.inactivity_warning_sent_at, null)
  f.user.last_successful_login_at = stamp(f.now)
  assert.equal((await f.run()).sent, 0)
})

test('login controller records only successful authentication and ignores supplied timestamps', async t => {
  const password = await bcrypt.hash('Password123', 4)
  const updates = []
  let active = 1
  t.mock.method(pool, 'query', async (sql, params) => {
    if (sql.includes('SELECT')) return [[{ user_id: 1, username: 'student', password, is_active: active }]]
    updates.push({ sql, params }); return [{ affectedRows: 1 }]
  })
  const oldSecret = process.env.JWT_SECRET
  process.env.JWT_SECRET = 'test-only-secret'
  t.after(() => { if (oldSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = oldSecret })
  const invoke = async pw => {
    const res = { statusCode: 200, status(code) { this.statusCode = code; return this }, json(body) { this.body = body; return this } }
    await loginUser({ body: { identifier: 'student', password: pw, last_successful_login_at: '2099-01-01' } }, res)
    return res
  }
  assert.equal((await invoke('wrong')).statusCode, 400)
  active = 0
  assert.equal((await invoke('Password123')).statusCode, 403)
  assert.equal(updates.length, 0)
  active = 1
  assert.equal((await invoke('Password123')).statusCode, 200)
  assert.equal(updates.length, 1)
  assert.deepEqual(updates[0].params, [1])
  assert.match(updates[0].sql, /UTC_TIMESTAMP\(3\)/)
})

test('independent mail mode, HTTPS validation, and existing idempotent transport', async () => {
  assert.equal(inactivityEmailConfig({ CHECKIN_REMINDER_EMAIL_MODE: 'live' }).mode, 'dry-run')
  assert.throws(() => inactivityEmailConfig({ INACTIVITY_EMAIL_MODE: 'live', LEARNMATCH_PUBLIC_URL: 'http://example.com' }))
  const env = { INACTIVITY_EMAIL_MODE: 'live', LEARNMATCH_PUBLIC_URL: 'https://example.com', RESEND_API_KEY: 'test', RESEND_FROM_EMAIL: 'learnmatch@example.com' }
  const payload = buildInactivityEmail(account(), 'warning', env)
  assert.match(payload.text, /30-day/)
  assert.match(buildInactivityEmail(account(), 'final', env).text, /7 days/)
  await sendInactivityEmail(payload, 'stable-key', { env, fetchImpl: async (url, options) => {
    assert.equal(options.headers['Idempotency-Key'], 'stable-key')
    assert.equal(JSON.parse(options.body).to[0], 'student@example.com')
    return { ok: true, json: async () => ({ id: 'receipt' }) }
  } })
})

test('initial OTP authentication records login in the activation transaction', async t => {
  const operations = []
  const db = {
    async beginTransaction() { operations.push('begin') },
    async commit() { operations.push('commit') },
    async rollback() { operations.push('rollback') },
    release() {},
    async query(sql) {
      operations.push(sql)
      if (sql.includes('SELECT user_id')) return [[{ user_id: 1, username: 'student', password: 'synthetic-password-hash', is_active: 0 }]]
      if (sql.includes('SELECT otp_id')) return [[{ otp_id: 1, otp_code: '123456', failed_attempts: 0, expires_at: new Date(Date.now() + 60000) }]]
      return [{ affectedRows: 1 }]
    },
  }
  t.mock.method(pool, 'getConnection', async () => db)
  const oldSecret = process.env.JWT_SECRET
  process.env.JWT_SECRET = 'test-only-secret'
  t.after(() => { if (oldSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = oldSecret })
  const res = { status(code) { this.code = code; return this }, json(body) { this.body = body; return this } }
  await verifyOtp({ body: { userId: 1, otpCode: '123456' } }, res)
  assert.ok(res.body.token)
  const recorded = operations.findIndex(sql => sql.includes('last_successful_login_at ='))
  assert.ok(recorded > operations.findIndex(sql => sql.includes('SET is_active = 1')))
  assert.ok(recorded < operations.indexOf('commit'))
  assert.ok(!operations.includes('rollback'))
})
