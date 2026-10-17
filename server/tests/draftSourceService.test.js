import test from 'node:test'
import crypto from 'node:crypto'
import assert from 'node:assert/strict'
import express from 'express'
import jwt from 'jsonwebtoken'
import { createDraftSourceRouter } from '../routes/draftSourceRoutes.js'
import authenticateAdmin from '../middleware/authenticateAdmin.js'
import pool from '../config/db.js'
import { ADMIN_JWT_AUDIENCE, jwtSignOptions } from '../config/security.js'
import { saveCourseDraft } from '../services/courseDraftService.js'
import { setCourseActiveStatus } from '../services/adminCourseService.js'
import { listDraftSources, saveDraftSource, reviewDraftSource, removeDraftSource, captureDraftReviewFields } from '../services/draftSourceService.js'
import { sourceAnalysisBinding } from '../../shared/pendingSourceReview.js'
import { validateCourseSource } from '../../shared/courseSourceFields.js'
import { searchAvailablePublicCourses, getAvailablePublicCourse } from '../services/publicCourseService.js'
import { searchActiveCollegeCourses } from '../services/collegeCourseSearchService.js'
import { getSchoolsForCourse } from '../services/schoolLocatorService.js'

// Synthetic hosts are explicitly approved only inside this test worker.
const previousApprovedHosts = process.env.SOURCE_APPROVED_PUBLISHER_HOSTS
process.env.SOURCE_APPROVED_PUBLISHER_HOSTS = 'example.edu,official.example.edu'
test.after(() => { if (previousApprovedHosts === undefined) delete process.env.SOURCE_APPROVED_PUBLISHER_HOSTS; else process.env.SOURCE_APPROVED_PUBLISHER_HOSTS = previousApprovedHosts })

const sourceInput = (supported_fields = ['description']) => ({ title: 'Curriculum reference', url: 'https://example.edu/curriculum.pdf', supported_fields, notes: 'Admin supplied evidence' })
const courseInput = () => ({ course_name: 'Synthetic draft', cluster_category: 'BUSINESS CLUSTER', description: 'Saved description', obtainable_skills: 'Communication' })

test('context-bound saved analysis becomes historical after relevant revisions, including edit/revert', async () => {
  const db = memoryDatabase()
  await saveDraftSource(db, 10, sourceInput())
  const fields = await captureDraftReviewFields(db, db.state.course)
  const context_sha256 = crypto.createHash('sha256').update(sourceAnalysisBinding(sourceInput(), fields)).digest('hex')
  db.state.checks.push({ check_id: 1, source_id: 1, source_revision: 1, report: { status: 'Needs Review', reasons: [], context_sha256, saved_field_revisions: { course_name: 1, description: 1 } } })
  assert.equal((await listDraftSources(db, 10))[0].checks[0].current, true)
  db.state.course.description = 'Changed after checking'
  assert.equal((await listDraftSources(db, 10))[0].checks[0].current, false)
  db.state.course.description = fields.description; db.state.revisions.description = 3
  assert.equal((await listDraftSources(db, 10))[0].checks[0].current, false)
  assert.equal(db.state.checks.length, 1)
})

test('saved draft source appends enforce three links under the shared course lock and retain removed history', async () => {
  const db = memoryDatabase()
  for (let i = 0; i < 3; i++) await saveDraftSource(db, 10, { ...sourceInput(), title: `Fixture ${i}` })
  await assert.rejects(saveDraftSource(db, 10, sourceInput()), { status: 400 })
  const sources = await listDraftSources(db, 10)
  await removeDraftSource(db, 10, sources[0].source_id, sources[0].source_revision)
  await saveDraftSource(db, 10, sourceInput())
  const after = await listDraftSources(db, 10)
  assert.equal(after.filter((source) => !source.is_removed).length, 3)
  assert.equal(after.filter((source) => source.is_removed).length, 1)
})

function memoryDatabase() {
  const state = {
    course: { ...courseInput(), course_id: 10, course_code: 'CRS500', course_abbreviation: 'SD', is_draft: 1, is_active: 0, program_type: null, psced_group: null, program_duration_years: 2, year_levels: [{ year: 1, label: 'First', overview: '' }, { year: 2, label: 'Second', overview: '' }] },
    skills: [{ skill_domain: 'Verbal', weight: 2, evidence: 'Saved evidence' }],
    riasec: ['R', 'I', 'A', 'S', 'E', 'C'].map((riasec_type) => ({ riasec_type, weight: 1, evidence: 'Saved evidence' })),
    sources: [], reviews: [], checks: [], revisions: {}, sourceId: 1, reviewId: 1, calls: [],
  }
  const clone = (value) => structuredClone(value)
  let queue = Promise.resolve()
  const query = async (sql, args = []) => {
    state.calls.push({ sql, args })
    if (sql.startsWith('SELECT course_id FROM COURSE_PUBLICATION')) return [[]]
    if (sql.includes('FROM COURSE') && sql.includes('is_active = 1')) return [[]]
    if (sql.startsWith('SELECT * FROM COURSE WHERE')) return [[...(args[0] === 10 ? [clone(state.course)] : [])]]
    if (sql.startsWith('SELECT next_number')) return [[{ next_number: 501 }]]
    if (sql.startsWith('SELECT course_id, course_code')) return [[clone(state.course)]]
    if (sql.includes('SELECT skill_domain')) return [clone(state.skills).sort((a, b) => a.skill_domain.localeCompare(b.skill_domain))]
    if (sql.includes('SELECT riasec_type')) return [clone(state.riasec).sort((a, b) => a.riasec_type.localeCompare(b.riasec_type))]
    if (sql.startsWith('SELECT * FROM COURSE_DRAFT_SOURCE')) return [clone(state.sources.filter((row) => row.course_id === args[0]))]
    if (sql.startsWith('SELECT field_key')) return [Object.entries(state.revisions).map(([field_key, revision]) => ({ field_key, revision }))]
    if (sql.startsWith('SELECT r.*')) return [clone(state.reviews).reverse()]
    if (sql.startsWith('SELECT c.*')) return [clone(state.checks)]
    if (sql.startsWith('SELECT report FROM COURSE_DRAFT_SOURCE_CHECK')) return [clone(state.checks.filter(check => check.source_id === args[0] && check.source_revision === args[1]).map(check => ({ report: check.report })))]
    if (sql.startsWith('SELECT admin_id, username')) return [args[0] === 7 ? [{ admin_id: 7, username: 'local-test-admin' }] : []]
    if (sql.startsWith('SELECT is_draft')) return [[{ is_draft: state.course.is_draft }]]
    if (sql.startsWith('INSERT INTO COURSE_DRAFT_SOURCE_REVIEW')) {
      const review_id = state.reviewId++
      const keys = ['source_id', 'source_revision', 'context_token', 'field_revisions', 'source_snapshot', 'claim_snapshot', 'reviewer_id', 'reviewer_label']
      state.reviews.push({ ...Object.fromEntries(keys.map((key, i) => [key, args[i]])), review_id, reviewed_at: '2026-10-16T09:00:00.000Z' })
      return [{ insertId: review_id }]
    }
    if (sql.startsWith('INSERT INTO COURSE_DRAFT_SOURCE ')) {
      const source_id = state.sourceId++
      state.sources.push({ source_id, course_id: args[0], title: args[1], url: args[2], supported_fields: args[3], notes: args[4], source_revision: 1, is_removed: 0 })
      return [{ insertId: source_id }]
    }
    if (sql.startsWith('INSERT INTO COURSE_DRAFT_FIELD_REVISION')) { state.revisions[args[1]] = (state.revisions[args[1]] || 1) + 1; return [{}] }
    if (sql.startsWith('UPDATE COURSE_DRAFT_SOURCE SET title')) {
      Object.assign(state.sources.find((row) => row.source_id === args[5]), { title: args[0], url: args[1], supported_fields: args[2], notes: args[3] })
      state.sources.find((row) => row.source_id === args[5]).source_revision++
      if (sql.includes('check_digest = NULL')) state.sources.find(row => row.source_id === args[5]).check_digest = null
      return [{}]
    }
    if (sql.startsWith('UPDATE COURSE_DRAFT_SOURCE SET is_removed')) {
      const row = state.sources.find((row) => row.source_id === args[1]); row.is_removed = 1; row.source_revision++; return [{}]
    }
    if (sql.startsWith('UPDATE COURSE SET course_name')) {
      Object.assign(state.course, { course_name: args[0], cluster_category: args[1], description: args[2], obtainable_skills: args[3], program_type: args[4], psced_group: args[5], course_abbreviation: args[6] }); return [{}]
    }
    if (sql.startsWith('UPDATE COURSE SET program_duration')) { state.course.program_duration_years = args[0]; state.course.year_levels = JSON.parse(args[1]); return [{}] }
    if (sql.includes('INSERT INTO COURSE_SKILL_PROFILE') || sql.includes('INSERT INTO COURSE_RIASEC_PROFILE')) {
      const key = sql.includes('SKILL_PROFILE') ? 'skill_domain' : 'riasec_type'
      const list = key === 'skill_domain' ? state.skills : state.riasec
      const old = list.find((entry) => entry[key] === args[1])
      if (old) { old.weight = args[2]; if (args[4]) old.evidence = args[3] }
      else list.push({ [key]: args[1], weight: args[2], evidence: args[3] })
      return [{}]
    }
    if (sql.startsWith('DELETE FROM COURSE_SKILL_PROFILE')) { state.skills = state.skills.filter((row) => args.slice(1).includes(row.skill_domain)); return [{}] }
    if (sql.startsWith('DELETE FROM COURSE_RIASEC_PROFILE')) { state.riasec = state.riasec.filter((row) => args.slice(1).includes(row.riasec_type)); return [{}] }
    throw new Error(`Unexpected test query: ${sql}`)
  }
  return { state, query, async getConnection() {
    let release, snapshot
    return {
      async beginTransaction() { const prior = queue; queue = new Promise((resolve) => { release = resolve }); await prior; snapshot = clone(state) },
      query,
      async commit() { release(); release = null },
      async rollback() { if (snapshot) Object.assign(state, snapshot); release?.(); release = null },
      release() { release?.() },
    }
  } }
}
async function addAndReview(db, fields = ['description']) {
  const { source_id } = await saveDraftSource(db, 10, sourceInput(fields))
  const row = (await listDraftSources(db, 10)).find((source) => source.source_id === source_id)
  await reviewDraftSource(db, 10, source_id, { confirmed: true, expected_token: row.review_token }, 7)
  return (await listDraftSources(db, 10)).find((source) => source.source_id === source_id)
}

test('saved URL edit clears current check binding and invalidates reviews; URL revert cannot revive history', async () => {
  const db = memoryDatabase()
  const { source_id } = await saveDraftSource(db, 10, sourceInput())
  db.state.sources[0].check_digest = 'synthetic-old-check-digest'
  db.state.checks.push({ check_id: 1, source_id, source_revision: 1, report: JSON.stringify({ original_url: sourceInput().url, final_url: sourceInput().url, status: 'Potential Match', reasons: [], excerpts: [] }) })
  const original = (await listDraftSources(db, 10))[0]
  await reviewDraftSource(db, 10, source_id, { confirmed: true, expected_token: original.review_token }, 7)
  const history = structuredClone({ reviews: db.state.reviews, checks: db.state.checks })
  await saveDraftSource(db, 10, { ...sourceInput(), url: 'https://example.edu/another-reference.pdf', source_revision: 1 }, source_id)
  let updated = (await listDraftSources(db, 10))[0]
  assert.equal(updated.check_digest, null)
  assert.equal(updated.review_status, 'review_again')
  assert.equal(updated.checks[0].current, false); assert.equal(updated.reviews[0].current, false)
  await assert.rejects(reviewDraftSource(db, 10, source_id, { confirmed: true, expected_token: original.review_token }, 7), { status: 409 })
  await saveDraftSource(db, 10, { ...sourceInput(), source_revision: updated.source_revision }, source_id)
  updated = (await listDraftSources(db, 10))[0]
  assert.equal(updated.review_status, 'review_again'); assert.equal(updated.checks[0].current, false)
  assert.equal(updated.check_digest, null)
  assert.deepEqual({ reviews: db.state.reviews, checks: db.state.checks }, history)
  assert.equal(updated.title, original.title); assert.equal(updated.notes, original.notes)
  assert.deepEqual(updated.supported_fields, original.supported_fields)
})

test('multiple structured sources persist; edits and removal retain immutable review history', async () => {
  const db = memoryDatabase()
  const confirmed = await addAndReview(db)
  await saveDraftSource(db, 10, sourceInput(['duration', 'obtainable_skills']))
  assert.equal((await listDraftSources(db, 10)).length, 2)
  assert.equal(confirmed.review_status, 'confirmed')
  assert.equal(confirmed.reviews[0].claim_snapshot.description, 'Saved description')
  await saveDraftSource(db, 10, { ...sourceInput(), title: 'Updated reference', source_revision: 1 }, confirmed.source_id)
  let updated = (await listDraftSources(db, 10))[0]
  assert.equal(updated.review_status, 'review_again')
  assert.equal(updated.reviews[0].source_snapshot.title, 'Curriculum reference')
  await assert.rejects(saveDraftSource(db, 10, { ...sourceInput(), source_revision: 1 }, confirmed.source_id), { status: 409 })
  await assert.rejects(removeDraftSource(db, 10, confirmed.source_id, 1), { status: 409 })
  await removeDraftSource(db, 10, confirmed.source_id, 2)
  updated = (await listDraftSources(db, 10))[0]
  assert.equal(updated.review_status, 'removed')
  assert.equal(updated.reviews.length, 1)
  assert.equal(updated.reviews[0].current, false)
  await assert.rejects(reviewDraftSource(db, 10, confirmed.source_id, { confirmed: true, expected_token: updated.review_token }, 7), { status: 404 })
})

test('review uses authenticated attribution and database timestamp, ignoring spoofed client fields', async () => {
  const db = memoryDatabase()
  const { source_id } = await saveDraftSource(db, 10, sourceInput())
  const [source] = await listDraftSources(db, 10)
  await reviewDraftSource(db, 10, source_id, { confirmed: true, expected_token: source.review_token, reviewer_id: 999, reviewer_label: 'Spoof', reviewed_at: '1900-01-01' }, 7)
  const [reviewed] = await listDraftSources(db, 10)
  assert.equal(reviewed.reviews[0].reviewer_id, 7)
  assert.equal(reviewed.reviews[0].reviewer_label, 'local-test-admin')
  assert.equal(reviewed.reviews[0].reviewed_at, '2026-10-16T09:00:00.000Z')
  const insert = db.state.calls.find(({ sql }) => sql.startsWith('INSERT INTO COURSE_DRAFT_SOURCE_REVIEW'))
  assert.doesNotMatch(insert.sql, /reviewed_at/)
  await assert.rejects(reviewDraftSource(db, 10, source_id, { confirmed: false, expected_token: source.review_token }, 7), { status: 400 })
  await assert.rejects(reviewDraftSource(db, 10, source_id, { confirmed: true, expected_token: source.review_token }, null), { status: 401 })
  await assert.rejects(reviewDraftSource(db, 10, source_id, { confirmed: true, expected_token: source.review_token }, 999), { status: 403 })
})

test('course saves invalidate only affected reviews; stale tokens and change/revert cycles are rejected', async () => {
  const db = memoryDatabase()
  const description = await addAndReview(db)
  const duration = await addAndReview(db, ['duration'])
  await saveCourseDraft(db, { ...courseInput(), description: 'Changed description' }, 10)
  let sources = await listDraftSources(db, 10)
  assert.equal(sources[0].review_status, 'review_again')
  assert.equal(sources[1].review_status, 'confirmed')
  await assert.rejects(reviewDraftSource(db, 10, description.source_id, { confirmed: true, expected_token: description.review_token }, 7), { status: 409 })
  await saveCourseDraft(db, courseInput(), 10)
  sources = await listDraftSources(db, 10)
  assert.notEqual(sources[0].review_token, description.review_token)
  assert.equal(sources[0].review_status, 'review_again')
  await saveCourseDraft(db, { ...courseInput(), course_name: 'Renamed draft' }, 10)
  assert.notEqual((await listDraftSources(db, 10))[1].review_token, duration.review_token)
})

test('profile evidence, weights, cluster and duration changes invalidate their selected reviews', async () => {
  for (const change of ['evidence', 'weight', 'cluster', 'duration', 'skills', 'abbreviation']) {
    const db = memoryDatabase()
    const row = await addAndReview(db, ['matching_profile_evidence', 'duration', 'obtainable_skills'])
    const body = { ...courseInput() }
    if (change === 'evidence' || change === 'weight') {
      body.skill_profile = db.state.skills.map((entry) => ({ ...entry, [change === 'weight' ? 'weight' : 'evidence']: change === 'weight' ? 3 : 'Changed evidence' }))
      body.riasec_profile = structuredClone(db.state.riasec)
    }
    if (change === 'cluster') body.cluster_category = 'EDUCATION CLUSTER'
    if (change === 'duration') { body.program_duration_years = 1; body.year_levels = [{ year: 1, label: 'First', overview: '' }] }
    if (change === 'skills') body.obtainable_skills = 'Changed skills'
    if (change === 'abbreviation') body.course_abbreviation = 'NEW'
    await saveCourseDraft(db, body, 10)
    const [updated] = await listDraftSources(db, 10)
    assert.notEqual(updated.review_token, row.review_token, change)
    assert.equal(updated.review_status, 'review_again', change)
    assert.equal(updated.reviews.length, 1)
  }
})

test('no-op saves preserve confirmation; a second confirmation appends history without publication or weight approval', async () => {
  const db = memoryDatabase()
  const original = await addAndReview(db, ['matching_profile_evidence', 'duration'])
  await saveDraftSource(db, 10, { ...sourceInput(['matching_profile_evidence', 'duration']), source_revision: 1 }, original.source_id)
  await saveCourseDraft(db, { ...courseInput(), skill_profile: structuredClone(db.state.skills), riasec_profile: [...db.state.riasec].reverse() }, 10)
  const [updated] = await listDraftSources(db, 10)
  assert.equal(updated.review_token, original.review_token)
  await reviewDraftSource(db, 10, original.source_id, { confirmed: true, expected_token: updated.review_token }, 7)
  assert.equal((await listDraftSources(db, 10))[0].reviews.length, 2)
  assert.equal(db.state.course.is_active, 0)
  assert.equal(db.state.course.is_draft, 1)
  assert.deepEqual(db.state.skills, [{ skill_domain: 'Verbal', weight: 2, evidence: 'Saved evidence' }])
  await assert.rejects(setCourseActiveStatus(db, 10, true), { code: 'DRAFT_COURSE' })
  assert.ok(db.state.calls.every(({ sql }) => !/RECOMMENDATION|COLLEGE_|SEMESTER|SCHOOL_|UPDATE COURSE SET is_active/.test(sql)))
})

test('source and relevant-course races reject a stale confirmation rather than record it', async () => {
  const db = memoryDatabase()
  const source = await addAndReview(db)
  await Promise.all([
    saveDraftSource(db, 10, { ...sourceInput(), notes: 'Changed', source_revision: 1 }, source.source_id),
    assert.rejects(reviewDraftSource(db, 10, source.source_id, { confirmed: true, expected_token: source.review_token }, 7), { status: 409 }),
  ])
  assert.equal(db.state.reviews.length, 1)
})

test('tokens bind confirmations to the specific saved source, even for identical references', async () => {
  const db = memoryDatabase()
  await saveDraftSource(db, 10, sourceInput())
  await saveDraftSource(db, 10, sourceInput())
  const [first, second] = await listDraftSources(db, 10)
  assert.notEqual(first.review_token, second.review_token)
  await assert.rejects(reviewDraftSource(db, 10, second.source_id, { confirmed: true, expected_token: first.review_token }, 7), { status: 409 })
  await assert.rejects(saveDraftSource(db, 10, { ...sourceInput(), source_revision: 1 }, 999), { status: 404 })
})

test('failed course save rolls back field revisions together with course details and preserves confirmation', async () => {
  const db = memoryDatabase()
  const source = await addAndReview(db)
  const failed = { async getConnection() {
    const connection = await db.getConnection()
    return { ...connection, commit: async () => { throw new Error('Simulated commit failure') } }
  } }
  await assert.rejects(saveCourseDraft(failed, { ...courseInput(), description: 'Uncommitted edit' }, 10), /Simulated commit failure/)
  assert.equal(db.state.course.description, 'Saved description')
  const [reloaded] = await listDraftSources(db, 10)
  assert.equal(reloaded.review_status, 'confirmed')
  assert.equal(reloaded.review_token, source.review_token)
})

test('confirmed source cannot expose a draft through public discovery, details, College selection or locator', async () => {
  const db = memoryDatabase()
  db.state.course.course_code = 'CRS001'
  await addAndReview(db)
  assert.deepEqual(await searchAvailablePublicCourses('', {}, db), [])
  assert.equal(await getAvailablePublicCourse('CRS001', db), null)
  assert.deepEqual(await searchActiveCollegeCourses(db, 'Synthetic'), [])
  assert.equal(await getSchoolsForCourse('CRS001', db), null)
  assert.equal(db.state.course.is_active, 0)
})

test('published/legacy, active and missing courses cannot acquire draft source records', async () => {
  const db = memoryDatabase()
  await assert.rejects(saveDraftSource(db, 99, sourceInput()), { status: 404 })
  for (const flags of [{ is_draft: 0, is_active: 1 }, { is_draft: 0, is_active: 0 }, { is_draft: 1, is_active: 1 }]) {
    Object.assign(db.state.course, flags)
    await assert.rejects(saveDraftSource(db, 10, sourceInput()), { status: 409 })
    await assert.rejects(listDraftSources(db, 10), { status: 409 })
  }
  assert.equal(db.state.sources.length, 0)
})

test('shared field validation rejects invalid URLs, credentials, blank fields and unsupported claims', async () => {
  for (const change of [{ title: '' }, { url: 'javascript:alert(1)' }, { url: 'file:///secret' }, { url: 'https://user:pass@example.edu' }, { url: 'https://example.edu/a b' }, { supported_fields: [] }, { supported_fields: ['approval'] }, { supported_fields: ['description', 'description'] }, { notes: 'x'.repeat(5001) }]) {
    assert.ok(Object.keys(validateCourseSource({ ...sourceInput(), ...change }).errors).length)
    await assert.rejects(saveDraftSource(memoryDatabase(), 10, { ...sourceInput(), ...change }), { status: 400 })
  }
  assert.deepEqual(validateCourseSource(sourceInput()).errors, {})
  assert.ok(validateCourseSource(undefined).errors.title)
})

test('HTTP routes enforce real admin JWT authentication, validation, stale revisions and server attribution', async (t) => {
  const database = memoryDatabase()
  const priorSecret = process.env.JWT_SECRET
  const priorQuery = pool.query
  process.env.JWT_SECRET = 'local-source-unit-test-secret-only'
  pool.query = async (sql, args) => {
    assert.match(sql, /^SELECT admin_id FROM ADMIN/)
    return [args[0] === 7 ? [{ admin_id: 7 }] : []]
  }
  const app = express()
  app.use(express.json())
  app.use('/api/admin/courses/:courseId/sources', createDraftSourceRouter(database, authenticateAdmin))
  const server = app.listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve))
    pool.query = priorQuery
    if (priorSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = priorSecret
    await pool.end()
  })
  const token = (claims) => jwt.sign(claims, process.env.JWT_SECRET, jwtSignOptions(ADMIN_JWT_AUDIENCE, '5m'))
  const admin = token({ role: 'admin', adminId: 7 })
  const request = async (method, suffix = '', body, bearer = admin) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/admin/courses/10/sources${suffix}`, { method, headers: { 'Content-Type': 'application/json', ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) })
    return { status: response.status, data: await response.json() }
  }
  for (const method of ['GET', 'POST', 'PUT', 'DELETE']) {
    assert.equal((await request(method, method === 'PUT' || method === 'DELETE' ? '/1' : '', undefined, null)).status, 401)
    assert.equal((await request(method, method === 'PUT' || method === 'DELETE' ? '/1' : '', undefined, token({ role: 'student', adminId: 7 }))).status, 403)
  }
  assert.equal((await request('POST', '/1/reviews', {}, null)).status, 401)
  assert.equal((await request('GET', '', undefined, token({ role: 'admin', adminId: 999 }))).status, 403)
  const invalid = await request('POST', '', { ...sourceInput(), url: 'bad' })
  assert.equal(invalid.status, 400)
  assert.ok(invalid.data.fieldErrors.url)
  const created = await request('POST', '', sourceInput())
  assert.equal(created.status, 201)
  const [source] = (await request('GET')).data.sources
  const result = await request('POST', `/${source.source_id}/reviews`, { confirmed: true, expected_token: source.review_token, reviewer_id: 999, reviewed_at: '1900-01-01' })
  assert.equal(result.status, 201)
  assert.equal((await request('GET')).data.sources[0].reviews[0].reviewer_id, 7)
  await request('PUT', `/${source.source_id}`, { ...sourceInput(), title: 'Changed', source_revision: 1 })
  assert.equal((await request('POST', `/${source.source_id}/reviews`, { confirmed: true, expected_token: source.review_token })).status, 409)
  assert.equal(database.state.course.is_active, 0)
})
