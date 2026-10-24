import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { createDeletionTestDatabase } from './helpers/accountDeletionDatabase.js'
import { createAccountRouter } from '../routes/accountRoutes.js'
import { deleteStudentAccount, STUDENT_TABLES } from '../services/accountDeletionService.js'
import { jwtSignOptions, USER_JWT_AUDIENCE, ADMIN_JWT_AUDIENCE, RESET_JWT_AUDIENCE } from '../config/security.js'

test('student deletion on a disposable localhost schema', { skip: process.env.ACCOUNT_DELETION_DB_TEST !== '1' }, async t => {
  const db = await createDeletionTestDatabase()
  Object.assign(process.env, { DB_HOST: db.config.host, DB_PORT: String(db.config.port), DB_USER: db.config.user,
    DB_PASSWORD: db.config.password, DB_NAME: db.name, JWT_SECRET: 'synthetic-deletion-test-secret', NODE_ENV: 'test' })
  // Import existing authentication only AFTER directing its pool to the disposable DB.
  const { default: authPool } = await import('../config/db.js')
  const { default: authenticateToken } = await import('../middleware/authenticateToken.js')
  const { loginUser, resetPassword } = await import('../controllers/authController.js')
  const password = 'SyntheticPassword1!'
  const hash = await bcrypt.hash(password, 4)
  const app = express()
  app.use('/api/account', createAccountRouter(db.pool, authenticateToken))
  app.use(express.json())
  app.post('/api/auth/login', loginUser)
  app.post('/api/auth/reset', resetPassword)
  app.get('/api/protected', authenticateToken, (_req, res) => res.json({ allowed: true }))
  const server = app.listen(0, '127.0.0.1')
  await new Promise(resolve => server.once('listening', resolve))
  const base = `http://127.0.0.1:${server.address().port}`
  const token = (id, audience = USER_JWT_AUDIENCE, expiresIn = '5m', extra = {}) => jwt.sign({ userId: id, ...extra }, process.env.JWT_SECRET, jwtSignOptions(audience, expiresIn))
  const request = (authorization, body = { currentPassword: password, confirmation: 'DELETE' }, headers = {}) => fetch(`${base}/api/account`, {
    method: 'DELETE', headers: { 'Content-Type': 'application/json', ...(authorization ? { Authorization: `Bearer ${authorization}` } : {}), ...headers }, body: JSON.stringify(body),
  })
  let serial = 0
  let shared
  const seed = async () => {
    serial++
    const userId = await db.insert('user_account', { username: `synthetic${serial}`, email: `synthetic${serial}@example.invalid`, password: hash, is_active: 1 })
    const personality = await db.insert('personality_assessment', { user_id: userId })
    const recommendation = await db.insert('recommendation', { user_id: userId, assessment_id: personality })
    const cycle = await db.insert('college_tracking_cycle', { user_id: userId, course_id: shared.course })
    const term = await db.insert('college_term', { user_id: userId, course_id: shared.course, tracking_cycle_id: cycle, academic_year: '2026-2027' })
    const checkin = await db.insert('semester_checkin', { user_id: userId, course_id: shared.course, term_id: term })
    const attempt = await db.insert('assessment_attempt', { user_id: userId, personality_assessment_id: personality, personal_factors: '{}', skill_answers: '[]', personality_answers: '[]' })
    await db.insert('recommendation_item', { recommendation_id: recommendation, course_id: shared.course })
    await db.insert('checkin_alignment_response', { checkin_id: checkin })
    await db.insert('ai_mismatch_analysis', { checkin_id: checkin })
    for (const table of ['profile', 'feedback', 'interest_response']) await db.insert(table, { user_id: userId })
    for (const table of ['career_roadmap', 'saved_course']) await db.insert(table, { user_id: userId, course_id: shared.course })
    await db.insert('skill_response', { user_id: userId, question_id: shared.question })
    const otp = await db.insert('otp_verification', { user_id: userId, otp_code: '123456', expires_at: new Date(Date.now() + 600000) })
    return { userId, personality, recommendation, checkin, attempt, otp, token: token(userId), username: `synthetic${serial}` }
  }
  try {
    shared = { admin: await db.insert('admin', { password_hash: hash }) }
    shared.course = await db.insert('course')
    shared.question = await db.insert('question', { admin_id: shared.admin })
    shared.school = await db.insert('school')
    await db.insert('school_course', { school_id: shared.school, course_id: shared.course })
    await db.insert('career_opportunity', { course_id: shared.course })
    const unrelated = await seed()
    await t.test('explicit deletion inventory covers the entire student FK graph', async () => {
      const graph = new Set(['user_account'])
      let changed = true
      while (changed) {
        changed = false
        for (const fk of db.foreignKeys) if (graph.has(fk.parent) && !graph.has(fk.child)) { graph.add(fk.child); changed = true }
      }
      assert.deepEqual([...graph].sort(), ['user_account', ...STUDENT_TABLES.map(table => table.toLowerCase()), 'recommendation_item', 'checkin_alignment_response', 'ai_mismatch_analysis'].sort())
    })
    await t.test('rejects invalid password, missing confirmation, supplied target and malformed body without changes', async () => {
      const student = await seed()
      const before = await db.snapshot()
      for (const body of [
        { currentPassword: 'WrongPassword1', confirmation: 'DELETE' },
        { currentPassword: password },
        { currentPassword: password, confirmation: 'DELETE', userId: unrelated.userId },
        { currentPassword: {}, confirmation: 'DELETE' },
      ]) assert.equal((await request(student.token, body)).status, 400)
      assert.deepEqual(await db.snapshot(), before)
    })
    await t.test('rejects absent, invalid, expired, reset and admin tokens', async () => {
      const student = await seed()
      for (const value of [null, 'invalid', token(student.userId, USER_JWT_AUDIENCE, '-1s'), token(student.userId, RESET_JWT_AUDIENCE), token(student.userId, ADMIN_JWT_AUDIENCE, '5m', { role: 'admin', adminId: shared.admin })]) {
        assert.ok([401, 403].includes((await request(value)).status))
      }
      assert.equal((await db.pool.query('SELECT COUNT(*) n FROM ADMIN'))[0][0].n, 1)
    })
    await t.test('rejects unapproved origins', async () => {
      const student = await seed()
      assert.equal((await request(student.token, undefined, { Origin: 'https://untrusted.example' })).status, 403)
    })
    await t.test('malformed JSON is sanitized without echoing credentials', async () => {
      const student = await seed()
      const response = await fetch(`${base}/api/account`, { method: 'DELETE', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${student.token}` }, body: '{"currentPassword":"secret-synthetic",broken' })
      assert.equal(response.status, 400)
      assert.deepEqual(await response.json(), { code: 'INVALID_REQUEST', message: 'Invalid account deletion request.' })
    })
    await t.test('permanently removes all 17 tables, preserves unrelated/shared rows and invalidates login/JWT/reset', async () => {
      const student = await seed()
      const before = await db.snapshot()
      const response = await request(student.token)
      assert.equal(response.status, 200)
      assert.deepEqual(await response.json(), { deleted: true })
      const after = await db.snapshot()
      for (const [table, rows] of Object.entries(before)) {
        const expected = rows.filter(row => row.user_id !== student.userId
          && !(table === 'recommendation_item' && row.recommendation_id === student.recommendation)
          && !(['checkin_alignment_response', 'ai_mismatch_analysis'].includes(table) && row.checkin_id === student.checkin))
        assert.deepEqual(after[table], expected, table)
      }
      await db.assertIntegrity()
      assert.equal((await fetch(`${base}/api/protected`, { headers: { Authorization: `Bearer ${student.token}` } })).status, 403)
      assert.equal((await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identifier: student.username, password }) })).status, 400)
      const resetToken = token(student.userId, RESET_JWT_AUDIENCE, '5m', { purpose: 'password-reset', otpId: student.otp })
      assert.equal((await fetch(`${base}/api/auth/reset`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ resetToken, password, confirmPassword: password }) })).status, 401)
    })
    await t.test('duplicate concurrent requests produce exactly one confirmed deletion', async () => {
      const student = await seed()
      const results = await Promise.all([request(student.token), request(student.token)])
      assert.equal(results.filter(r => r.status === 200).length, 1)
      assert.ok(results.some(r => [401, 403].includes(r.status)))
      await db.assertIntegrity()
    })
    await t.test('failure after child deletes rolls back every table', async () => {
      const student = await seed()
      const before = await db.snapshot()
      const wrapped = { getConnection: async () => {
        const connection = await db.pool.getConnection()
        return { query: (...args) => connection.query(...args), beginTransaction: () => connection.beginTransaction(), commit: () => connection.commit(), rollback: () => connection.rollback(), release: () => connection.release(), destroy: () => connection.destroy(),
          execute: (sql, values) => {
            if (sql === 'DELETE FROM USER_ACCOUNT WHERE user_id = ?') throw new Error('Injected test failure')
            return connection.execute(sql, values)
          } }
      } }
      await assert.rejects(deleteStudentAccount(wrapped, student.userId, password), { code: 'DELETION_FAILED' })
      assert.deepEqual(await db.snapshot(), before)
      await db.assertIntegrity()
    })
    await t.test('cross-student ownership conflicts roll back without deleting either owner', async () => {
      const student = await seed()
      await db.pool.execute('UPDATE ASSESSMENT_ATTEMPT SET personality_assessment_id = ? WHERE attempt_id = ?', [unrelated.personality, student.attempt])
      const before = await db.snapshot()
      await assert.rejects(deleteStudentAccount(db.pool, student.userId, password), { code: 'OWNERSHIP_CONFLICT' })
      assert.deepEqual(await db.snapshot(), before)
    })
    await t.test('concurrent assessment update finishes before deletion without surviving records', async () => {
      const student = await seed()
      const writer = await db.pool.getConnection()
      try {
        await writer.beginTransaction()
        await writer.execute('UPDATE ASSESSMENT_ATTEMPT SET skill_answers = ? WHERE attempt_id = ?', ['[1]', student.attempt])
        let locked
        const accountLocked = new Promise(resolve => { locked = resolve })
        const wrapped = { getConnection: async () => {
          const c = await db.pool.getConnection()
          return { query: (...args) => c.query(...args), beginTransaction: () => c.beginTransaction(), commit: () => c.commit(), rollback: () => c.rollback(), release: () => c.release(), destroy: () => c.destroy(),
            execute: async (...args) => { const result = await c.execute(...args); if (args[0].startsWith('SELECT user_id, password')) locked(); return result } }
        } }
        const deletion = deleteStudentAccount(wrapped, student.userId, password)
        await accountLocked
        // Root lock is held while the earlier autosave holds the attempt lock.
        const insert = assert.rejects(db.pool.execute('INSERT INTO ASSESSMENT_ATTEMPT (user_id) VALUES (?)', [student.userId]), { code: 'ER_NO_REFERENCED_ROW_2' })
        await writer.commit()
        await deletion
        await insert
        for (const table of STUDENT_TABLES) assert.equal((await db.pool.execute(`SELECT COUNT(*) n FROM ${table} WHERE user_id = ?`, [student.userId]))[0][0].n, 0)
        await assert.rejects(db.pool.execute('INSERT INTO ASSESSMENT_ATTEMPT (user_id) VALUES (?)', [student.userId]), { code: 'ER_NO_REFERENCED_ROW_2' })
        await db.assertIntegrity()
      } finally { writer.release() }
    })
    await t.test('parent locks prevent late recommendation/check-in inserts and password reset', async () => {
      const student = await seed()
      let parentsLocked, continueDeletion
      const locked = new Promise(resolve => { parentsLocked = resolve })
      const proceed = new Promise(resolve => { continueDeletion = resolve })
      const wrapped = { getConnection: async () => {
        const c = await db.pool.getConnection()
        return { query: (...args) => c.query(...args), beginTransaction: () => c.beginTransaction(), commit: () => c.commit(), rollback: () => c.rollback(), release: () => c.release(), destroy: () => c.destroy(),
          execute: async (...args) => {
            const result = await c.execute(...args)
            if (args[0] === 'SELECT user_id FROM OTP_VERIFICATION WHERE user_id = ? FOR UPDATE') { parentsLocked(); await proceed }
            return result
          } }
      } }
      const deletion = deleteStudentAccount(wrapped, student.userId, password)
      await locked
      const lateWrites = [
        assert.rejects(db.insert('recommendation_item', { recommendation_id: student.recommendation, course_id: shared.course, rank_position: 2 }), { code: 'ER_NO_REFERENCED_ROW_2' }),
        assert.rejects(db.pool.execute('INSERT INTO CHECKIN_ALIGNMENT_RESPONSE (checkin_id,question_number,answer_score) VALUES (?,?,?)', [student.checkin, 2, 3]), { code: 'ER_NO_REFERENCED_ROW_2' }),
      ]
      const resetToken = token(student.userId, RESET_JWT_AUDIENCE, '5m', { purpose: 'password-reset', otpId: student.otp })
      const reset = fetch(`${base}/api/auth/reset`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ resetToken, password, confirmPassword: password }) })
      continueDeletion()
      await deletion
      await Promise.all(lateWrites)
      assert.equal((await reset).status, 401)
      await db.assertIntegrity()
    })
    await t.test('lost commit acknowledgement never reports success or retries deletion', async () => {
      const student = await seed()
      const wrapped = { getConnection: async () => {
        const c = await db.pool.getConnection()
        return { query: (...args) => c.query(...args), beginTransaction: () => c.beginTransaction(), execute: (...args) => c.execute(...args), rollback: () => c.rollback(), release: () => c.release(), destroy: () => c.destroy(),
          commit: async () => { await c.commit(); throw new Error('Lost acknowledgement') } }
      } }
      await assert.rejects(deleteStudentAccount(wrapped, student.userId, password), { code: 'DELETION_OUTCOME_UNKNOWN' })
      assert.equal((await db.pool.execute('SELECT COUNT(*) n FROM USER_ACCOUNT WHERE user_id = ?', [student.userId]))[0][0].n, 0)
      await db.assertIntegrity()
    })
    await t.test('live students behind one socket have independent quotas without trusting forwarded headers', async () => {
      const students = []
      for (let i = 0; i < 25; i++) students.push(await db.insert('user_account', {
        username: `limiterlive${i}`, email: `limiterlive${i}@example.invalid`, password: hash, is_active: 1,
      }))
      const before = await db.snapshot()
      for (const userId of students) {
        const result = await request(token(userId), {}, { 'X-Real-IP': 'invalid, spoofed', 'X-Forwarded-For': '198.51.100.1' })
        assert.equal(result.status, 400)
        assert.equal((await result.json()).code, 'INVALID_REQUEST')
      }
      assert.deepEqual(await db.snapshot(), before)
    })
    await t.test('deletion-specific account rate limit blocks repeated guesses', async () => {
      const student = await seed()
      const results = []
      for (let i = 0; i < 6; i++) results.push((await request(student.token, { currentPassword: 'wrong', confirmation: 'DELETE' })).status)
      assert.equal(results.at(-1), 429)
    })
  } finally {
    await new Promise(resolve => server.close(resolve))
    await authPool.end()
    await db.close()
  }
})
