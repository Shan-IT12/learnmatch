import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import { createSourceCheckRouter } from '../routes/sourceCheckRoutes.js'

test('saved-draft HTTP checking is read-only, gated, current-form based and rejects concurrent saved changes', async t => {
  const previous = process.env.SOURCE_APPROVED_PUBLISHER_HOSTS
  process.env.SOURCE_APPROVED_PUBLISHER_HOSTS = 'ched.gov.ph'
  const state = { course: { course_id: 10, is_draft: 1, is_active: 0 }, published: false, revision: 1, changesDuringCheck: false, calls: 0, sql: [] }
  const database = { query: async sql => {
    state.sql.push(sql); assert.match(sql, /^SELECT /)
    if (sql.includes('FROM COURSE WHERE')) return [state.course ? [structuredClone(state.course)] : []]
    if (sql.includes('FROM COURSE_PUBLICATION')) return [state.published ? [{ course_id: 10 }] : []]
    if (sql.includes('FROM COURSE_DRAFT_SOURCE')) return [[{ source_id: 1, source_revision: state.revision, is_removed: 0 }]]
    if (sql.includes('FROM COURSE_DRAFT_FIELD_REVISION')) return [[{ field_key: 'description', revision: state.revision }]]
    throw Error('Unexpected query')
  } }
  const form = { course_name: 'Unsaved manual course name', description: 'Unsaved supported detail', skill_profile: [{ skill_domain: 'Verbal', weight: 2, evidence: 'Synthetic evidence' }] }
  const source = { title: 'Unsaved reference title', url: 'https://ched.gov.ph/unsaved-url.pdf', notes: 'Unsaved pages note', supported_fields: ['description'] }
  const payload = { course_id: 10, course_name: form.course_name, course: form, urls: [source.url], sources: [source] }
  const app = express(); app.use(express.json())
  app.use('/sources', createSourceCheckRouter((req, res, next) => {
    if (!req.headers.authorization) return res.status(401).json({ message: 'Missing authentication.' })
    req.admin = { role: req.headers.authorization === 'student' ? 'student' : 'admin', adminId: 7 }; next()
  }, async (url, adminId, options) => {
    state.calls++; assert.equal(adminId, 7); assert.equal(url, source.url)
    assert.deepEqual(options.course, form); assert.deepEqual(options.source, source)
    if (state.pause) await state.pause()
    if (state.changesDuringCheck) state.revision++
    return { report: { status: 'Needs Review', reasons: ['Mocked analysis only.'], excerpts: [] } }
  }, database))
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve))
  t.after(async () => {
    await new Promise(resolve => server.close(resolve))
    if (previous === undefined) delete process.env.SOURCE_APPROVED_PUBLISHER_HOSTS; else process.env.SOURCE_APPROVED_PUBLISHER_HOSTS = previous
  })
  const request = async (body = payload, authorization = 'admin') => {
    const r = await fetch(`http://127.0.0.1:${server.address().port}/sources/check`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(authorization ? { authorization } : {}) }, body: JSON.stringify(body) })
    return { status: r.status, data: await r.json() }
  }
  assert.equal((await request(payload, null)).status, 401)
  assert.equal((await request(payload, 'student')).status, 403)
  state.course.is_draft = 0; assert.equal((await request()).status, 409)
  state.course.is_draft = 1; state.published = true; assert.equal((await request()).status, 409)
  state.published = false; state.course.is_active = 1; assert.equal((await request()).status, 409)
  state.course = null; assert.equal((await request()).status, 404)
  assert.equal(state.calls, 0)
  state.course = { course_id: 10, is_draft: 1, is_active: 0 }
  const snapshot = structuredClone(payload)
  assert.equal((await request()).status, 200); assert.equal(state.calls, 1)
  state.changesDuringCheck = true
  const stale = await request(); assert.equal(stale.status, 409); assert.match(stale.data.message, /changed while checking/)
  state.changesDuringCheck = false
  let ready, release
  const started = new Promise(resolve => { ready = resolve })
  state.pause = async () => { ready(); await new Promise(resolve => { release = resolve }) }
  const first = request(); await started
  try { assert.equal((await request()).status, 409) } finally { release() }
  assert.equal((await first).status, 200)
  assert.deepEqual(payload, snapshot); assert.ok(state.sql.every(sql => sql.startsWith('SELECT ')))
})
