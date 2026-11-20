import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { once } from 'node:events'
import jwt from 'jsonwebtoken'
import pool from '../config/db.js'
import { ADMIN_JWT_AUDIENCE, USER_JWT_AUDIENCE, jwtSignOptions } from '../config/security.js'
import { passwordSessionVersion } from '../services/sessionVersionService.js'
import { startOrRecoverAssessmentAttempt } from '../services/assessmentAttemptService.js'

test('the mounted assessment API authenticates, restores only owned drafts, and handles absence safely', async t => {
  const oldEnv = { ...process.env }
  const origin = 'https://www.learnmatch.online'
  Object.assign(process.env, { NODE_ENV: 'production', FRONTEND_URL: origin, CORS_ALLOWED_ORIGINS: '', JWT_SECRET: randomUUID() })
  t.after(() => {
    for (const key of ['NODE_ENV', 'FRONTEND_URL', 'CORS_ALLOWED_ORIGINS', 'JWT_SECRET']) {
      if (oldEnv[key] === undefined) delete process.env[key]
      else process.env[key] = oldEnv[key]
    }
  })
  const { app } = await import('../server.js')
  const attempts = new Map([
    [1, { attempt_id: 12, status: 'IN_PROGRESS', skill_answers: '[{"question_id":2,"selected_option":"B"}]', personality_answers: '{"1":4}' }],
    [2, { attempt_id: 20, status: 'IN_PROGRESS' }],
    [3, { attempt_id: 25, status: 'COMPLETED' }],
  ])
  const password = 'synthetic-password-hash'
  const userToken = userId => jwt.sign({ userId, sessionVersion: passwordSessionVersion(password) }, process.env.JWT_SECRET, jwtSignOptions(USER_JWT_AUDIENCE, '1h'))
  const adminToken = jwt.sign({ adminId: 1, role: 'admin' }, process.env.JWT_SECRET, jwtSignOptions(ADMIN_JWT_AUDIENCE, '1h'))
  let outage = false
  const query = t.mock.method(pool, 'query', async (sql, params) => {
    if (sql.startsWith('UPDATE ASSESSMENT_ATTEMPT')) {
      const [answers, userId, attemptId] = params
      assert.match(sql, /SET personality_answers = \?/)
      assert.match(sql, /WHERE user_id = \? AND status = 'IN_PROGRESS' AND attempt_id = \?/)
      const attempt = attempts.get(userId)
      assert.equal(attempt?.attempt_id, attemptId)
      assert.equal(attempt?.status, 'IN_PROGRESS')
      attempt.personality_answers = answers
      return [{ affectedRows: 1 }]
    }
    assert.match(sql, /^SELECT\b/)
    const [userId] = params
    if (sql.includes('FROM USER_ACCOUNT')) return [[{ user_id: userId, password }]]
    if (sql.includes('WHERE attempt_id = ? AND user_id = ?')) {
      const attempt = attempts.get(params[1])
      return [attempt?.attempt_id === params[0] ? [attempt] : []]
    }
    assert.match(sql, /FROM ASSESSMENT_ATTEMPT\s+WHERE user_id = \?/)
    if (outage) throw new Error('synthetic internal detail')
    const attempt = attempts.get(userId)
    return [attempt ? [attempt] : []]
  })
  const http = app.listen(0, '127.0.0.1')
  t.after(() => new Promise(resolve => http.close(resolve)))
  await once(http, 'listening')
  const url = `http://127.0.0.1:${http.address().port}/api/assessment-attempts/current`
  const read = (token, attemptId, requestOrigin = origin) => fetch(url, { headers: {
    Origin: requestOrigin,
    ...(token && { Authorization: `Bearer ${token}` }),
    ...(attemptId && { 'X-Assessment-Attempt-Id': String(attemptId) }),
  } })

  for (const [token, status] of [[null, 401], ['invalid', 403], [adminToken, 403]]) {
    const response = await read(token)
    assert.equal(response.status, status)
    assert.equal(response.headers.get('cache-control'), 'no-store')
    await response.json()
  }
  for (const [method, path] of [['POST', '/api/assessment-attempts'], ['POST', '/api/assessment-attempts/recover'], ['PATCH', '/api/assessment-attempts/current']]) {
    const response = await fetch(new URL(path, url), { method })
    assert.equal(response.status, 401)
    await response.json()
  }
  assert.equal(query.mock.callCount(), 0)

  const preflight = await fetch(url, { method: 'OPTIONS', headers: {
    Origin: origin, 'Access-Control-Request-Method': 'GET', 'Access-Control-Request-Headers': 'authorization,x-assessment-attempt-id',
  } })
  assert.equal(preflight.status, 204)
  assert.equal(preflight.headers.get('access-control-allow-origin'), origin)
  assert.match(preflight.headers.get('access-control-allow-headers'), /Authorization.*x-assessment-attempt-id/i)
  const foreignOrigin = await read(null, null, 'https://unapproved.example')
  assert.equal(foreignOrigin.headers.get('access-control-allow-origin'), null)
  await foreignOrigin.json()

  let response = await read(userToken(1), 12)
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('access-control-allow-origin'), origin)
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff')
  assert.equal(response.headers.get('cache-control'), 'no-store')
  const restored = await response.json()
  assert.equal(restored.attemptId, 12)
  assert.deepEqual(restored.skillAnswers, [{ question_id: 2, selected_option: 'B' }])
  assert.deepEqual(restored.personalityAnswers, { 1: 4 })

  for (const [userId, attemptId] of [[1, 20], [3, null], [4, null]]) {
    response = await read(userToken(userId), attemptId)
    assert.equal(response.status, 404)
    assert.deepEqual(await response.json(), {
      code: 'ASSESSMENT_ATTEMPT_NOT_ACTIVE', message: 'Assessment progress is no longer active.',
    })
  }
  response = await read(userToken(1))
  assert.equal((await response.json()).attemptId, 12)

  const save = (attemptId, rating) => fetch(url, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${userToken(1)}`, 'X-Assessment-Attempt-Id': String(attemptId), 'Content-Type': 'application/json' },
    body: JSON.stringify({ personality_answers: { 1: rating } }),
  })
  response = await save(20, 5)
  assert.equal(response.status, 404)
  await response.json()
  assert.equal(attempts.get(2).personality_answers, undefined)
  response = await save(12, 9)
  assert.equal(response.status, 400)
  await response.json()
  response = await save(12, 5)
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { saved: true })
  response = await read(userToken(1), 12)
  assert.deepEqual((await response.json()).personalityAnswers, { 1: 5 })

  outage = true
  t.mock.method(console, 'error', () => {})
  response = await read(userToken(1))
  assert.equal(response.status, 500)
  assert.deepEqual(await response.json(), { message: 'Could not load the active assessment attempt.' })
})

test('concurrent HTTP recovery creates only one draft and a subsequent explicit start still creates a retake', { timeout: 7000 }, async t => {
  const { app } = await import('../server.js')
  const oldSecret = process.env.JWT_SECRET
  const secret = randomUUID()
  process.env.JWT_SECRET = secret
  t.after(() => {
    if (oldSecret === undefined) delete process.env.JWT_SECRET
    else process.env.JWT_SECRET = oldSecret
  })
  const userId = 5
  const password = 'synthetic-password-hash'
  const token = jwt.sign({ userId, sessionVersion: passwordSessionVersion(password) }, secret, jwtSignOptions(USER_JWT_AUDIENCE, '1h'))
  const rows = []
  let locked = false
  let nextLock
  let acquiring = 0
  let lookupCount = 0
  let insertCount = 0
  let releasedConnections = 0
  const firstInsert = Promise.withResolvers()
  const secondRequest = Promise.withResolvers()
  const allowInsert = Promise.withResolvers()
  t.after(() => allowInsert.resolve())

  async function query(sql, params) {
    if (sql.includes('WHERE attempt_id = ? AND user_id = ?')) {
      assert.equal(params[1], userId)
      return [rows.filter(row => row.attempt_id === params[0])]
    }
    assert.deepEqual(params.slice(0, 1), [userId])
    if (sql.includes('FROM USER_ACCOUNT')) return [[{ user_id: userId, password }]]
    if (sql.includes('ORDER BY attempt_id DESC LIMIT 1')) {
      if (++lookupCount === 2) secondRequest.resolve()
      return [rows.slice(-1)]
    }
    if (sql.includes('FROM PROFILE')) return [[]]
    if (sql.startsWith('INSERT INTO ASSESSMENT_ATTEMPT')) {
      if (++insertCount === 1) {
        firstInsert.resolve()
        await allowInsert.promise
      }
      const attemptId = rows.length + 1
      rows.push({ attempt_id: attemptId, status: 'IN_PROGRESS' })
      return [{ insertId: attemptId }]
    }
    assert.fail(`Unexpected synthetic query: ${sql}`)
  }
  t.mock.method(pool, 'query', query)
  t.mock.method(pool, 'getConnection', async () => ({
    async query(sql, params) {
      if (sql.includes('GET_LOCK')) {
        assert.equal(params[0], `learnmatch:assessment-start:${userId}`)
        if (++acquiring === 2) secondRequest.resolve()
        if (locked) await new Promise(resolve => { nextLock = resolve })
        locked = true
        return [[{ acquired: 1 }]]
      }
      if (sql.includes('RELEASE_LOCK')) {
        assert.equal(params[0], `learnmatch:assessment-start:${userId}`)
        locked = false
        nextLock?.()
        nextLock = undefined
        return [[{ released: 1 }]]
      }
      return query(sql, params)
    },
    release() { releasedConnections++ },
    destroy() { assert.fail('Unexpected lock cleanup failure') },
  }))

  const http = app.listen(0, '127.0.0.1')
  t.after(() => new Promise(resolve => http.close(resolve)))
  await once(http, 'listening')
  const url = `http://127.0.0.1:${http.address().port}/api/assessment-attempts`
  const post = async (suffix = '') => {
    const response = await fetch(url + suffix, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(3000) })
    return { status: response.status, body: await response.json() }
  }
  const first = post('/recover')
  await firstInsert.promise
  const second = post('/recover')
  await secondRequest.promise
  allowInsert.resolve()
  const recovered = await Promise.all([first, second])
  assert.equal(insertCount, 1)
  assert.deepEqual(recovered, [
    { status: 201, body: { attemptId: 1, recovered: false, personalFactorsSnapshotted: false } },
    { status: 200, body: { attemptId: 1, recovered: true, personalFactorsSnapshotted: false } },
  ])
  assert.deepEqual(await post(), { status: 201, body: { attemptId: 2, personalFactorsSnapshotted: false } })
  assert.equal(releasedConnections, 3)
})

test('lock timeouts do not write drafts, and an unconfirmed unlock discards the pooled connection', async () => {
  const calls = []
  let acquired = 0
  const connection = {
    async query(sql) {
      calls.push(sql)
      if (sql.includes('GET_LOCK')) return [[{ acquired }]]
      if (sql.includes('FROM PROFILE')) return [[]]
      if (sql.startsWith('INSERT INTO ASSESSMENT_ATTEMPT')) return [{ insertId: 8 }]
      if (sql.includes('RELEASE_LOCK')) throw new Error('Synthetic lost acknowledgement')
      assert.fail(`Unexpected synthetic query: ${sql}`)
    },
    release() { calls.push('released') },
    destroy() { calls.push('destroyed') },
  }
  const database = { async getConnection() { return connection } }

  await assert.rejects(startOrRecoverAssessmentAttempt(database, 5, { recover: true }), /assessment start lock/)
  assert.deepEqual(calls, ['SELECT GET_LOCK(?, 5) AS acquired', 'released'])

  calls.length = 0
  acquired = 1
  assert.deepEqual(await startOrRecoverAssessmentAttempt(database, 5), { attemptId: 8, personalFactors: null, recovered: false })
  assert.deepEqual(calls.slice(-2), ['SELECT RELEASE_LOCK(?) AS released', 'destroyed'])
})
