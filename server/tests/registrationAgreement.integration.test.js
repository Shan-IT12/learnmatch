import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import bcrypt from 'bcrypt'
import express from 'express'
import pool from '../config/db.js'
import authRoutes from '../routes/authRoutes.js'
import { createDeletionTestDatabase } from './helpers/accountDeletionDatabase.js'
import { TERMS_VERSION, PRIVACY_NOTICE_VERSION } from '../shared/legalDocuments.js'

test('registration agreement migration and HTTP registration/OTP/login on disposable localhost MySQL', async t => {
  const database = await createDeletionTestDatabase()
  const original = { query: pool.query, getConnection: pool.getConnection, fetch: global.fetch }
  const environment = Object.fromEntries(['JWT_SECRET', 'RESEND_API_KEY', 'RESEND_FROM_EMAIL'].map(key => [key, process.env[key]]))
  let server
  let sentCode
  let failMail = false
  try {
    // The source schema is cloned without records. Never alter the source database.
    const [columns] = await database.pool.query("SHOW COLUMNS FROM USER_ACCOUNT LIKE 'terms_version'")
    // Also supports a development source schema that has already been migrated.
    // These are empty cloned tables in the disposable DB, never the source tables.
    if (columns.length) await database.pool.query('ALTER TABLE USER_ACCOUNT DROP COLUMN terms_version, DROP COLUMN terms_accepted_at, DROP COLUMN privacy_notice_version')
    const legacyId = await database.insert('USER_ACCOUNT', { email: 'legacy@example.test', username: 'legacy_student', password: await bcrypt.hash('Password1', 4), is_active: 1 })
    await database.pool.query(await readFile(new URL('../migrations/20261025_add_registration_agreement.sql', import.meta.url), 'utf8'))
    await t.test('migration leaves pre-existing acceptance unknown and preserves account', async () => {
      const [[row]] = await database.pool.query('SELECT username, terms_version, terms_accepted_at, privacy_notice_version FROM USER_ACCOUNT WHERE user_id=?', [legacyId])
      assert.deepEqual(row, { username: 'legacy_student', terms_version: null, terms_accepted_at: null, privacy_notice_version: null })
    })
    pool.query = database.pool.query.bind(database.pool)
    pool.getConnection = database.pool.getConnection.bind(database.pool)
    process.env.JWT_SECRET = 'local-agreement-integration-secret'
    process.env.RESEND_API_KEY = 'synthetic-key'
    process.env.RESEND_FROM_EMAIL = 'local@example.test'
    global.fetch = async (url, options) => {
      assert.equal(url, 'https://api.resend.com/emails')
      if (failMail) return { ok: false, status: 503, text: async () => 'Synthetic provider failure' }
      sentCode = JSON.parse(options.body).html.match(/\b\d{6}\b/)?.[0]
      return { ok: true, json: async () => ({ id: 'synthetic-mail' }) }
    }
    const app = express()
    app.use(express.json())
    app.use('/api/auth', authRoutes)
    server = await new Promise(resolve => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)) })
    const post = async (path, body) => {
      const response = await original.fetch(`http://127.0.0.1:${server.address().port}/api/auth/${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      return { status: response.status, body: await response.json() }
    }
    const registration = { email: 'new@example.test', username: 'new_student', password: 'Password1', agreementAccepted: true, termsVersion: TERMS_VERSION, privacyNoticeVersion: PRIVACY_NOTICE_VERSION }
    await t.test('direct API rejects omitted, false, coerced and stale agreement before storing an account', async () => {
      const variants = [{ agreementAccepted: undefined }, { agreementAccepted: false }, { agreementAccepted: 'true' }, { agreementAccepted: 1 }, { termsVersion: undefined }, { termsVersion: 'old' }, { privacyNoticeVersion: undefined }, { privacyNoticeVersion: '1.2' }]
      for (const [index, variant] of variants.entries()) {
        const response = await post('register', { ...registration, email: `invalid${index}@example.test`, ...variant })
        assert.equal(response.status, 400)
        assert.match(response.body.message, /current Terms/)
      }
      assert.equal((await database.pool.query('SELECT COUNT(*) n FROM USER_ACCOUNT'))[0][0].n, 1)
      assert.equal((await database.pool.query('SELECT COUNT(*) n FROM OTP_VERIFICATION'))[0][0].n, 0)
    })
    let userId
    await t.test('accepted versions and server UTC timestamp persist atomically with the new account', async () => {
      const response = await post('register', { ...registration, termsAcceptedAt: '1900-01-01', terms_accepted_at: '1900-01-01' })
      assert.equal(response.status, 201)
      userId = response.body.userId
      const [[row]] = await database.pool.query('SELECT *, ABS(TIMESTAMPDIFF(SECOND, terms_accepted_at, UTC_TIMESTAMP())) age FROM USER_ACCOUNT WHERE user_id=?', [userId])
      assert.equal(row.terms_version, TERMS_VERSION)
      assert.equal(row.privacy_notice_version, PRIVACY_NOTICE_VERSION)
      assert.ok(row.terms_accepted_at)
      assert.ok(row.age < 10)
      assert.equal(row.is_active, 0)
      assert.ok(await bcrypt.compare(registration.password, row.password))
      assert.match(sentCode, /^\d{6}$/)
    })
    await t.test('OTP verification and login work without requiring agreement again', async () => {
      assert.equal((await post('verify-otp', { userId, otpCode: '000000' })).status, 400)
      const verified = await post('verify-otp', { userId, otpCode: sentCode })
      assert.equal(verified.status, 200)
      assert.ok(verified.body.token)
      assert.equal((await database.pool.query('SELECT COUNT(*) n FROM OTP_VERIFICATION WHERE user_id=?', [userId]))[0][0].n, 0)
      assert.equal((await post('login', { identifier: registration.email, password: registration.password })).status, 200)
      assert.equal((await post('login', { identifier: 'legacy_student', password: 'Password1' })).status, 200)
      const [[legacy]] = await database.pool.query('SELECT terms_version FROM USER_ACCOUNT WHERE user_id=?', [legacyId])
      assert.equal(legacy.terms_version, null)
    })
    await t.test('email failure removes the new account including its acceptance record', async () => {
      failMail = true
      const response = await post('register', { ...registration, email: 'mailfail@example.test', username: 'mail_failure' })
      assert.equal(response.status, 500)
      assert.equal((await database.pool.query("SELECT COUNT(*) n FROM USER_ACCOUNT WHERE email='mailfail@example.test'"))[0][0].n, 0)
      await database.assertIntegrity()
    })
  } finally {
    if (server) await new Promise(resolve => server.close(resolve))
    pool.query = original.query
    pool.getConnection = original.getConnection
    global.fetch = original.fetch
    for (const [key, value] of Object.entries(environment)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
    await database.close()
    await pool.end()
  }
})
