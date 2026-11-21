import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import { once } from 'node:events'
import { createAssessmentMonitoringRouter } from '../routes/assessmentMonitoringRoutes.js'
import { purgeExpiredMonitoringLogs, validateMonitoringEvent } from '../services/assessmentMonitoringService.js'
import { getAdminUsers } from '../services/adminUserMonitoringService.js'

test('monitoring events accept only whitelisted metadata', () => {
  assert.deepEqual(validateMonitoringEvent({ event_type: 'no_face', assessment_step: 'academic_skills' }), { eventType: 'no_face', assessmentStep: 'academic_skills' })
  for (const body of [
    null, [], {}, { event_type: 'no_face' },
    { event_type: 'screenshot', assessment_step: 'skills' },
    { event_type: 'no_face', assessment_step: 'Skills; DROP TABLE x' },
    { event_type: 'no_face', assessment_step: 'skills', image: 'data:image/png;base64,AAAA' },
  ]) assert.ok(validateMonitoringEvent(body).error, JSON.stringify(body))
})

test('monitoring routes enforce ownership, roles and metadata-only writes', async t => {
  const attempts = new Map([[10, { attempt_id: 10, user_id: 1, status: 'IN_PROGRESS', camera_enabled: 0 }], [11, { attempt_id: 11, user_id: 1, status: 'COMPLETED', camera_enabled: 1 }]])
  const inserted = []
  const pool = {
    async query(sql, params) {
      if (sql.startsWith('SELECT attempt_id, status FROM ASSESSMENT_ATTEMPT')) {
        const row = attempts.get(params[0])
        return [row && row.user_id === params[1] ? [row] : []]
      }
      if (sql.startsWith('INSERT INTO assessment_monitoring_logs')) { inserted.push(params); return [{ affectedRows: 1 }] }
      if (sql.startsWith('UPDATE ASSESSMENT_ATTEMPT SET camera_enabled = ?')) { attempts.get(params[1]).camera_enabled = params[0]; return [{ affectedRows: 1 }] }
      if (sql.startsWith('SELECT attempt_id, user_id, status, camera_enabled')) {
        const row = attempts.get(params[0])
        return [row && (!params[1] || row.user_id === params[1]) ? [row] : []]
      }
      if (sql.startsWith('SELECT attempt_id FROM ASSESSMENT_ATTEMPT WHERE user_id = ?')) {
        const done = [...attempts.values()].filter(a => a.user_id === params[0] && a.status === 'COMPLETED')
        return [done.slice(-1).map(a => ({ attempt_id: a.attempt_id }))]
      }
      if (sql.startsWith('SELECT event_type')) return [[{ event_type: 'tab_switch', assessment_step: 'interests', created_at: new Date(0) }]]
      throw new Error(`Unexpected SQL: ${sql}`)
    },
  }
  const user = userId => (req, _res, next) => { req.user = { userId }; next() }
  const admin = (req, res, next) => (req.get('x-admin') ? next() : res.status(401).json({ message: 'No token provided' }))
  const app = express()
  app.use(express.json())
  app.use((req, _res, next) => user(Number(req.get('x-user') || 1))(req, _res, next))
  app.use(createAssessmentMonitoringRouter(pool, (req, res, next) => next(), admin))
  const server = app.listen(0)
  t.after(() => server.close())
  await once(server, 'listening')
  const base = `http://127.0.0.1:${server.address().port}`
  const send = (path, { method = 'GET', body, headers = {} } = {}) => fetch(base + path, { method, headers: { 'content-type': 'application/json', ...headers }, body: body && JSON.stringify(body) })

  assert.equal((await send('/api/assessment-attempts/10/monitoring/events', { method: 'POST', body: { event_type: 'tab_switch', assessment_step: 'interests' } })).status, 201)
  assert.deepEqual(inserted[0].slice(0, 4), [1, 10, 'tab_switch', 'interests'])
  assert.equal((await send('/api/assessment-attempts/10/monitoring/events', { method: 'POST', body: { event_type: 'tab_switch', assessment_step: 'interests', photo: 'x' } })).status, 400)
  assert.equal((await send('/api/assessment-attempts/10/monitoring/events', { method: 'POST', headers: { 'x-user': '2' }, body: { event_type: 'no_face', assessment_step: 'interests' } })).status, 404)
  assert.equal((await send('/api/assessment-attempts/11/monitoring/events', { method: 'POST', body: { event_type: 'no_face', assessment_step: 'interests' } })).status, 409)
  assert.equal((await send('/api/assessment-attempts/abc/monitoring')).status, 400)

  assert.equal((await send('/api/assessment-attempts/10/monitoring/camera', { method: 'PUT', headers: { 'x-user': '2' } })).status, 404)
  assert.equal((await send('/api/assessment-attempts/10/monitoring/camera', { method: 'PUT', body: { enabled: 'no' } })).status, 400)
  assert.equal((await send('/api/assessment-attempts/10/monitoring/camera', { method: 'PUT' })).status, 200)
  const own = await (await send('/api/assessment-attempts/10/monitoring')).json()
  assert.equal(own.mode, 'Verified')
  assert.equal(own.counts.tab_switch, 1)
  assert.equal('userId' in own, false)
  const downgraded = await (await send('/api/assessment-attempts/10/monitoring/camera', { method: 'PUT', body: { enabled: false } })).json()
  assert.deepEqual([downgraded.cameraEnabled, downgraded.mode], [false, 'Standard'])
  assert.equal((await (await send('/api/assessment-attempts/10/monitoring')).json()).mode, 'Standard')
  await send('/api/assessment-attempts/10/monitoring/camera', { method: 'PUT', body: { enabled: true } })
  assert.equal((await send('/api/assessment-attempts/10/monitoring', { headers: { 'x-user': '2' } })).status, 404)
  const latest = await (await send('/api/assessment-attempts/latest/monitoring')).json()
  assert.deepEqual([latest.attemptId, latest.mode], [11, 'Verified'])
  assert.equal((await send('/api/assessment-attempts/latest/monitoring', { headers: { 'x-user': '2' } })).status, 404)

  assert.equal((await send('/api/admin/assessment-attempts/10/monitoring')).status, 401)
  const review = await (await send('/api/admin/assessment-attempts/10/monitoring', { headers: { 'x-admin': '1', 'x-user': '2' } })).json()
  assert.deepEqual([review.userId, review.status, review.cameraEnabled], [1, 'IN_PROGRESS', true])
  assert.deepEqual(Object.keys(review.events[0]), ['eventType', 'assessmentStep', 'createdAt'])
})

test('retention deletes only expired monitoring logs, in batches', async () => {
  const statements = []
  const results = [1000, 1000, 5]
  const db = { async query(sql, params) { statements.push([sql, params]); return [{ affectedRows: results.shift() }] } }
  assert.equal(await purgeExpiredMonitoringLogs(db), 2005)
  for (const [sql, params] of statements) {
    assert.match(sql, /^DELETE FROM assessment_monitoring_logs WHERE created_at < \(NOW\(\) - INTERVAL \? DAY\)/)
    assert.deepEqual(params, [30, 1000])
  }
  await assert.rejects(purgeExpiredMonitoringLogs(db, { retentionDays: 0 }))
})

test('admin user monitoring includes Verified/Standard attempt mode and flag counts', async () => {
  const db = {
    async query(sql) {
      if (sql.includes('SELECT COUNT(*) AS total')) return [[{ total: 1 }]]
      if (sql.includes('FROM user_monitoring')) {
        return [[{
          user_id: 7,
          username: 'student7',
          email: 'student7@example.org',
          is_active: 1,
          created_at: new Date(0),
          assessment_status: 'Completed',
          has_recommendation: 1,
          tracking_started: 0,
          alignment_status: null,
        }]]
      }
      if (sql.includes('FROM ASSESSMENT_ATTEMPT a')) {
        return [[
          { attempt_id: 42, user_id: 7, status: 'COMPLETED', camera_enabled: 1, flag_count: 3, started_at: new Date(0), completed_at: new Date(1000) },
          { attempt_id: 41, user_id: 7, status: 'COMPLETED', camera_enabled: 0, flag_count: 0, started_at: new Date(0), completed_at: new Date(500) },
        ]]
      }
      throw new Error(`Unexpected SQL: ${sql}`)
    },
  }
  const result = await getAdminUsers(db, { page: 1, pageSize: 10 })
  assert.equal(result.users.length, 1)
  assert.deepEqual(
    [result.users[0].latestAttempt.attemptId, result.users[0].latestAttempt.mode, result.users[0].latestAttempt.flagCount],
    [42, 'Verified', 3]
  )
  assert.equal(result.users[0].attempts[1].mode, 'Standard')
})
