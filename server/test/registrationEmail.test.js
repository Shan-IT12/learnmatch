import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import pool from '../config/db.js'
import router from '../routes/authRoutes.js'
import { normalizeRegistrationEmail, isDisposableEmail, DISPOSABLE_EMAIL_MESSAGE } from '../services/registrationEmailService.js'
import { TERMS_VERSION, PRIVACY_NOTICE_VERSION } from '../shared/legalDocuments.js'

test('known disposable domains and their subdomains are blocked', () => {
  for (const email of ['user@mailinator.com', 'user@10minutemail.com', 'user@guerrillamail.com', ' User+tag@MAILINATOR.COM ', 'user@sub.mailinator.com', 'user@ｍａｉｌｉｎａｔｏｒ.com', 'user@mailinator。com']) {
    assert.equal(isDisposableEmail(email), true, email)
  }
})

test('supplemental domains are blocked independently of the upstream snapshot', () => {
  for (const email of ['sanaxi3112@macsnipe.com', ' User@MACSNIPE.COM ', 'user@sub.macsnipe.com', 'pihow56573@javafs.com', ' User+tag@JAVAFS.COM ', 'user@sub.javafs.com', 'user@javafs\u3002com']) {
    assert.equal(isDisposableEmail(email), true, email)
  }
  assert.equal(isDisposableEmail('user@notjavafs.com'), false)
  assert.equal(isDisposableEmail('user@javafs.com.example'), false)
})

test('personal, work, educational and unknown domains remain allowed', () => {
  for (const domain of ['gmail.com', 'outlook.com', 'yahoo.com', 'icloud.com', 'proton.me', 'protonmail.com', 'company.example', 'up.edu.ph', 'student.mit.edu', 'unknown-provider.example', 'learnmatch-test-mailinator.com', 'mailinator.com.example']) {
    assert.equal(isDisposableEmail(`User+tag@${domain}`), false, domain)
  }
})

test('normalization preserves mailbox identity and canonicalizes IDN domains', () => {
  assert.equal(normalizeRegistrationEmail(' User.Name+Tag@GMAIL.COM '), 'User.Name+Tag@gmail.com')
  assert.equal(normalizeRegistrationEmail('User@bücher.de'), 'User@xn--bcher-kva.de')
  for (const value of [null, {}, ['user@gmail.com'], 123, 'a@@gmail.com', 'a@ gmail.com', 'a\n@gmail.com', 'a@mailinator.com.', 'a@%6dailinator.com', 'a@-gmail.com', 'a@foo..com', 'a@foo.com/path']) {
    assert.equal(normalizeRegistrationEmail(value), null, String(value))
  }
})

test('direct registration API enforces policy before DB or mail and preserves OTP flow', async (t) => {
  const app = express()
  app.use(express.json())
  app.use('/api/auth', router)
  const server = app.listen(0, '127.0.0.1')
  await new Promise(resolve => server.once('listening', resolve))
  t.after(() => new Promise(resolve => server.close(resolve)))
  const request = globalThis.fetch
  const queries = []
  const mail = []
  t.mock.method(pool, 'query', async (sql, params) => {
    queries.push({ sql, params })
    return sql.includes('SELECT') ? [[]] : [{ insertId: 42 }]
  })
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://api.resend.com/emails')
    mail.push(JSON.parse(options.body))
    return { ok: true, json: async () => ({ id: 'test' }) }
  })
  const oldKey = process.env.RESEND_API_KEY
  const oldFrom = process.env.RESEND_FROM_EMAIL
  process.env.RESEND_API_KEY = 'test'
  process.env.RESEND_FROM_EMAIL = 'test@example.com'
  t.after(() => {
    if (oldKey === undefined) delete process.env.RESEND_API_KEY
    else process.env.RESEND_API_KEY = oldKey
    if (oldFrom === undefined) delete process.env.RESEND_FROM_EMAIL
    else process.env.RESEND_FROM_EMAIL = oldFrom
  })
  const post = (email) => request(`http://127.0.0.1:${server.address().port}/api/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, username: 'test_student', password: 'Password123', agreementAccepted: true, termsVersion: TERMS_VERSION, privacyNoticeVersion: PRIVACY_NOTICE_VERSION, isDisposable: false }),
  })
  for (const email of ['user@mailinator.com', ' User@MAILINATOR.COM ', 'user@sub.mailinator.com', 'user@ｍａｉｌｉｎａｔｏｒ.com']) {
    const response = await post(email)
    assert.equal(response.status, 400)
    assert.deepEqual(await response.json(), { code: 'DISPOSABLE_EMAIL', message: DISPOSABLE_EMAIL_MESSAGE })
  }
  for (const email of ['sanaxi3112@macsnipe.com', ' User@MACSNIPE.COM ', 'user@sub.macsnipe.com', 'pihow56573@javafs.com', ' User+tag@JAVAFS.COM ', 'user@sub.javafs.com', 'user@javafs\u3002com']) {
    const response = await post(email)
    assert.equal(response.status, 400)
    assert.deepEqual(await response.json(), { code: 'DISPOSABLE_EMAIL', message: DISPOSABLE_EMAIL_MESSAGE })
  }
  assert.equal((await post(['user@gmail.com'])).status, 400)
  assert.equal(queries.length, 0)
  assert.equal(mail.length, 0)
  const response = await post(' User.Name+Tag@GMAIL.COM ')
  assert.equal(response.status, 201)
  assert.equal((await response.json()).email, 'User.Name+Tag@gmail.com')
  assert.equal(queries[0].params[0], 'User.Name+Tag@gmail.com')
  assert.equal(queries.find(query => query.sql.includes('INSERT INTO USER_ACCOUNT')).params[0], 'User.Name+Tag@gmail.com')
  assert.ok(queries.some(query => query.sql.includes('INSERT INTO OTP_VERIFICATION')))
  assert.deepEqual(mail[0].to, ['User.Name+Tag@gmail.com'])
  assert.match(mail[0].subject, /Verification Code/)
})
