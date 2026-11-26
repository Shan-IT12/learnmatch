import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import express from 'express'
import { readFile } from 'node:fs/promises'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import mysql from 'mysql2/promise'
import pool from '../config/db.js'
import { ADMIN_JWT_AUDIENCE, USER_JWT_AUDIENCE, jwtSignOptions } from '../config/security.js'
import authenticateAdmin from '../middleware/authenticateAdmin.js'
import { CLUSTER_SKILL_DOMAINS, PARENT_CLUSTERS, RIASEC_DIMENSIONS, SKILL_DOMAINS } from '../config/recommendationConfig.js'
import { issueStaffToken, loginStaff } from '../services/staffAccountService.js'
import { reviewImage } from '../services/privateReviewImage.js'
import { COURSE_SOURCE_FIELDS } from '../shared/courseSourceFields.js'
import { PRIVACY_NOTICE_VERSION, TERMS_VERSION } from '../shared/legalDocuments.js'
import { getPublicCourse, searchAvailablePublicCourses } from '../services/publicCourseService.js'
import { validatedPublicCourse } from '../services/courseValidationService.js'
import { searchActiveCollegeCourses } from '../services/collegeCourseSearchService.js'
import { getTopCourseRecommendations } from '../services/recommendationService.js'
import { PERSONAL_FACTOR_KEYS } from '../shared/personalFactors.js'

const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNQcEgAAAFEAMELjZZCAAAAAElFTkSuQmCC'
const jpg = Buffer.from([
  0xff, 0xd8, // SOI
  0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, // APP0 JFIF
  0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01, 0x00, 0x01, 0x01, 0x01, 0x11, 0x00, // SOF0 1x1
  0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, // SOS
  0x7f, // minimal entropy-coded byte
  0xff, 0xd9, // EOI
]).toString('base64')
test('private review images require valid bounded PNG or JPG data rather than file extensions', () => {
  assert.ok(reviewImage(png).length)
  assert.ok(reviewImage(jpg).length)
  assert.throws(() => reviewImage(Buffer.from('<svg><script>invalid</script></svg>').toString('base64')), /valid PNG or JPG/)
  assert.throws(() => reviewImage(Buffer.concat([Buffer.from(png, 'base64'), Buffer.from('trailing bytes')]).toString('base64')), /valid PNG or JPG/)
  assert.throws(() => reviewImage(Buffer.concat([Buffer.from(jpg, 'base64'), Buffer.from('trailing')]).toString('base64')), /valid PNG or JPG/)
  assert.throws(() => reviewImage('A'.repeat(14500000)), /valid PNG or JPG/)
})

const schema = process.env.COURSE_VALIDATION_TEST_SCHEMA
test('mounted Administrator–Validator workflow on isolated MySQL with captured email', { skip: !schema, timeout: 90000 }, async t => {
  assert.match(schema, /^learnmatch_validation_qa_[0-9]+$/)
  assert.ok(['localhost','127.0.0.1','::1'].includes(process.env.DB_HOST))
  assert.notEqual(schema, process.env.DB_NAME)
  const config = { host: process.env.DB_HOST, port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER, password: process.env.DB_PASSWORD, timezone: 'Z', multipleStatements: true }
  const source = await mysql.createConnection({ ...config, database: process.env.DB_NAME })
  t.after(() => source.end())
  const ddl = []
  for (const table of ['ADMIN','COURSE','COURSE_CODE_ALLOCATOR','CAREER_OPPORTUNITY','COURSE_SKILL_PROFILE','COURSE_RIASEC_PROFILE',
    'COURSE_DRAFT_FIELD_REVISION','COURSE_DRAFT_SOURCE','COURSE_DRAFT_SOURCE_REVIEW','COURSE_DRAFT_SOURCE_CHECK','COURSE_MATCHING_REVIEW','COURSE_PUBLICATION']) {
    const [[result]] = await source.query(`SHOW CREATE TABLE ${table}`)
    let definition = result['Create Table']
    // Rebuild the pre-migration foundation even after the local working DB is upgraded.
    const workflowColumn = table === 'COURSE_PUBLICATION' ? '\x60validation_item_id\x60'
      : table === 'ADMIN' && definition.includes('\x60admin_verified_email\x60') ? '\x60email\x60' : null
    if (workflowColumn) definition = definition.split('\n').filter(line => !line.includes(workflowColumn)).join('\n').replace(/,\n\)/, '\n)')
    ddl.push(definition.replace(/ AUTO_INCREMENT=\d+/g, ''))
  }
  await source.query(`CREATE DATABASE \`${schema}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`)
  const database = mysql.createPool({ ...config, database: schema })
  t.after(async () => {
    await database.end()
    const cleanup = await mysql.createConnection(config)
    try { await cleanup.query(`DROP DATABASE \`${schema}\``) } finally { await cleanup.end() }
  })
  for (const sql of ddl) await database.query(sql)
  for (const method of ['query','execute','getConnection']) t.mock.method(pool, method, database[method].bind(database))
  process.env.JWT_SECRET = randomUUID()
  const [legacyCourse] = await database.execute(
    'INSERT INTO COURSE (course_code, course_name, cluster_category, is_active) VALUES (?, ?, ?, 1)',
    ['CRS001', 'Synthetic pre-migration course', PARENT_CLUSTERS[0]],
  )
  const previousEnvironment = process.env.NODE_ENV
  try {
    process.env.NODE_ENV = 'development'
    const legacyLogin = { username: 'pre-migration-admin', password: 'SyntheticLegacy2026' }
    const [legacyAdmin] = await database.execute('INSERT INTO ADMIN (full_name, username, password_hash) VALUES (?, ?, ?)',
      ['Pre-migration Demo Admin', legacyLogin.username, await bcrypt.hash(legacyLogin.password, 10)])
    const { token } = await loginStaff(database, 'admin', legacyLogin)
    const adminRequest = { headers: { authorization: `Bearer ${token}` } }
    const res = { setHeader() {}, status(status) { assert.fail(`Legacy Admin session returned ${status}`) } }
    await authenticateAdmin(adminRequest, res, () => assert.equal(adminRequest.admin.adminId, legacyAdmin.insertId))
    assert.equal(adminRequest.admin.adminId, legacyAdmin.insertId)
    await assert.rejects(loginStaff(database, 'admin', { ...legacyLogin, password: 'IncorrectPassword1' }), { status: 400 })
    await assert.rejects(loginStaff(database, 'admin', { email: 'admin@example.test', password: legacyLogin.password }), { status: 503 })
    assert.equal((await searchAvailablePublicCourses('', {}, database))[0].course_code, 'CRS001')
    assert.deepEqual((await validatedPublicCourse(database, 'CRS001')).validation, { status: 'pending' })
    assert.equal((await searchActiveCollegeCourses(database, 'CRS001'))[0].course_id, legacyCourse.insertId)
    process.env.NODE_ENV = 'production'
    await assert.rejects(searchAvailablePublicCourses('', {}, database), { code: 'ER_NO_SUCH_TABLE' })
    await assert.rejects(loginStaff(database, 'admin', legacyLogin), { code: 'ER_BAD_FIELD_ERROR' })
  } finally {
    if (previousEnvironment === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = previousEnvironment
    await database.execute('DELETE FROM COURSE WHERE course_id = ?', [legacyCourse.insertId])
  }
  await database.query(await readFile(new URL('../migrations/20261120_add_course_validation.sql', import.meta.url), 'utf8'))
  await database.execute('INSERT INTO COURSE_CODE_ALLOCATOR (allocator_id, next_number) VALUES (1, 9000)')
  Object.assign(process.env, { JWT_SECRET: randomUUID(), FRONTEND_URL: 'http://localhost:5173', NODE_ENV: 'test',
    RESEND_FROM_EMAIL: 'sender@example.test', RESEND_API_KEY: 'synthetic', SOURCE_APPROVED_PUBLISHER_HOSTS: 'example.edu' })
  const outbox = []
  const network = globalThis.fetch
  t.mock.method(globalThis, 'fetch', (url, options) => {
    if (url === 'https://api.resend.com/emails') {
      outbox.push(JSON.parse(options.body))
      return Promise.resolve(Response.json({ id: randomUUID() }))
    }
    assert.match(String(url), /^http:\/\/127\.0\.0\.1:\d+\//)
    return network(url, options)
  })
  const mailToken = address => {
    const mail = outbox.findLast(entry => entry.to.includes(address))
    assert.ok(mail, 'Synthetic email reached the sink')
    const url = mail.text.split('\n').find(line => line.startsWith('http://localhost:5173/'))
    assert.ok(url, 'Plain-text email contains a local account link')
    assert.ok(mail.html.includes(`href="${url}"`), 'HTML email links to the same account page')
    return /#([a-zA-Z0-9_-]{43})$/.exec(url)[1]
  }
  const { app } = await import('../server.js')
  const useBrowser = process.env.COURSE_VALIDATION_BROWSER === '1'
  const parent = express()
  if (useBrowser) parent.use('/fixture', app)
  parent.use(app)
  if (useBrowser) {
    const dist = fileURLToPath(new URL('../../client/dist', import.meta.url))
    parent.use(express.static(dist))
    parent.get(['/admin/{*path}', '/validator/{*path}', '/courses/{*path}'], (_req, res) => res.sendFile('app.html', { root: dist }))
  }
  const server = parent.listen(0, '127.0.0.1')
  t.after(() => new Promise(resolve => server.close(resolve)))
  await once(server, 'listening')
  const api = async (path, { token, body, status = 200, method, image = false } = {}) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/${path}`, {
      method: method || (body === undefined ? 'GET' : 'POST'),
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
    const result = image ? Buffer.from(await response.arrayBuffer()) : await response.json()
    if (status !== null) assert.equal(response.status, status, `${path}: ${result.message || response.status}`)
    if (path.startsWith('admin/') || path.startsWith('validator/')) assert.equal(response.headers.get('cache-control'), 'no-store')
    if (image) assert.match(response.headers.get('content-disposition'), /^attachment/)
    return status === null ? response.status : result
  }
  const password = 'SyntheticPassword1'
  const newPassword = 'SyntheticPassword2'
  const passwords = value => ({ password: value, confirmPassword: value })
  const [staff] = await database.execute('INSERT INTO ADMIN (full_name, username, password_hash) VALUES (?, ?, ?)',
    ['Synthetic Admin','qa-admin',await bcrypt.hash(password, 10)])
  const adminId = staff.insertId
  const adminEmail = 'admin@example.test'
  const oldToken = jwt.sign({ adminId, role: 'admin' }, process.env.JWT_SECRET, jwtSignOptions(ADMIN_JWT_AUDIENCE, '2h'))
  const student = jwt.sign({ userId: 1 }, process.env.JWT_SECRET, jwtSignOptions(USER_JWT_AUDIENCE, '2h'))
  await api('admin/validators', { token: oldToken })
  const legacy = await api('admin/login', { body: { username: 'qa-admin', password } })
  await api('admin/validators', { token: legacy.token })
  const setup = await issueStaffToken(database, 'admin_setup', adminId, adminEmail)
  await api('admin/account/setup', { body: { token: setup, ...passwords(password) } })
  await api('admin/account/setup', { status: 409, body: { token: setup, ...passwords(password) } })
  await api('admin/validators', { token: oldToken, status: 403 })
  await api('admin/validators', { token: legacy.token, status: 403 })
  const adminLogin = async value => (await api('admin/login', { body: { email: adminEmail, password: value } })).token
  const preReset = await adminLogin(password)
  assert.equal(jwt.decode(preReset).adminId, adminId)
  const forgot = { email: adminEmail }
  await api('admin/account/forgot', { body: forgot })
  const reset = { token: mailToken(adminEmail), ...passwords(newPassword) }
  assert.deepEqual((await Promise.all([api('admin/account/reset', { body: reset, status: null }),
    api('admin/account/reset', { body: reset, status: null })])).sort(), [200,409])
  await api('admin/validators', { token: preReset, status: 403 })
  const admin = await adminLogin(newPassword)
  await api('admin/validators', { token: student, status: 403 })
  await api('validator/profile', { token: admin, status: 401 })

  const cluster = PARENT_CLUSTERS[0]
  const register = async (email, fullName) => {
    await api('admin/validators/invite', { token: admin, body: { email } })
    const invitation = mailToken(email)
    const request = { token: invitation, email, fullName, profession: 'Educator', affiliation: 'QA University',
      expertise: 'Curriculum design', clusters: [cluster], accepted: true,
      termsVersion: TERMS_VERSION, privacyVersion: PRIVACY_NOTICE_VERSION, credential: png, ...passwords(password) }
    return request
  }
  const email = 'validator@example.test'
  const firstInvite = await register(email, 'QA Expert')
  await database.execute("UPDATE VALIDATION_ACCOUNT_TOKEN SET expires_at = UTC_TIMESTAMP(6) WHERE purpose = 'validator_invite' AND email = ?", [email])
  await api('validator/invite', { body: { token: firstInvite.token }, status: 409 })
  const request = await register(email, 'QA Expert')
  await api('validator/invite', { body: { token: request.token } })
  await api('validator/register', { status: 409, body: { ...request, email: 'forwarded@example.test' } })
  await api('validator/register', { body: request })
  await api('validator/register', { status: 409, body: request })
  const login = async (address, value = password) => (await api('validator/login', { body: { email: address, password: value } })).token
  await api('validator/login', { status: 403, body: { email, password } })
  const verify = { token: mailToken(email) }
  const { approvalToken } = await api('validator/verify', { body: verify })
  await api('validator/verify', { body: verify, status: 409 })
  await api('validator/approval-status', { token: verify.token, status: 401 })
  await api('validator/profile', { token: approvalToken, status: 401 })
  assert.deepEqual(await api('validator/approval-status', { token: approvalToken }), { status: 'pending' })
  const pending = await login(email)
  let profile = await api('validator/profile', { token: pending })
  const id = profile.validator_id
  const decide = (validator, body, status = 200) => api(`admin/validators/${validator.validator_id}/decision`, {
    token: admin, status, body: { credentialId: validator.credential_id, ...body },
  })
  assert.equal(profile.status, 'pending')
  await api('validator/reviews', { token: pending, status: 403 })
  await api('admin/validators', { token: pending, status: 403 })
  await decide(profile, { decision: 'correction', remarks: 'Provide current evidence.' })
  await api('validator/profile/credential', { token: pending, body: { credential: png } })
  await decide(profile, { decision: 'approved', clusters: [cluster] }, 409)
  profile = await api('validator/profile', { token: pending })
  await decide(profile, { decision: 'approved', clusters: [PARENT_CLUSTERS[1]] }, 400)
  await decide(profile, { decision: 'approved', clusters: [cluster] })
  assert.deepEqual(await api('validator/approval-status', { token: approvalToken }), { status: 'approved' })
  assert.deepEqual(await api(`admin/validators/${id}/credentials/${profile.credential_id}`, { token: admin, image: true }), reviewImage(png))
  assert.deepEqual(await api(`validator/profile/credentials/${profile.credential_id}`, { token: pending, image: true }), reviewImage(png))
  await api('validator/forgot', { body: { email } })
  await api('validator/reset', { body: { token: mailToken(email), ...passwords(newPassword) } })
  await api('validator/profile', { token: pending, status: 401 })
  const validator = await login(email, newPassword)

  const addAccount = async (address, name, decision) => {
    await api('validator/register', { body: await register(address, name) })
    await api('validator/verify', { body: { token: mailToken(address) } })
    const token = await login(address)
    const account = await api('validator/profile', { token })
    await decide(account, { decision, clusters: [cluster], remarks: 'Synthetic onboarding decision.' })
    return { token, account }
  }
  const rejected = await addAccount('rejected@example.test', 'Rejected QA', 'rejected')
  assert.equal((await api('validator/profile', { token: rejected.token })).status, 'rejected')
  await api('validator/reviews', { token: rejected.token, status: 403 })
  const other = await addAccount('other@example.test', 'Other Expert', 'approved')
  await api(`validator/profile/credentials/${profile.credential_id}`, { token: other.token, status: 404 })

  // Existing stable-code rows remain available while assigned and after a correction request.
  const existing = ['CRS001','CRS002','CRS003'].map(code => getPublicCourse(code))
  assert.ok(existing.every(Boolean))
  for (const [index, course] of existing.entries()) {
    const [saved] = await database.execute('INSERT INTO COURSE (course_code, course_name, cluster_category, description, obtainable_skills, is_active) VALUES (?, ?, ?, ?, ?, 1)',
      [course.course_code, course.course_name, cluster, `Synthetic details ${index}`, 'Analysis'])
    await database.execute('INSERT INTO COURSE_SKILL_PROFILE (course_id, skill_domain, weight) VALUES (?, ?, 2)', [saved.insertId, SKILL_DOMAINS[0]])
    for (const riasec of RIASEC_DIMENSIONS) {
      await database.execute('INSERT INTO COURSE_RIASEC_PROFILE (course_id, riasec_type, weight) VALUES (?, ?, ?)', [saved.insertId, riasec, riasec === 'S' ? 3 : 0])
    }
  }
  const recommendations = () => getTopCourseRecommendations({
    query(sql, params) {
      // Keep catalog and profile-weight queries on MySQL. Supply synthetic student inputs.
      if (sql.includes('FROM SKILL_RESPONSE')) return [SKILL_DOMAINS.flatMap(dimension => Array.from({ length: 5 }, () => ({ dimension, is_correct: 1 })))]
      if (sql.includes('FROM INTEREST_RESPONSE')) return [[{ interest_name: 'Helping Others / Volunteering' }, { interest_name: 'Science Experiments' }]]
      if (sql.includes('FROM PERSONALITY_ASSESSMENT')) return [[{ assessment_id: 1, mbti_type: 'ISFJ' }]]
      if (sql.includes('FROM PROFILE')) return [[{ personal_factor_answers: Object.fromEntries(PERSONAL_FACTOR_KEYS.map(key => [key, 'no'])) }]]
      return database.query(sql, params)
    },
  }, 1)
  const initialRanking = await recommendations()
  assert.equal(initialRanking.length, 3)
  const initialCollege = await searchActiveCollegeCourses(database, 'CRS002')
  const publicCourse = code => api(`public/courses/${code}`)
  assert.deepEqual((await publicCourse('CRS001')).course.validation, { status: 'pending' })
  const getCluster = () => api(`admin/validation?cluster=${encodeURIComponent(cluster)}`, { token: admin })
  const batch = await getCluster()
  assert.equal(batch.courses.length, 3)
  const assign = (body, status = 200) => api('admin/validation/assign', { token: admin, status, body: { validatorId: id, confirmed: true, cluster, ...body } })
  await assign({ courses: batch.courses.map((course, index) => index === 0 ? { ...course, version: '0'.repeat(64) } : course) }, 409)
  const { assignment_id: batchId } = await assign({ courses: batch.courses })
  await assign({ courses: batch.courses }, 409)
  assert.deepEqual((await publicCourse('CRS001')).course.validation, { status: 'under_review' })
  assert.deepEqual(await recommendations(), initialRanking)
  assert.deepEqual(await searchActiveCollegeCourses(database, 'CRS002'), initialCollege)
  await api(`validator/reviews/${batchId}`, { token: other.token, status: 404 })
  const getReview = (assignmentId, token = validator) => api(`validator/reviews/${assignmentId}`, { token })
  const record = (item, decision, remarks = 'Synthetic review remarks') => ({ itemId: item.item_id, version: item.version_token, decision, remarks })
  const batchItems = (await getReview(batchId)).items
  const selected = batchItems.map((item, index) => record(item, index === 1 ? 'needs_changes' : 'approved'))
  const selectedIds = selected.filter(row => row.decision === 'approved').map(row => row.itemId)
  const batchSignature = { method: 'uploaded', image: png, confirmed: true, itemIds: selectedIds }
  const submit = (assignmentId, body, status = 200, token = validator) => api(`validator/reviews/${assignmentId}`, { token, body, status })
  await submit(batchId, { decisions: selected, signature: { ...batchSignature, itemIds: [selected[1].itemId] } }, 400)
  await submit(batchId, { decisions: selected, signature: batchSignature }, 404, other.token)
  const results = await Promise.all([submit(batchId, { decisions: selected, signature: batchSignature }, null), submit(batchId, { decisions: selected, signature: batchSignature }, null)])
  assert.deepEqual(results.sort(), [200,409])
  const saved = (await getReview(batchId)).items
  assert.equal(saved[0].signature_id, saved[2].signature_id)
  assert.equal(saved[1].signature_id, null)
  assert.equal(saved[1].decision, 'needs_changes')
  const signatureId = saved[0].signature_id
  assert.deepEqual(await api(`admin/validation/signatures/${signatureId}`, { token: admin, image: true }), reviewImage(png))
  assert.deepEqual(await api(`validator/signatures/${signatureId}`, { token: validator, image: true }), reviewImage(png))
  await api(`validator/signatures/${signatureId}`, { token: other.token, status: 404 })
  const publicApproved = (await publicCourse('CRS001')).course.validation
  assert.match(publicApproved.validated_on, /^\d{4}-\d{2}-\d{2}$/)
  await api(`admin/validation/records/${saved[0].item_id}`, { token: validator, status: 403 })
  assert.equal((await api(`admin/validation/records/${saved[0].item_id}`, { token: admin })).snapshot.course_code, 'CRS001')
  assert.deepEqual(Object.keys(publicApproved).sort(), ['status','validated_on'])
  assert.equal(publicApproved.status, 'validated')
  assert.equal((await publicCourse('CRS002')).course.validation.status, 'needs_changes')
  assert.equal(Number((await getCluster()).batches[0].approved), 2)
  assert.deepEqual(await recommendations(), initialRanking)

  const itemQueue = courseId => api(`admin/validation?courseId=${courseId}`, { token: admin })
  const correction = await itemQueue(saved[1].course_id)
  const { draftId: replacement } = await api(`admin/validation/replacement/${saved[1].course_id}`, { token: admin, body: { expectedVersion: correction.expectedVersion } })
  assert.equal((await itemQueue(saved[1].course_id)).replacementId, replacement)
  assert.equal((await publicCourse('CRS002')).course.validation.status, 'needs_changes')
  const form = {
    course_name: 'Synthetic new course', course_abbreviation: 'SNC', cluster_category: cluster,
    description: 'Synthetic course description', obtainable_skills: 'Analysis, communication',
    program_duration_years: 1, year_levels: [{ year: 1, label: 'Year 1', overview: 'Synthetic curriculum' }],
    skill_profile: CLUSTER_SKILL_DOMAINS[cluster].map((skill_domain, index) => ({ skill_domain, weight: index === 0 ? 3 : 2, evidence: 'Synthetic course evidence' })),
    riasec_profile: RIASEC_DIMENSIONS.map((riasec_type, index) => ({ riasec_type, weight: index === 0 ? 3 : 0, evidence: 'Synthetic course evidence' })),
  }
  const { courseId: draftId } = await api('admin/courses', { token: admin, body: { ...form, description: '' }, status: 201 })
  const queue = await itemQueue(draftId)
  await assign({ courseId: draftId, expectedVersion: queue.expectedVersion }, 422)
  const saveDraft = (id, body) => api(`admin/courses/${id}`, { token: admin, method: 'PUT', body })
  await saveDraft(draftId, form)
  const confirmSource = async (id, sourceId) => {
    const sources = await api(`admin/courses/${id}/sources`, { token: admin })
    const source = sources.sources.find(row => row.source_id === sourceId)
    await api(`admin/courses/${id}/sources/${sourceId}/reviews`, { token: admin, status: 201, body: { confirmed: true, expected_token: source.review_token } })
  }
  const addSource = async id => {
    const added = await api(`admin/courses/${id}/sources`, { token: admin, status: 201, body: {
      title: 'Synthetic approved institution source', url: 'https://example.edu/program', supported_fields: Object.keys(COURSE_SOURCE_FIELDS),
    } })
    await confirmSource(id, added.source_id)
    return added.source_id
  }
  const added = await addSource(draftId)
  const publication = id => api(`admin/courses/${id}/publication`, { token: admin })
  const matching = (id, review) => api(`admin/courses/${id}/publication/matching-review`, { token: admin,
    body: { expected_token: review.review_token, confirmed: true } })
  const publish = (id, review, status = 200) => api(`admin/courses/${id}/publication/publish`, { token: admin, status,
    body: { expected_token: review.review_token, expected_validation_version: review.validation_version, publish_confirmed: true } })
  await matching(draftId, await publication(draftId))
  await publish(draftId, await publication(draftId), 422)
  const assignDraft = async courseId => (await assign({ courseId, expectedVersion: (await itemQueue(courseId)).expectedVersion })).assignment_id
  const firstDraft = await assignDraft(draftId)
  const [firstItem] = (await getReview(firstDraft)).items
  await submit(firstDraft, { decisions: [record(firstItem, 'needs_changes', 'Clarify career preparation.')] })
  await assign({ courseId: draftId, expectedVersion: (await itemQueue(draftId)).expectedVersion }, 409)
  await saveDraft(draftId, { ...form, description: 'Clarified synthetic career preparation.' })
  await confirmSource(draftId, added)
  await matching(draftId, await publication(draftId))
  const revised = await assignDraft(draftId)
  const revisedReview = await getReview(revised)
  assert.equal(revisedReview.history[0].remarks, 'Clarify career preparation.')
  const [revisedItem] = revisedReview.items
  const typed = item => ({ method: 'typed', name: 'QA Expert', confirmed: true, itemIds: [item.item_id] })
  const obsoletePublication = await publication(draftId)
  await saveDraft(draftId, { ...form, description: 'A newer synthetic revision.' })
  assert.equal((await getReview(revised)).items[0].decision, 'superseded')
  await submit(revised, { decisions: [record(revisedItem, 'approved')], signature: typed(revisedItem) }, 409)
  await publish(draftId, obsoletePublication, 409)
  await confirmSource(draftId, added)
  await matching(draftId, await publication(draftId))
  const finalAssignment = await assignDraft(draftId)
  const [finalItem] = (await getReview(finalAssignment)).items
  await submit(finalAssignment, { decisions: [record(finalItem, 'approved')], signature: typed(finalItem) })
  const published = await publish(draftId, await publication(draftId))
  assert.equal((await publicCourse(published.course_code)).course.validation.status, 'validated')
  assert.equal((await api('validator/reviews', { token: await login(email, newPassword) })).assignments.length, 4)

  // Promote a replacement under the original ID, with its signed snapshot and original links intact.
  await saveDraft(replacement, { ...form, course_name: existing[1].course_name, description: 'Synthetic replacement course description.' })
  await addSource(replacement)
  await matching(replacement, await publication(replacement))
  let replacementPublished
  if (useBrowser) {
    await t.test('Chrome updates assignment and publication views automatically and preserves a drawn approval across login', async () => {
      const requireClient = createRequire(new URL('../../client/package.json', import.meta.url))
      const { chromium } = requireClient('playwright')
      const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH })
      const origin = `http://127.0.0.1:${server.address().port}`
      try {
        const page = await browser.newPage({ serviceWorkers: 'block' })
        const errors = []
        page.on('pageerror', error => errors.push(error.message))
        await page.goto(`${origin}/admin/login`)
        await page.locator('input[name="username"]').fill(adminEmail)
        await page.locator('input[name="password"]').fill(newPassword)
        await page.getByRole('button', { name: 'Log In' }).click()
        await page.getByRole('link', { name: 'Validators', exact: true }).click()
        await page.getByRole('button', { name: 'View QA Expert' }).click()
        await page.getByRole('heading', { name: 'QA Expert', exact: true }).waitFor()
        await page.getByText('Download private credential').waitFor()

        const waitingEmail = 'waiting@example.test'
        await api('validator/register', { body: await register(waitingEmail, 'Waiting QA Expert') })
        await page.goto(`${origin}/validator/account/verify#${mailToken(waitingEmail)}`)
        await page.getByRole('button', { name: 'Verify email', exact: true }).click()
        await page.getByText('Pending Approval', { exact: true }).waitFor()
        assert.equal(new URL(page.url()).hash, '')
        await page.reload()
        await page.getByText('Pending Approval', { exact: true }).waitFor()
        const accounts = await api('admin/validators', { token: admin })
        await decide(accounts.accounts.find(account => account.email === waitingEmail), { decision: 'approved', clusters: [cluster] })
        await page.waitForURL(`${origin}/validator/login`, { timeout: 15000 })
        await page.getByText('Your Validator account is approved. You can sign in now.', { exact: true }).waitFor()
        assert.equal(await page.evaluate(() => localStorage.getItem('validatorToken')), null)

        const publicationPage = await browser.newPage({ serviceWorkers: 'block' })
        await publicationPage.addInitScript(token => localStorage.setItem('adminToken', token), admin)
        await publicationPage.goto(`${origin}/admin/courses?course=${replacement}`)
        const publicationPanel = publicationPage.getByRole('region', { name: 'Review & Publish' })
        await publicationPanel.getByText('Not ready to publish', { exact: true }).waitFor()

        const signIn = async () => {
          await page.bringToFront()
          await page.goto(`${origin}/validator/login`)
          await page.getByRole('textbox', { name: 'Email', exact: true }).fill(email)
          await page.locator('input[name="password"]').fill(newPassword)
          await page.getByRole('button', { name: 'Sign in', exact: true }).click()
          await page.getByRole('heading', { name: 'My Reviews', exact: true }).waitFor()
        }
        await signIn()
        const replacementAssignment = await assignDraft(replacement)
        await page.locator(`a[href="/validator/reviews/${replacementAssignment}"]`).click()
        await page.waitForURL(`**/validator/reviews/${replacementAssignment}`)
        try { await page.getByRole('combobox', { name: 'Decision', exact: true }).selectOption('approved', { timeout: 10000 }) }
        catch { assert.fail(`The assignment decision control was unavailable. ${await page.locator('main').innerText()} ${errors.join(' ')}`) }
        await page.getByRole('textbox', { name: 'Remarks', exact: true }).fill('Reviewed the synthetic replacement in Chrome.')
        await page.getByRole('button', { name: 'Review selected decisions' }).click()
        await page.getByLabel('Signature method').selectOption('drawn')
        const canvas = page.getByLabel('Draw your signature')
        await canvas.scrollIntoViewIfNeeded()
        const bounds = await canvas.boundingBox()
        await page.mouse.move(bounds.x + 20, bounds.y + 75)
        await page.mouse.down()
        await page.mouse.move(bounds.x + 95, bounds.y + 25, { steps: 6 })
        await page.mouse.move(bounds.x + 140, bounds.y + 62, { steps: 6 })
        await page.mouse.up()
        await page.getByRole('checkbox', { name: /I personally reviewed/ }).check()
        await page.getByRole('button', { name: 'Submit decisions' }).click()
        const signed = page.getByText(/Reviewed the synthetic replacement in Chrome/)
        await signed.waitFor()
        await publicationPage.bringToFront()
        await publicationPanel.getByText('All publication requirements passed', { exact: true }).waitFor({ timeout: 15000 })
        await page.reload()
        await signed.waitFor()
        await page.getByRole('button', { name: 'Logout', exact: true }).click()
        await signIn()
        await page.locator(`a[href="/validator/reviews/${replacementAssignment}"]`).click()
        await signed.waitFor()
        await page.goto(`${origin}/courses/CRS002`)
        await page.getByText('Under Review · Updates Requested', { exact: true }).waitFor()
        replacementPublished = await publish(replacement, await publication(replacement))
        await page.getByText(/Expert Validated/).waitFor({ timeout: 18000 })
        assert.deepEqual(errors, [])
      } finally { await browser.close() }
    })
  } else {
    const replacementAssignment = await assignDraft(replacement)
    const [replacementItem] = (await getReview(replacementAssignment)).items
    await submit(replacementAssignment, { decisions: [record(replacementItem, 'approved')], signature: { method: 'drawn', image: png, confirmed: true, itemIds: [replacementItem.item_id] } })
  }
  if (!replacementPublished) {
    assert.equal((await publicCourse('CRS002')).course.validation.status, 'needs_changes')
    replacementPublished = await publish(replacement, await publication(replacement))
  }
  assert.equal(replacementPublished.course_id, saved[1].course_id)
  assert.equal(replacementPublished.course_code, 'CRS002')
  const corrected = await publicCourse('CRS002')
  assert.equal(corrected.course.description, 'Synthetic replacement course description.')
  assert.equal(corrected.course.validation.status, 'validated')
  const [collegeCourse] = await searchActiveCollegeCourses(database, 'CRS002')
  assert.equal(collegeCourse.course_id, saved[1].course_id)
  assert.equal(collegeCourse.program_duration_years, 1)
  const currentPublished = await itemQueue(saved[1].course_id)
  await api(`admin/validation/replacement/${saved[1].course_id}`, { token: admin, body: { expectedVersion: currentPublished.expectedVersion } })
  assert.deepEqual((await publicCourse('CRS002')).course.validation, corrected.course.validation)
  await api(`admin/courses/${replacement}/status`, { token: admin, body: { is_active: true }, method: 'PATCH', status: 422 })
  await decide(profile, { decision: 'deactivated', remarks: 'Synthetic deactivation.' })
  await api('validator/profile', { token: validator, status: 401 })
  await api('validator/login', { status: 400, body: { email, password: newPassword } })
  assert.equal((await publicCourse('CRS002')).course.validation.status, 'validated')
})
