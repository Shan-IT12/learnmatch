import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { createDeletionTestDatabase } from './helpers/accountDeletionDatabase.js'
import { createAccountRouter } from '../routes/accountRoutes.js'
import { USER_JWT_AUDIENCE, jwtSignOptions } from '../config/security.js'

const gate = () => {
  let release
  const promise = new Promise(resolve => { release = resolve })
  return { promise, release }
}
const profile = username => ({
  username, personal_factor_answers: { physical: 'no', health: 'no', financial: 'no', family: 'no', work: 'no' },
  physical_accessibility_areas: [], physical_accessibility_difficulties: {}, factor_physical_impact: null, factor_health_impact: null,
  factor_financial_impact: null, factor_family_impact: null, factor_work_impact: null,
})

test('profile/deletion serialization and failure handling on disposable MySQL', { skip: process.env.ACCOUNT_DELETION_DB_TEST !== '1', timeout: 90000 }, async t => {
  const db = await createDeletionTestDatabase()
  Object.assign(process.env, { DB_HOST: db.config.host, DB_PORT: String(db.config.port), DB_USER: db.config.user,
    DB_PASSWORD: db.config.password, DB_NAME: db.name, JWT_SECRET: 'synthetic-profile-race-secret' })
  const { default: authPool } = await import('../config/db.js')
  const { default: authenticate } = await import('../middleware/authenticateToken.js')
  const { saveProfileWithDependencies } = await import('../controllers/profileController.js')
  const password = 'SyntheticPassword1!'
  const hash = await bcrypt.hash(password, 4)
  let serial = 0
  let mode = {}
  const events = []
  const wrappedDb = { getConnection: async () => {
    const c = await db.pool.getConnection()
    const options = mode
    if (options.timeout) await c.query('SET SESSION innodb_lock_wait_timeout = 1')
    let kind
    return new Proxy(c, { get(target, key) {
      if (key === 'query' || key === 'execute') return async (sql, values) => {
        const profileRoot = sql.startsWith('SELECT username, is_active FROM USER_ACCOUNT')
        const deleteRoot = sql.startsWith('SELECT user_id, password, is_active FROM USER_ACCOUNT')
        if (profileRoot) { kind = 'profile'; options.profileAttempted?.release() }
        if (deleteRoot) { kind = 'delete'; options.deleteAttempted?.release() }
        if (sql.includes('FROM PROFILE WHERE user_id = ? FOR UPDATE')) options.profileRowAttempted?.release()
        if (kind === 'profile' && sql.startsWith('UPDATE PROFILE') && options.queryError) throw Object.assign(new Error('Synthetic failure'), { code: options.queryError })
        if (kind === 'profile' && sql.startsWith('UPDATE PROFILE') && options.zeroUpdate) return [{ affectedRows: 0 }]
        const result = await c[key](sql, values)
        if (profileRoot && options.profileHeld) { options.profileHeld.release(); await options.proceed.promise }
        if (deleteRoot && options.deleteHeld) { options.deleteHeld.release(); await options.proceed.promise }
        return result
      }
      if (key === 'commit') return async () => {
        if (kind === 'profile' && options.unknownBefore) throw new Error('Synthetic missing COMMIT acknowledgement')
        await c.commit()
        events.push(`${kind}:commit`)
        if (kind === 'profile' && options.unknownAfter) throw new Error('Synthetic lost COMMIT acknowledgement')
      }
      if (key === 'destroy') return () => { events.push(`${kind}:destroy`); c.destroy() }
      const value = Reflect.get(target, key)
      return typeof value === 'function' ? value.bind(target) : value
    } })
  } }
  const app = express()
  app.use('/api/account', createAccountRouter(wrappedDb, authenticate))
  app.use(express.json())
  app.post('/api/profile', authenticate, (req, res) => saveProfileWithDependencies(req, res, { database: wrappedDb,
    ...(mode.refreshError ? { refreshRecommendations: async (_db, _id, _generate, { transactionConnection }) => {
      await transactionConnection.query('UPDATE PROFILE SET factor_family_impact = 4 WHERE user_id = ?', [req.user.userId])
      throw new Error('Synthetic recommendation refresh failure')
    } } : {}),
  }))
  const server = app.listen(0, '127.0.0.1')
  await new Promise(resolve => server.once('listening', resolve))
  const base = `http://127.0.0.1:${server.address().port}`
  const seed = async ({ withProfile = true } = {}) => {
    serial++
    const username = `race_student${serial}`
    const userId = await db.insert('user_account', { username, email: `${username}@example.invalid`, password: hash, is_active: 1 })
    const body = profile(username)
    if (withProfile) await db.insert('profile', { user_id: userId, ...Object.fromEntries(Object.entries(body).filter(([k]) => k !== 'username').map(([k,v]) => [k, v && typeof v === 'object' ? JSON.stringify(v) : v])) })
    return { userId, body, token: jwt.sign({ userId }, process.env.JWT_SECRET, jwtSignOptions(USER_JWT_AUDIENCE, '5m')) }
  }
  const save = (student, body = student.body) => fetch(`${base}/api/profile`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${student.token}` }, body: JSON.stringify(body) })
  const remove = student => fetch(`${base}/api/account`, { method: 'DELETE', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${student.token}` }, body: JSON.stringify({ currentPassword: password, confirmation: 'DELETE' }) })
  const gone = async student => {
    for (const table of ['USER_ACCOUNT', 'PROFILE', 'ASSESSMENT_ATTEMPT']) assert.equal((await db.pool.execute(`SELECT COUNT(*) n FROM ${table} WHERE user_id = ?`, [student.userId]))[0][0].n, 0)
    await db.assertIntegrity()
  }
  try {
    const other = await seed()
    const otherBefore = (await db.pool.execute('SELECT * FROM PROFILE WHERE user_id = ?', [other.userId]))[0]
    await t.test('save finishes before deletion, including first creation and unchanged save', async () => {
      const s = await seed({ withProfile: false })
      mode = {}
      assert.equal((await save(s)).status, 201)
      assert.equal((await save(s)).status, 200)
      assert.equal((await remove(s)).status, 200)
      await gone(s)
      assert.equal((await save(s)).status, 403)
      await gone(s)
    })
    await t.test('profile wins simultaneous race; its commit precedes deletion', async () => {
      const s = await seed()
      mode = { profileHeld: gate(), deleteAttempted: gate(), proceed: gate() }
      const options = mode
      const start = events.length
      const saving = save(s)
      await options.profileHeld.promise
      const deleting = remove(s)
      await options.deleteAttempted.promise
      options.proceed.release()
      assert.equal((await saving).status, 200)
      assert.equal((await deleting).status, 200)
      assert.deepEqual(events.slice(start).filter(event => event.endsWith(':commit')), ['profile:commit', 'delete:commit'])
      await gone(s)
    })
    await t.test('deletion wins simultaneous race; already-authenticated profile request returns 404', async () => {
      const s = await seed()
      mode = { deleteHeld: gate(), profileAttempted: gate(), proceed: gate() }
      const options = mode
      const deleting = remove(s)
      await options.deleteHeld.promise
      const saving = save(s)
      await options.profileAttempted.promise
      options.proceed.release()
      assert.equal((await deleting).status, 200)
      const response = await saving
      assert.equal(response.status, 404)
      assert.deepEqual(await response.json(), { message: 'Account not found.' })
      await gone(s)
    })
    await t.test('a write failure rolls back username/profile changes and returns no success', async () => {
      const s = await seed()
      const before = await db.snapshot()
      mode = { queryError: 'SYNTHETIC_FAILURE' }
      assert.equal((await save(s, { ...s.body, username: `${s.body.username}_new` })).status, 500)
      assert.deepEqual(await db.snapshot(), before)
    })
    await t.test('real InnoDB deadlock preserves the valid winner and rolls back the selected victim', async () => {
      const s = await seed()
      const writer = await db.pool.getConnection()
      mode = { profileRowAttempted: gate() }
      try {
        await writer.beginTransaction()
        await writer.execute('UPDATE PROFILE SET factor_health_impact = 2 WHERE user_id = ?', [s.userId])
        const saving = save(s)
        await mode.profileRowAttempted.promise
        let writerVictim = false
        try {
          await writer.execute('UPDATE USER_ACCOUNT SET username = ? WHERE user_id = ?', [`${s.body.username}_writer`, s.userId])
          await writer.commit()
        } catch (error) {
          assert.equal(error.code, 'ER_LOCK_DEADLOCK')
          writerVictim = true
          await writer.rollback()
        }
        const response = await saving
        assert.equal(response.status, writerVictim ? 200 : 409)
        if (!writerVictim) assert.equal((await response.json()).code, 'PROFILE_SAVE_CONFLICT')
        assert.equal((await db.pool.execute('SELECT factor_health_impact n FROM PROFILE WHERE user_id = ?', [s.userId]))[0][0].n, writerVictim ? null : 2)
      } finally { await writer.rollback(); writer.release() }
    })
    await t.test('profile selected as deadlock victim returns 409 and rolls back its earlier account write', async () => {
      const s = await seed()
      const before = await db.snapshot()
      mode = { queryError: 'ER_LOCK_DEADLOCK' }
      const response = await save(s, { ...s.body, username: `${s.body.username}_changed` })
      assert.equal(response.status, 409)
      assert.equal((await response.json()).code, 'PROFILE_SAVE_CONFLICT')
      assert.deepEqual(await db.snapshot(), before)
    })
    await t.test('recommendation refresh failure rolls back profile and refresh changes together', async () => {
      const s = await seed()
      const before = await db.snapshot()
      mode = { refreshError: true }
      const response = await save(s, { ...s.body, personal_factor_answers: { ...s.body.personal_factor_answers, health: 'yes' }, factor_health_impact: 3 })
      assert.equal(response.status, 500)
      assert.deepEqual(await db.snapshot(), before)
    })
    await t.test('real lock timeout returns conflict with no partial writes', async () => {
      const s = await seed()
      const before = await db.snapshot()
      const writer = await db.pool.getConnection()
      mode = { timeout: true }
      try {
        await writer.beginTransaction()
        await writer.execute('SELECT profile_id FROM PROFILE WHERE user_id = ? FOR UPDATE', [s.userId])
        const response = await save(s)
        assert.equal(response.status, 409)
        assert.equal((await response.json()).code, 'PROFILE_SAVE_CONFLICT')
        assert.deepEqual(await db.snapshot(), before)
      } finally { await writer.rollback(); writer.release() }
    })
    await t.test('affected-row mismatch conflicts, but a verified unchanged update is successful', async () => {
      const s = await seed()
      const before = await db.snapshot()
      mode = { zeroUpdate: true }
      const changed = { ...s.body, personal_factor_answers: { ...s.body.personal_factor_answers, health: 'yes' }, factor_health_impact: 3 }
      assert.equal((await save(s, changed)).status, 409)
      assert.deepEqual(await db.snapshot(), before)
      assert.equal((await save(s)).status, 200)
    })
    for (const after of [false, true]) await t.test(`lost commit acknowledgement (${after ? 'committed' : 'not committed'}) is unknown, never success`, async () => {
      const s = await seed({ withProfile: false })
      mode = after ? { unknownAfter: true } : { unknownBefore: true }
      const response = await save(s)
      assert.equal(response.status, 503)
      assert.equal((await response.json()).code, 'PROFILE_SAVE_OUTCOME_UNKNOWN')
      assert.equal((await db.pool.execute('SELECT COUNT(*) n FROM PROFILE WHERE user_id = ?', [s.userId]))[0][0].n, after ? 1 : 0)
      assert.equal(events.at(-1), 'profile:destroy')
    })
    await t.test('inactive account is not written even if middleware previously authorized it', async () => {
      const s = await seed()
      await db.pool.execute('UPDATE USER_ACCOUNT SET is_active = 0 WHERE user_id = ?', [s.userId])
      const before = await db.snapshot()
      mode = {}
      const res = { statusCode: 200, status(code) { this.statusCode = code; return this }, json(body) { this.body = body; return this } }
      await saveProfileWithDependencies({ user: { userId: s.userId }, body: s.body }, res, { database: wrappedDb })
      assert.equal(res.statusCode, 404)
      assert.deepEqual(await db.snapshot(), before)
    })
    assert.deepEqual((await db.pool.execute('SELECT * FROM PROFILE WHERE user_id = ?', [other.userId]))[0], otherBefore)
    await db.assertIntegrity()
  } finally {
    mode.proceed?.release()
    await new Promise(resolve => { server.close(resolve); server.closeAllConnections() })
    await authPool.end()
    await db.close()
  }
})
