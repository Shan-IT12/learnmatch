import test from 'node:test'
import assert from 'node:assert/strict'
import { allocateCourseCode, saveCourseDraft, validateDraftInput, requireStandaloneCareerEditable } from '../services/courseDraftService.js'
import { checkUnsavedSource, confirmUnsavedSource } from '../services/sourceCheckService.js'
import { htmlBlocks } from '../services/sourceTextReading.js'
import { createSourceAnalyzer, sourceAiConfiguration } from '../services/sourceAiAnalysisService.js'
import { sourceAnalysisFields } from '../../shared/pendingSourceReview.js'

// Synthetic hosts are explicitly approved only inside this test worker.
const previousApprovedHosts = process.env.SOURCE_APPROVED_PUBLISHER_HOSTS
process.env.SOURCE_APPROVED_PUBLISHER_HOSTS = 'example.edu,official.example.edu'
test.after(() => { if (previousApprovedHosts === undefined) delete process.env.SOURCE_APPROVED_PUBLISHER_HOSTS; else process.env.SOURCE_APPROVED_PUBLISHER_HOSTS = previousApprovedHosts })

const input = (name = 'New Program') => ({
  course_name: name, cluster_category: 'BUSINESS CLUSTER', description: 'Description', obtainable_skills: 'Communication',
  program_duration_years: 2,
  year_levels: [1, 2].map((year) => ({ year, label: `Year ${year}`, overview: '' })),
  skill_profile: [{ skill_domain: 'Verbal', weight: 2, evidence: 'Approved curriculum' }],
  riasec_profile: ['R', 'I', 'A', 'S', 'E', 'C'].map((riasec_type) => ({ riasec_type, weight: 0, evidence: 'Reviewed profile' })),
})

// In-memory query adapter exercising transaction ordering without contacting a database.
function database(seed = [], failProfileWrite = false, failCheckWrite = false, failCareerWrite = false) {
  const state = { courses: structuredClone(seed), profiles: [], sources: [], checks: [], reviews: [], careers: [], careerId: 500, next: 361, id: 1400, commits: 0, rollbacks: 0, calls: [] }
  let queue = Promise.resolve()
  return { state, async getConnection() {
    let unlock, snapshot
    return {
      async beginTransaction() {},
      async query(sql, args = []) {
        state.calls.push({ sql, args })
        if (sql.startsWith('SELECT opportunity_id FROM CAREER_OPPORTUNITY')) return [state.careers.filter(row => row.course_id === args[0]).map(({ opportunity_id }) => ({ opportunity_id }))]
        if (sql.startsWith('INSERT INTO CAREER_OPPORTUNITY')) {
          if (failCareerWrite) throw Error('Simulated career failure')
          state.careers.push({ opportunity_id: state.careerId++, course_id: args[0], job_title: args[1], salary_range: args[2], description: args[3] }); return [{}]
        }
        if (sql.startsWith('UPDATE CAREER_OPPORTUNITY')) { Object.assign(state.careers.find(row => row.opportunity_id === args[3] && row.course_id === args[4]), { job_title: args[0], salary_range: args[1], description: args[2] }); return [{}] }
        if (sql.startsWith('DELETE FROM CAREER_OPPORTUNITY')) { state.careers = state.careers.filter(row => !(row.opportunity_id === args[0] && row.course_id === args[1])); return [{}] }
        if (sql.startsWith('SELECT course_id FROM COURSE_PUBLICATION')) return [[]]
        if (sql.startsWith('SELECT source_id FROM COURSE_DRAFT_SOURCE')) return [state.sources.filter((row) => row.args[0] === args[0]).map((row, index) => ({ source_id: index + 1 }))]
        if (sql.startsWith('SELECT') && (sql.includes('FROM COURSE_SKILL_PROFILE') || sql.includes('FROM COURSE_RIASEC_PROFILE'))) {
          const table = sql.includes('FROM COURSE_SKILL_PROFILE') ? 'COURSE_SKILL_PROFILE' : 'COURSE_RIASEC_PROFILE'
          const key = table === 'COURSE_SKILL_PROFILE' ? 'skill_domain' : 'riasec_type'
          const rows = new Map()
          for (const call of state.profiles.filter((call) => call.sql.includes(table) && call.args[0] === args[0])) {
            if (call.sql.startsWith('INSERT')) rows.set(call.args[1], { [key]: call.args[1], weight: call.args[2], evidence: call.args[4] ? call.args[3] : rows.get(call.args[1])?.evidence ?? null })
            if (call.sql.startsWith('DELETE')) for (const domain of rows.keys()) if (!call.args.slice(1).includes(domain)) rows.delete(domain)
          }
          return [[...rows.values()].sort((a, b) => a[key].localeCompare(b[key]))]
        }
        if (sql.includes('INSERT INTO COURSE_DRAFT_FIELD_REVISION')) return [{}]
        if (sql.startsWith('SELECT field_key')) return [[]]
        if (sql.startsWith('SELECT admin_id, username')) return [args[0] === 7 ? [{ admin_id: 7, username: 'test-admin' }] : []]
        if (sql.startsWith('INSERT INTO COURSE_DRAFT_SOURCE_CHECK')) {
          if (failCheckWrite) throw new Error('Simulated check evidence failure')
          state.checks.push({ sql, args }); return [{ insertId: state.checks.length }]
        }
        if (sql.startsWith('INSERT INTO COURSE_DRAFT_SOURCE_REVIEW')) { state.reviews.push({ sql, args }); return [{ insertId: state.reviews.length }] }
        if (sql.startsWith('INSERT INTO COURSE_DRAFT_SOURCE (')) { state.sources.push({ sql, args }); return [{ insertId: 800 + state.sources.length }] }
        if (sql.includes('FOR UPDATE') && sql.includes('ALLOCATOR')) {
          const prior = queue
          queue = new Promise((resolve) => { unlock = resolve })
          await prior
          snapshot = structuredClone({ courses: state.courses, profiles: state.profiles, sources: state.sources, checks: state.checks, reviews: state.reviews, careers: state.careers, careerId: state.careerId, next: state.next, id: state.id })
          return [[{ next_number: state.next }]]
        }
        if (sql.startsWith('SELECT *')) return [state.courses.filter((row) => row.course_id === args[0])]
        if (sql.startsWith('SELECT course_id FROM')) return [state.courses.filter((row) => row.course_code === args[0])]
        if (sql.startsWith('SELECT course_id, course_code')) return [structuredClone(state.courses)]
        if (sql.startsWith('UPDATE COURSE_CODE_ALLOCATOR')) { state.next = args[0]; return [{}] }
        if (sql.startsWith('INSERT INTO COURSE (')) {
          const course_id = state.id++
          state.courses.push({ course_id, course_code: args[0], course_name: args[1], cluster_category: args[2], description: args[3], obtainable_skills: args[4], program_type: args[5], psced_group: args[6], course_abbreviation: args[7], is_active: 0, is_draft: 1 })
          return [{ insertId: course_id }]
        }
        if (sql.startsWith('UPDATE COURSE SET course_name')) {
          const row = state.courses.find((row) => row.course_id === args[7])
          Object.assign(row, { course_name: args[0], cluster_category: args[1], description: args[2], obtainable_skills: args[3], program_type: args[4], psced_group: args[5], course_abbreviation: args[6] })
          return [{}]
        }
        if (sql.startsWith('UPDATE COURSE SET program_duration')) {
          Object.assign(state.courses.find((row) => row.course_id === args[2]), { program_duration_years: args[0], year_levels: JSON.parse(args[1]) })
          return [{}]
        }
        if (sql.includes('COURSE_SKILL_PROFILE') || sql.includes('COURSE_RIASEC_PROFILE')) {
          if (failProfileWrite) throw new Error('Simulated profile write failure')
          state.profiles.push({ sql, args }); return [{}]
        }
        throw new Error(`Unexpected SQL: ${sql}`)
      },
      async commit() { state.commits++; unlock?.(); unlock = null },
      async rollback() { if (snapshot) Object.assign(state, snapshot); state.rollbacks++; unlock?.(); unlock = null },
      release() { unlock?.() },
    }
  } }
}

test('complete draft saves details, duration and explicit profiles atomically, with distinct IDs', async () => {
  const db = database()
  const saved = await saveCourseDraft(db, input())
  assert.equal(saved.course_code, 'CRS361')
  assert.equal(saved.courseId, 1400)
  assert.equal(saved.is_draft, true)
  assert.equal(db.state.courses[0].is_active, 0)
  assert.equal(db.state.courses[0].year_levels.length, 2)
  assert.equal(db.state.profiles.filter(({ sql }) => sql.startsWith('INSERT')).length, 7)
  assert.equal(db.state.commits, 1)
})

test('publication-incomplete drafts save without invented evidence or automatic confirmations', async () => {
  const db = database()
  const body = { ...input('Synthetic incomplete publication draft'), course_abbreviation: '', description: '', obtainable_skills: '' }
  for (const row of [...body.skill_profile, ...body.riasec_profile]) row.evidence = ''
  const before = structuredClone(body)
  const saved = await saveCourseDraft(db, body)
  assert.equal(saved.is_draft, true)
  assert.equal(db.state.courses[0].is_active, 0)
  assert.equal(db.state.courses[0].description, null)
  assert.ok(db.state.courses[0].year_levels.every(row => row.overview === ''))
  assert.equal(db.state.sources.length, 0)
  assert.equal(db.state.reviews.length, 0)
  assert.ok(!db.state.calls.some(({ sql }) => /INSERT INTO COURSE_(PUBLICATION|MATCHING_REVIEW)/.test(sql)))
  assert.deepEqual(body, before)
})

test('career entries save atomically, preserve row IDs, omit guesses and protect other courses', async () => {
  const db = database()
  db.state.careers.push({ opportunity_id: 10, course_id: 10, job_title: 'Existing unrelated career' })
  const saved = await saveCourseDraft(db, { ...input(), career_opportunities: [{ job_title: 'Synthetic role', description: 'Synthetic reference only', salary_range: '' }] })
  const row = db.state.careers.find(row => row.course_id === saved.courseId)
  assert.equal(row.salary_range, null)
  const beforeProfiles = structuredClone(db.state.profiles)
  await saveCourseDraft(db, { course_name: 'New Program', cluster_category: 'BUSINESS CLUSTER', description: 'Description', obtainable_skills: 'Communication', career_opportunities: [{ ...row, job_title: 'Edited synthetic role' }] }, saved.courseId)
  assert.equal(db.state.careers.find(career => career.course_id === saved.courseId).opportunity_id, row.opportunity_id)
  assert.deepEqual(db.state.profiles, beforeProfiles)
  const before = structuredClone(db.state.careers)
  await saveCourseDraft(db, { ...input(), course_name: 'New Program' }, saved.courseId)
  assert.deepEqual(db.state.careers, before)
  await assert.rejects(saveCourseDraft(db, { ...input(), career_opportunities: [{ opportunity_id: 10, job_title: 'Foreign row' }] }, saved.courseId), { status: 409 })
  assert.deepEqual(db.state.careers, before)
  assert.equal(db.state.careers[0].job_title, 'Existing unrelated career')
  const failed = database([], false, false, true)
  await assert.rejects(saveCourseDraft(failed, { ...input(), career_opportunities: [{ job_title: 'Synthetic role' }] }), /Simulated career failure/)
  assert.equal(failed.state.courses.length, 0); assert.equal(failed.state.profiles.length, 0); assert.equal(failed.state.next, 361)
  await assert.rejects(saveCourseDraft(db, { ...input(), career_opportunities: [{ job_title: 'x'.repeat(151) }] }), { status: 400 })
})

test('standalone career routes cannot bypass draft saves or published read-only behavior', async () => {
  const db = row => ({ query: async () => [row ? [row] : []] })
  await requireStandaloneCareerEditable(db({ is_draft: 0, published_course_id: null }), { courseId: 1 })
  await assert.rejects(requireStandaloneCareerEditable(db({ is_draft: 1, published_course_id: null }), { courseId: 1 }), { status: 409 })
  await assert.rejects(requireStandaloneCareerEditable(db({ is_draft: 0, published_course_id: 1 }), { careerId: 2 }), { status: 409 })
  await assert.rejects(requireStandaloneCareerEditable(db(null), { careerId: 2 }), { status: 404 })
})

test('concurrent creates serialize allocation and skip occupied codes', async () => {
  const db = database([{ course_id: 10, course_code: 'CRS361', course_name: 'Existing' }])
  const results = await Promise.all([saveCourseDraft(db, input('A')), saveCourseDraft(db, input('B'))])
  assert.deepEqual(results.map((row) => row.course_code), ['CRS362', 'CRS363'])
  assert.equal(db.state.courses[0].course_code, 'CRS361')
})

test('concurrent equivalent names return a friendly conflict and create only one course', async () => {
  const db = database()
  const results = await Promise.allSettled([saveCourseDraft(db, input('New Program')), saveCourseDraft(db, input('  NEW   PROGRAM '))])
  assert.equal(results.filter((row) => row.status === 'fulfilled').length, 1)
  const error = results.find((row) => row.status === 'rejected').reason
  assert.equal(error.status, 409)
  assert.equal(error.details.duplicates[0].course_code, 'CRS361')
  assert.equal(db.state.courses.length, 1)
  assert.equal(db.state.next, 362)
})

test('distinct specializations are not merged or rejected', async () => {
  const db = database()
  await saveCourseDraft(db, input('Education major in English'))
  await saveCourseDraft(db, input('Education major in Mathematics'))
  assert.equal(db.state.courses.length, 2)
})

test('legacy edits preserve code, status, omitted metadata and matching profiles', async () => {
  const original = { course_id: 17, course_code: 'CRS001', course_name: 'Legacy', is_active: 1, is_draft: 0,
    program_type: 'Degree', psced_group: 'Group', course_abbreviation: 'LEG', program_duration_years: null }
  const db = database([original, { ...original, course_id: 18 }])
  const saved = await saveCourseDraft(db, { course_name: 'Legacy', cluster_category: 'BUSINESS CLUSTER', description: 'Updated' }, 17)
  assert.equal(saved.course_code, 'CRS001')
  assert.equal(saved.is_draft, false)
  assert.equal(db.state.courses[0].is_active, 1)
  for (const key of ['course_id', 'course_code', 'is_draft', 'program_type', 'psced_group', 'course_abbreviation', 'program_duration_years']) assert.equal(db.state.courses[0][key], original[key])
  assert.deepEqual(db.state.courses[1], { ...original, course_id: 18 })
  assert.equal(db.state.profiles.length, 0)
  assert.equal(db.state.next, 361)
  assert.ok(db.state.calls.every(({ sql }) => !/RECOMMENDATION|COLLEGE|SEMESTER|CHECKIN/.test(sql)))
})

test('missing existing course returns 404 without writes', async () => {
  const db = database()
  await assert.rejects(saveCourseDraft(db, input(), 999), { status: 404 })
  assert.equal(db.state.commits, 0)
  assert.equal(db.state.rollbacks, 1)
  assert.equal(db.state.profiles.length, 0)
})

test('reuse readiness rules: reject missing/duplicate domains, fractions, blank weights and incomplete RIASEC', () => {
  for (const change of [
    { skill_profile: [] }, { skill_profile: [{ skill_domain: 'Unknown', weight: 2 }] },
    { skill_profile: [{ skill_domain: 'Verbal', weight: 2 }, { skill_domain: 'Verbal', weight: 1 }] },
    { skill_profile: [{ skill_domain: 'Verbal', weight: 1.5 }] },
    { skill_profile: [{ skill_domain: 'Verbal', weight: '' }] },
    { riasec_profile: input().riasec_profile.slice(1) },
    { riasec_profile: input().riasec_profile.map((entry) => ({ ...entry, weight: 4 })) },
    { riasec_profile: Array(6).fill({ riasec_type: 'R', weight: 1 }) },
    { cluster_category: 'Unknown' },
  ]) assert.throws(() => validateDraftInput({ ...input(), ...change }, true), { status: 400 })
  assert.equal(validateDraftInput(input(), true).riasec_profile[0].weight, 0)
})

test('duration and ordered year levels use supported one-to-five-year structure', () => {
  for (const duration of [0, 6, 2.5, '2', null]) assert.throws(() => validateDraftInput({ ...input(), program_duration_years: duration }, true), { status: 400 })
  assert.throws(() => validateDraftInput({ ...input(), year_levels: [{ year: 2, label: 'Second', overview: '' }] }, true))
  assert.throws(() => validateDraftInput({ ...input(), year_levels: input().year_levels.map((entry) => ({ ...entry, label: '' })) }, true))
})

test('allocator refuses overflow without emitting an oversized stable code', async () => {
  await assert.rejects(allocateCourseCode({ query() { throw new Error('Should not query') } }, 10000000), { status: 409 })
})

test('a failed profile save rolls back the new row and code allocation', async () => {
  const db = database([], true)
  await assert.rejects(saveCourseDraft(db, input()), /Simulated profile write failure/)
  assert.equal(db.state.courses.length, 0)
  assert.equal(db.state.next, 361)
  assert.equal(db.state.commits, 0)
  assert.equal(db.state.rollbacks, 1)
})

test('editing a draft keeps its stable code, internal ID and inactive draft flags', async () => {
  const db = database()
  const original = await saveCourseDraft(db, input())
  const updated = await saveCourseDraft(db, { ...input('Renamed program'), course_code: 'CRS999', course_id: 1, is_active: true, is_draft: false }, original.courseId)
  assert.equal(updated.courseId, original.courseId)
  assert.equal(updated.course_code, original.course_code)
  assert.equal(db.state.courses[0].is_active, 0)
  assert.equal(db.state.courses[0].is_draft, 1)
  assert.equal(db.state.courses[0].course_name, 'Renamed program')
})

test('profile updates use scoped upserts and preserve evidence when omitted', async () => {
  const db = database([{ course_id: 17, course_code: 'CRS001', course_name: 'Legacy', is_active: 1, is_draft: 0 }])
  const body = input('Legacy')
  delete body.skill_profile[0].evidence
  await saveCourseDraft(db, body, 17)
  const writes = db.state.profiles.filter(({ sql }) => sql.startsWith('INSERT'))
  assert.equal(writes.length, 7)
  assert.ok(writes.every(({ args, sql }) => args[0] === 17 && /ON DUPLICATE KEY UPDATE/.test(sql)))
  assert.equal(writes[0].args[4], false)
  assert.ok(db.state.profiles.filter(({ sql }) => sql.startsWith('DELETE')).every(({ sql, args }) => /WHERE course_id = \? AND/.test(sql) && args[0] === 17))
})

test('new drafts leave program type and PSCED unset even when an older client supplies them', async () => {
  const db = database()
  await saveCourseDraft(db, { ...input(), program_type: 'Older client type', psced_group: 'Older client value' })
  const insert = db.state.calls.find(({ sql }) => sql.startsWith('INSERT INTO COURSE ('))
  assert.equal(insert.args[5], null)
  assert.equal(insert.args[6], null)
})

test('source-first save is atomic, attributes checks/reviews server-side and binds confirmations to actual saved fields', async () => {
  const priorSecret = process.env.JWT_SECRET
  process.env.JWT_SECRET = 'bundle-unit-test-secret'
  try {
    const course = input('Bachelor of Science in Biology')
    const source = { title: 'Official curriculum', url: 'https://example.edu/biology', notes: '', supported_fields: ['course_name', 'description', 'matching_profile_evidence'] }
    const analyze = createSourceAnalyzer({ fetchImpl: async () => new Response(JSON.stringify({ status: 'completed', output_text: JSON.stringify({ status: 'Needs Review', reason: 'Only a program name was supplied.', relationship: { kind: 'Insufficient evidence', source_programs: [], explanation: 'Supporting target information was not established.', excerpts: [] }, claims: sourceAnalysisFields(source).map(field => ({ field, support: 'unresolved', explanation: 'Review supporting evidence manually.', excerpts: [] })), manual_review: ['Supporting course details were not found.'] }) }), { headers: { 'content-type': 'application/json' } }) })
    const checked = await checkUnsavedSource(source.url, 7, { courseName: 'Bachelor of Science in Biology', source, course, analyze: args => analyze({ ...args, config: { ...sourceAiConfiguration({}), enabled: true, apiKey: 'mock-only-key' } }), fetch: async () => ({ bytes: Buffer.from('<h1>Bachelor of Science in Biology</h1>'), type: 'text/html', final_url: source.url }), parse: async (bytes) => htmlBlocks(bytes.toString()) })
    const confirmation = confirmUnsavedSource({ source, course, confirmed: true, check_receipt: checked.check_receipt }, 7)
    const bundleSource = { ...source, check_receipt: checked.check_receipt, confirmation_receipt: confirmation.confirmation_receipt, reviewer_id: 999, report: { status: 'Forged unsigned result' } }
    const db = database()
    const result = await saveCourseDraft(db, { ...course, sources: [bundleSource] }, null, 7)
    assert.equal(result.is_draft, true)
    assert.equal(db.state.sources.length, 1)
    assert.equal(db.state.checks.length, 1)
    assert.equal(db.state.reviews.length, 1)
    assert.equal(db.state.checks[0].args[2], 7)
    assert.equal(JSON.parse(db.state.checks[0].args[1]).target_course_name, course.course_name)
    assert.equal(JSON.parse(db.state.checks[0].args[1]).method, 'AI')
    assert.ok(JSON.parse(db.state.checks[0].args[1]).saved_field_revisions)
    assert.equal(db.state.reviews[0].args[6], 7)
    assert.doesNotMatch(db.state.reviews[0].sql, /reviewed_at/)
    assert.equal(JSON.parse(db.state.reviews[0].args[5]).description, course.description)
    assert.equal(db.state.courses[0].is_active, 0)
    assert.equal(db.state.commits, 1)
    const stale = database()
    await assert.rejects(saveCourseDraft(stale, { ...course, description: 'Changed after confirmation', sources: [bundleSource] }, null, 7), { status: 409 })
    assert.equal(stale.state.courses.length, 0)
    assert.equal(stale.state.next, 361)
    assert.equal(stale.state.sources.length, 0)
    const staleName = database()
    await assert.rejects(saveCourseDraft(staleName, { ...course, course_name: 'Changed target', sources: [{ ...source, check_receipt: checked.check_receipt }] }, null, 7), { status: 409 })
    assert.equal(staleName.state.courses.length, 0)
    assert.equal(staleName.state.next, 361)
    const failed = database([], false, true)
    await assert.rejects(saveCourseDraft(failed, { ...course, sources: [bundleSource] }, null, 7), /Simulated check evidence failure/)
    assert.equal(failed.state.courses.length, 0)
    assert.equal(failed.state.sources.length, 0)
    assert.equal(failed.state.next, 361)
    await assert.rejects(saveCourseDraft(database(), { ...course, sources: [bundleSource] }, null, 8), { status: 409 })
  } finally { if (priorSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = priorSecret }
})




test('new and saved drafts enforce three total sources without changing existing sources', async () => {
  const sources = Array.from({length:4},(_,i)=>({title:`Source ${i}`,url:`https://example.edu/${i}`,supported_fields:['course_name'],notes:''}))
  const db=database()
  await assert.rejects(saveCourseDraft(db,{...input(),sources},null,7),{status:400})
  assert.equal(db.state.calls.length,0)
  assert.equal((await saveCourseDraft(db,{...input(),sources:sources.slice(0,3)},null,7)).is_draft,true)
  assert.equal(db.state.sources.length,3)
  const existing=database([{course_id:1,course_code:'CRS001',course_name:'Old draft',cluster_category:'BUSINESS CLUSTER',is_draft:1,is_active:0}])
  await assert.rejects(saveCourseDraft(existing,{...input('Old draft'),sources},1,7),{status:400})
  assert.equal(existing.state.sources.length,0)
  await saveCourseDraft(existing,{...input('Old draft'),sources:sources.slice(0,2)},1,7)
  await assert.rejects(saveCourseDraft(existing,{...input('Old draft'),sources:sources.slice(0,2)},1,7),{status:400})
  assert.equal(existing.state.sources.length,2)
})
