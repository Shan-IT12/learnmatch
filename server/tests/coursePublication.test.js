import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import jwt from 'jsonwebtoken'
import pool from '../config/db.js'
import authenticateAdmin from '../middleware/authenticateAdmin.js'
import { ADMIN_JWT_AUDIENCE, USER_JWT_AUDIENCE, jwtSignOptions } from '../config/security.js'
import { createCoursePublicationRouter } from '../routes/coursePublicationRoutes.js'
import { getPublicationReview, confirmMatchingReview, publishCourse } from '../services/coursePublicationService.js'
import { captureDraftReviewFields, sourceContext, bumpDraftReviewFields, saveDraftSource, reviewDraftSource, listDraftSources } from '../services/draftSourceService.js'
import { getAvailablePublicCourse, searchAvailablePublicCourses, getPublicCourse } from '../services/publicCourseService.js'
import { searchActiveCollegeCourses } from '../services/collegeCourseSearchService.js'
import { createCollegeSetup } from '../services/collegeTrackingService.js'
import { getTopCourseRecommendations, scoreAndRankClusters, buildStudentRiasecVector } from '../services/recommendationService.js'
import { INTEREST_RIASEC_MAP } from '../config/interestRiasecConfig.js'
import { saveCourseDraft } from '../services/courseDraftService.js'
import { draftFormFromCourse, buildDraftPayload } from '../../client/src/utils/courseDraftForm.js'
import { getSchoolsForCourse } from '../services/schoolLocatorService.js'
import { SKILL_DOMAINS } from '../config/recommendationConfig.js'
import { COURSE_SOURCE_FIELDS } from '../../shared/courseSourceFields.js'

// Synthetic hosts are explicitly approved only inside this test worker.
const previousApprovedHosts = process.env.SOURCE_APPROVED_PUBLISHER_HOSTS
process.env.SOURCE_APPROVED_PUBLISHER_HOSTS = 'example.edu,official.example.edu'
test.after(() => { if (previousApprovedHosts === undefined) delete process.env.SOURCE_APPROVED_PUBLISHER_HOSTS; else process.env.SOURCE_APPROVED_PUBLISHER_HOSTS = previousApprovedHosts })

// Deliberately synthetic values, not real course assignments. No database connections.
function fixture() {
  const state = {
    course: { course_id: 9001, course_code: 'CRS1000', course_name: 'Synthetic Publication Fixture', course_abbreviation: 'SPF', cluster_category: 'BUSINESS CLUSTER', description: 'Fixture only description.', obtainable_skills: 'Fixture communication', program_duration_years: 2, year_levels: [1, 2].map((year) => ({ year, label: `Year ${year}`, overview: 'Fixture curriculum overview.' })), is_draft: 1, is_active: 0 },
    skills: [{ skill_domain: 'Verbal', weight: 2, evidence: 'Synthetic fixture evidence, not a production weight.' }],
    riasec: ['R', 'I', 'A', 'S', 'E', 'C'].map((riasec_type) => ({ riasec_type, weight: 1, evidence: 'Synthetic fixture evidence.' })),
    sources: [{ source_id: 80, course_id: 9001, source_revision: 1, title: 'Synthetic source', url: 'https://example.edu/fixture.pdf', notes: 'Fixture pages 1-2.', supported_fields: Object.keys(COURSE_SOURCE_FIELDS), is_removed: 0 }],
    sourceReviews: [], matching: [], publication: null, revisions: {}, rollbacks: 0, failActivation: false, terms: [], careers: [],
  }
  const clone = structuredClone
  const visible = () => state.course.is_active === 1 && state.course.is_draft === 0
  const query = async (sql, args = []) => {
    if (sql.startsWith('SELECT * FROM CAREER_OPPORTUNITY')) return [clone(state.careers.filter(row => args.includes(row.course_id)))]
    if (sql.startsWith('SELECT course_id, course_code, course_name FROM COURSE') && !sql.includes('WHERE')) return [[{ course_id: state.course.course_id, course_code: state.course.course_code, course_name: state.course.course_name }]]
    if (sql.startsWith('UPDATE COURSE SET course_name')) {
      const [course_name, cluster_category, description, obtainable_skills, program_type, psced_group, course_abbreviation, course_id] = args
      assert.equal(course_id, state.course.course_id)
      Object.assign(state.course, { course_name, cluster_category, description, obtainable_skills, program_type, psced_group, course_abbreviation }); return [{ affectedRows: 1 }]
    }
    if (sql.startsWith('UPDATE COURSE_DRAFT_SOURCE SET title')) {
      const [title, url, supported_fields, notes, course_id, source_id] = args
      const source = state.sources.find(row => row.course_id === course_id && row.source_id === source_id)
      if (source.url !== url) source.check_digest = null
      Object.assign(source, { title, url, supported_fields: JSON.parse(supported_fields), notes, source_revision: source.source_revision + 1 }); return [{ affectedRows: 1 }]
    }
    if (sql.startsWith('INSERT INTO COURSE_DRAFT_SOURCE_REVIEW')) {
      const [source_id, source_revision, context_token, field_revisions, source_snapshot, claim_snapshot, reviewer_id, reviewer_label] = args
      state.sourceReviews.push({ review_id: state.sourceReviews.length + 1, source_id, source_revision, context_token, field_revisions, source_snapshot, claim_snapshot, reviewer_id, reviewer_label, reviewed_at: '2026-10-17T02:00:00Z' }); return [{ insertId: state.sourceReviews.length }]
    }
    if (sql.startsWith('SELECT c.* FROM COURSE_DRAFT_SOURCE_CHECK')) return [[]]
    if (sql.startsWith('SELECT next_number')) return [[{ next_number: 1001 }]]
    if (sql.startsWith('SELECT course_id FROM COURSE_PUBLICATION')) return [state.publication ? [{ course_id: 9001 }] : []]
    if (sql.startsWith('SELECT * FROM COURSE WHERE')) return [args[0] === 9001 ? [clone(state.course)] : []]
    if (sql.startsWith('SELECT * FROM COURSE_PUBLICATION')) return [state.publication ? [clone(state.publication)] : []]
    if (sql.startsWith('SELECT skill_domain')) return [clone(state.skills)]
    if (sql.startsWith('SELECT riasec_type')) return [clone(state.riasec)]
    if (sql.startsWith('SELECT field_key')) return [Object.entries(state.revisions).map(([field_key, revision]) => ({ field_key, revision }))]
    if (sql.startsWith('SELECT * FROM COURSE_DRAFT_SOURCE')) return [clone(state.sources)]
    if (sql.startsWith('SELECT r.*')) return [clone(state.sourceReviews).reverse()]
    if (sql.startsWith('SELECT * FROM COURSE_MATCHING_REVIEW')) return [clone(state.matching).reverse()]
    if (sql.startsWith('SELECT admin_id, username')) return [args[0] === 7 ? [{ admin_id: 7, username: 'fixture-admin' }] : []]
    if (sql.startsWith('INSERT INTO COURSE_MATCHING_REVIEW')) {
      const [course_id, context_token, review_snapshot, reviewer_id, reviewer_label] = args
      state.matching.push({ matching_review_id: state.matching.length + 1, course_id, context_token, review_snapshot, reviewer_id, reviewer_label, reviewed_at: '2026-10-17T01:00:00Z' }); return [{ insertId: state.matching.length }]
    }
    if (sql.startsWith('INSERT INTO COURSE_PUBLICATION')) {
      assert.equal(state.publication, null)
      const [course_id, matching_review_id, context_token, publication_snapshot, published_by, publisher_label] = args
      state.publication = { course_id, matching_review_id, context_token, publication_snapshot, published_by, publisher_label, published_at: '2026-10-17T01:01:00Z' }; return [{ affectedRows: 1 }]
    }
    if (sql.startsWith('UPDATE COURSE SET is_draft')) {
      if (state.failActivation) throw new Error('Fixture activation failure')
      state.course.is_draft = 0; state.course.is_active = 1; return [{ affectedRows: 1 }]
    }
    if (sql.startsWith('INSERT INTO COURSE_DRAFT_FIELD_REVISION')) { state.revisions[args[1]] = (state.revisions[args[1]] || 1) + 1; return [{}] }
    if (sql.startsWith('SELECT course_code FROM COURSE')) { assert.match(sql, /is_draft = 0/); return [visible() ? [{ course_code: state.course.course_code }] : []] }
    if (sql.includes('JOIN COURSE_PUBLICATION')) {
      assert.match(sql, /c.is_draft = 0/)
      return [visible() && state.publication && (!args.length || args[0] === state.course.course_code) ? [clone(state.course)] : []]
    }
    if (sql.includes('FROM SCHOOL_COURSE')) return [[]]
    if (sql.includes('WHERE course_code = ? AND is_active')) return [visible() ? [clone(state.course)] : []]
    if (sql.includes('AS is_published_new')) {
      assert.match(sql, /is_draft = 0/)
      return [visible() ? [{ ...clone(state.course), is_published_new: state.publication ? 1 : 0 }] : []]
    }
    if (sql.includes('FROM COLLEGE_TRACKING_CYCLE') && sql.includes("status = 'active'")) return [[{ tracking_cycle_id: 51, user_id: 10, course_id: 9001, status: 'active' }]]
    if (sql.includes('FROM COLLEGE_TERM')) return [clone(state.terms)]
    if (sql.startsWith('INSERT INTO COLLEGE_TERM')) { state.terms.push({ term_id: 44, args }); return [{ insertId: 44 }] }
    if (sql.startsWith('SELECT course_id, course_code, course_name FROM COURSE WHERE')) { assert.match(sql, /is_draft = 0/); return [visible() ? [clone(state.course)] : []] }
    throw new Error(`Unexpected fixture query: ${sql}`)
  }
  let queue = Promise.resolve()
  const database = { query, state, async getConnection() {
    let releaseLock, snapshot
    return { query, async beginTransaction() {
      const previous = queue; queue = new Promise((resolve) => { releaseLock = resolve }); await previous
      snapshot = clone(state)
    }, async commit() { releaseLock(); releaseLock = null }, async rollback() {
      Object.assign(state, snapshot); state.rollbacks++; releaseLock?.(); releaseLock = null
    }, release() { releaseLock?.() } }
  } }
  const confirmSource = async () => {
    const fields = await captureDraftReviewFields(database, state.course)
    const token = sourceContext(state.sources[0], fields, state.revisions).token
    state.sourceReviews.push({ review_id: state.sourceReviews.length + 1, source_id: 80, context_token: token, reviewer_id: 7, reviewer_label: 'fixture-admin', reviewed_at: '2026-10-17T00:00:00Z' })
  }
  return { database, state, confirmSource }
}
async function ready(f) {
  await f.confirmSource()
  const review = await getPublicationReview(f.database, 9001)
  await confirmMatchingReview(f.database, 9001, { expected_token: review.review_token, confirmed: true, reviewer_id: 999 }, 7)
  return getPublicationReview(f.database, 9001)
}
const publish = (f, review) => publishCourse(f.database, 9001, { expected_token: review.review_token, publish_confirmed: true, published_by: 999 }, 7)

test('actual source selection -> explicit confirmation -> unchanged draft saves -> publication retains coverage, while relevant edits invalidate history', async () => {
  const f = fixture(), courseId = f.state.course.course_id
  f.state.sources[0].supported_fields = ['duration', 'obtainable_skills']
  const initialForm = { ...draftFormFromCourse({ course: f.state.course, skillProfile: f.state.skills, riasecProfile: f.state.riasec }), course_name: f.state.course.course_name, cluster_category: f.state.course.cluster_category, description: f.state.course.description, obtainable_skills: f.state.course.obtainable_skills }
  const { payload, errors } = buildDraftPayload(initialForm, true, structuredClone(initialForm))
  assert.deepEqual(errors, {})
  assert.equal(Object.hasOwn(payload, 'sources'), false, 'Existing sources have their own versioned save endpoint')
  let source = (await listDraftSources(f.database, courseId))[0]
  await reviewDraftSource(f.database, courseId, source.source_id, { confirmed: true, expected_token: source.review_token }, 7)
  await saveCourseDraft(f.database, payload, courseId, 7)
  let review = await getPublicationReview(f.database, courseId)
  assert.ok(review.sources[0].current_review, 'An unchanged save must preserve the confirmation')
  for (const field of ['course_name', 'description', 'matching_profile_evidence']) assert.ok(review.fieldErrors[`source_${field}`], 'Review context is not automatically confirmed support')
  assert.equal(review.fieldErrors.source_duration, undefined)
  assert.equal(review.fieldErrors.source_obtainable_skills, undefined)
  assert.deepEqual(JSON.parse(f.state.sourceReviews[0].source_snapshot).supported_fields, ['duration', 'obtainable_skills'])

  // The admin explicitly changes selections and saves them; this does not itself confirm anything.
  source = (await listDraftSources(f.database, courseId))[0]
  await saveDraftSource(f.database, courseId, { ...source, supported_fields: Object.keys(COURSE_SOURCE_FIELDS) }, source.source_id)
  review = await getPublicationReview(f.database, courseId)
  assert.equal(review.sources[0].current_review, null)
  source = (await listDraftSources(f.database, courseId))[0]
  await reviewDraftSource(f.database, courseId, source.source_id, { confirmed: true, expected_token: source.review_token, reviewer_id: 999 }, 7)
  const history = structuredClone(f.state.sourceReviews)
  for (let i = 0; i < 2; i++) await saveCourseDraft(f.database, payload, courseId, 7)
  const reopenedSources = await listDraftSources(f.database, courseId)
  assert.deepEqual([...reopenedSources[0].supported_fields].sort(), Object.keys(COURSE_SOURCE_FIELDS).sort())
  assert.equal(reopenedSources[0].review_status, 'confirmed')
  assert.deepEqual(reopenedSources[0].reviews.filter(entry => entry.current).map(entry => entry.reviewer_id), [7])
  review = await getPublicationReview(f.database, courseId)
  assert.ok(review.sources[0].current_review)
  assert.equal(review.sources[0].current_review.reviewer_id, 7)
  assert.deepEqual(Object.keys(review.fieldErrors).filter(key => key.startsWith('source')), [])
  assert.equal(review.ready, false, 'Separate matching review is still required')
  await confirmMatchingReview(f.database, courseId, { expected_token: review.review_token, confirmed: true }, 7)
  assert.equal((await getPublicationReview(f.database, courseId)).ready, true)
  assert.deepEqual(f.state.sourceReviews, history)
  assert.deepEqual(f.state.revisions, {})

  await saveCourseDraft(f.database, { ...payload, description: 'Relevant edited description in synthetic fixture.' }, courseId, 7)
  review = await getPublicationReview(f.database, courseId)
  assert.equal(review.sources[0].current_review, null)
  assert.ok(review.fieldErrors.source_description)
  assert.equal(f.state.revisions.description, 2)
  await assert.rejects(reviewDraftSource(f.database, courseId, source.source_id, { confirmed: true, expected_token: source.review_token }, 7), { status: 409 })
  await saveCourseDraft(f.database, payload, courseId, 7)
  assert.equal(f.state.revisions.description, 3)
  assert.equal((await getPublicationReview(f.database, courseId)).sources[0].current_review, null, 'Changing back must not resurrect old confirmations')
  assert.deepEqual(f.state.sourceReviews, history)
  assert.equal(f.state.publication, null)
  assert.equal(f.state.course.is_active, 0)
})

test('publication blockers are field-specific; automated success never substitutes for manual or matching review', async () => {
  const f = fixture()
  f.state.sources[0].report = { status: 'Potential Match' }
  f.state.course.description = ''; f.state.course.year_levels[0].overview = ''
  f.state.skills[0].evidence = ''
  const review = await getPublicationReview(f.database, 9001)
  for (const key of ['description', 'year_levels', 'skill_profile', 'source_80', 'matching_review']) assert.ok(review.fieldErrors[key], key)
  await assert.rejects(publish(f, review), { status: 422 })
  assert.equal(f.state.publication, null); assert.equal(f.state.course.is_active, 0)
  f.state.course = { ...f.state.course, course_code: 'INVALID', cluster_category: 'Unknown', program_duration_years: 3 }
  const invalid = await getPublicationReview(f.database, 9001)
  assert.ok(invalid.fieldErrors.course_code); assert.ok(invalid.fieldErrors.cluster_category); assert.ok(invalid.fieldErrors.year_levels)
})

test('manual scanned-PDF confirmation permits publication without a successful check; reviewer attribution is server-only', async () => {
  const f = fixture()
  f.state.sources[0].report = { status: 'Needs Review', reasons: ['Scanned PDF requires manual review.'] }
  const review = await ready(f)
  assert.equal(review.ready, true)
  await publish(f, review)
  assert.equal(f.state.matching[0].reviewer_id, 7); assert.equal(f.state.publication.published_by, 7)
  assert.equal(f.state.matching[0].reviewer_label, 'fixture-admin')
  assert.equal(f.state.course.course_id, 9001); assert.equal(f.state.course.course_code, 'CRS1000')
  assert.equal(f.state.sources[0].report.status, 'Needs Review')
  assert.equal(f.state.course.is_draft, 0); assert.equal(f.state.course.is_active, 1)
  assert.equal((await getPublicationReview(f.database, 9001)).read_only, true)
  await assert.rejects(saveCourseDraft(f.database, { ...f.state.course }, 9001, 7), { status: 409 })
})

test('relevant edits, change/revert revisions, source changes and new review records reject stale publication', async () => {
  const f = fixture(); const review = await ready(f)
  const before = await captureDraftReviewFields(f.database, f.state.course)
  f.state.course.description += ' changed'
  await bumpDraftReviewFields(f.database, 9001, before, await captureDraftReviewFields(f.database, f.state.course))
  f.state.course.description = before.description
  await assert.rejects(publish(f, review), { status: 409 })
  const changed = await getPublicationReview(f.database, 9001)
  assert.ok(changed.fieldErrors.matching_review); assert.ok(changed.fieldErrors.source_80)
  assert.equal(changed.matching_history.length, 1)
  await assert.rejects(confirmMatchingReview(f.database, 9001, { expected_token: review.review_token, confirmed: true }, 7), { status: 409 })
  for (const mutate of [g => { g.state.skills[0].weight = 3 }, g => { g.state.sources[0].notes += ' changed' }, async g => { await g.confirmSource() }]) {
    const g = fixture(); const saved = await ready(g); await mutate(g)
    await assert.rejects(publish(g, saved), { status: 409 })
  }
})

test('atomic publication rolls back audit and activation together, and concurrent/duplicate submissions publish once', async () => {
  const f = fixture(); const review = await ready(f)
  f.state.failActivation = true
  await assert.rejects(publish(f, review), /Fixture activation failure/)
  assert.equal(f.state.publication, null); assert.equal(f.state.course.is_draft, 1); assert.equal(f.state.course.is_active, 0)
  assert.equal(f.state.matching.length, 1)
  f.state.failActivation = false
  const results = await Promise.allSettled([publish(f, review), publish(f, review)])
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1)
  assert.equal(results.find((r) => r.status === 'rejected').reason.status, 409)
  await assert.rejects(publish(f, review), { status: 409 })
})

test('publication requires explicit confirmations, admin identity, all source claims, and at most three sources', async () => {
  const f = fixture(); await f.confirmSource()
  let review = await getPublicationReview(f.database, 9001)
  await assert.rejects(confirmMatchingReview(f.database, 9001, { expected_token: review.review_token }, 7), { status: 400 })
  await assert.rejects(confirmMatchingReview(f.database, 9001, { expected_token: review.review_token, confirmed: true }, 9), { status: 403 })
  review = await ready(f)
  await assert.rejects(publishCourse(f.database, 9001, { expected_token: review.review_token }, 7), { status: 422 })
  f.state.sources[0].supported_fields = ['course_name']; await f.confirmSource()
  review = await getPublicationReview(f.database, 9001)
  assert.ok(review.fieldErrors.source_duration); assert.ok(review.fieldErrors.source_matching_profile_evidence)
  f.state.sources = Array.from({ length: 4 }, (_, index) => ({ ...f.state.sources[0], source_id: 80 + index }))
  assert.ok((await getPublicationReview(f.database, 9001)).fieldErrors.sources)
  await assert.rejects(getPublicationReview(f.database, 123), { status: 404 })
  f.state.course.is_draft = 0
  await assert.rejects(getPublicationReview(f.database, 9001), { status: 409 })
})

test('Search/details and College discover only published new database content, retaining canonical content and no fabricated offerings', async () => {
  const f = fixture()
  const original = getPublicCourse('CRS001')
  assert.deepEqual(await searchAvailablePublicCourses('Synthetic', {}, f.database), [])
  assert.equal(await getAvailablePublicCourse('CRS1000', f.database), null)
  assert.deepEqual(await searchActiveCollegeCourses(f.database, 'Synthetic'), [])
  const review = await ready(f); await publish(f, review)
  assert.equal((await searchAvailablePublicCourses('SPF', {}, f.database))[0].course_code, 'CRS1000')
  const details = await getAvailablePublicCourse('CRS1000', f.database)
  assert.equal(details.course_name, f.state.course.course_name)
  assert.deepEqual(details.year_levels, f.state.course.year_levels)
  assert.deepEqual(details.career_opportunities, [])
  assert.equal((await searchActiveCollegeCourses(f.database, 'Synthetic'))[0].program_duration_years, 2)
  assert.deepEqual(getPublicCourse('CRS001'), original)
  assert.deepEqual((await getSchoolsForCourse('CRS1000', f.database)).schools, [])
  f.state.course.is_active = 0
  assert.equal(await getAvailablePublicCourse('CRS1000', f.database), null)
})

test('career edits reject stale publication without approving matching weights; published details use saved careers', async () => {
  const f = fixture()
  const first = await ready(f)
  f.state.careers.push({ opportunity_id: 41, course_id: 9001, job_title: 'Synthetic career only', salary_range: null, description: 'Synthetic supported description.' })
  await assert.rejects(publish(f, first), { status: 409 })
  assert.equal(f.state.publication, null)
  const updated = await getPublicationReview(f.database, 9001)
  assert.ok(updated.matching_review)
  assert.equal(updated.careers[0].job_title, 'Synthetic career only')
  await publish(f, updated)
  const details = await getAvailablePublicCourse('CRS1000', f.database)
  assert.equal(details.career_opportunities[0].career_title, 'Synthetic career only')
  assert.equal(details.career_opportunities[0].estimated_monthly_salary_php, null)
  assert.equal(details.career_opportunities[0].philippines_description, 'Synthetic supported description.')
})

test('College setup uses published database duration and internal ID without changing existing terms', async () => {
  const f = fixture()
  const input = { courseId: 9001, academicYear: '2026-2027', yearLevel: '2nd Year', semester: '1st Semester', semesterStartDate: '2026-08-01', semesterEndDate: '2026-12-15' }
  await assert.rejects(createCollegeSetup(f.database, 10, input), { code: 'COURSE_UNAVAILABLE' })
  await publish(f, await ready(f))
  await assert.rejects(createCollegeSetup(f.database, 10, { ...input, yearLevel: '3rd Year' }), { code: 'INVALID_PROGRAM_STAGE' })
  assert.equal(f.state.terms.length, 0)
  const created = await createCollegeSetup(f.database, 10, input)
  assert.equal(created.created, true); assert.equal(f.state.terms.length, 1)
  assert.ok(f.state.terms[0].args.includes(9001))
})

test('WSM candidates admit published new courses through existing scoring and cluster eligibility, excluding drafts', async () => {
  const f = fixture()
  // Select a fixture interest from the existing engine mapping, not a new scoring rule.
  const selectedInterest = Object.keys(INTEREST_RIASEC_MAP)[0]
  const studentDomainScores = Object.fromEntries(SKILL_DOMAINS.map((domain) => [domain, 1]))
  const clusters = scoreAndRankClusters({ studentDomainScores, studentRiasecVector: buildStudentRiasecVector([selectedInterest]), mbtiType: 'ENTJ', personalFactorResponses: { physical: 1, health: 1, financial: 1, family: 1, work: 1 } })
  f.state.course.cluster_category = clusters[0].cluster_category
  const wsm = { async query(sql) {
    if (sql.includes('FROM SKILL_RESPONSE')) return [SKILL_DOMAINS.flatMap((dimension) => Array.from({ length: 5 }, () => ({ dimension, is_correct: 1 })))]
    if (sql.includes('FROM INTEREST_RESPONSE')) return [[{ interest_name: selectedInterest }]]
    if (sql.includes('FROM PERSONALITY_ASSESSMENT')) return [[{ assessment_id: 1, mbti_type: 'ENTJ' }]]
    if (sql.includes('FROM PROFILE')) return [[{ personal_factor_answers: { physical: 'no', health: 'no', financial: 'no', family: 'no', work: 'no' }, physical_accessibility_areas: [], physical_accessibility_difficulties: {}, factor_physical_impact: null, factor_health_impact: null, factor_financial_impact: null, factor_family_impact: null, factor_work_impact: null }]]
    assert.match(sql, /is_active = 1/); assert.match(sql, /is_draft = 0/)
    if (!f.state.course.is_active || f.state.course.is_draft) return [[]]
    if (sql.includes('FROM COURSE_SKILL_PROFILE')) return [f.state.skills.map((row) => ({ ...row, course_id: 9001 }))]
    if (sql.includes('FROM COURSE_RIASEC_PROFILE')) return [f.state.riasec.map((row) => ({ ...row, course_id: 9001 }))]
    if (sql.includes('FROM COURSE')) return [[f.state.course]]
    throw new Error(`Unexpected WSM fixture query: ${sql}`)
  } }
  await assert.rejects(getTopCourseRecommendations(wsm, 10), /No active courses/)
  await publish(f, await ready(f))
  const results = await getTopCourseRecommendations(wsm, 10)
  assert.equal(results[0].course_code, 'CRS1000')
  assert.ok(Number.isFinite(results[0].match_score))
})

test('publication HTTP endpoints enforce admin JWT authorization, stale revisions and server-only attribution', async () => {
  const f = fixture(); await f.confirmSource()
  const priorSecret = process.env.JWT_SECRET; process.env.JWT_SECRET = 'fixture-only-publication-secret'
  const originalQuery = pool.query
  pool.query = async () => [[{ admin_id: 7 }]]
  const app = express(); app.use(express.json()); app.use('/courses/:courseId/publication', createCoursePublicationRouter(f.database, authenticateAdmin))
  const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)) })
  const base = `http://127.0.0.1:${server.address().port}/courses/9001/publication`
  const adminToken = jwt.sign({ role: 'admin', adminId: 7 }, process.env.JWT_SECRET, jwtSignOptions(ADMIN_JWT_AUDIENCE, '5m'))
  const userToken = jwt.sign({ role: 'user', userId: 1 }, process.env.JWT_SECRET, jwtSignOptions(USER_JWT_AUDIENCE, '5m'))
  const call = (suffix = '', body, token = adminToken) => fetch(base + suffix, { method: body ? 'POST' : 'GET', headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) })
  try {
    for (const suffix of ['', '/matching-review', '/publish']) {
      assert.equal((await call(suffix, suffix ? {} : undefined, null)).status, 401)
      assert.equal((await call(suffix, suffix ? {} : undefined, userToken)).status, 403)
    }
    assert.equal((await call('/publish', { expected_token: 'old', publish_confirmed: true })).status, 409)
    const review = await (await call()).json()
    assert.equal((await call('/matching-review', { expected_token: review.review_token, confirmed: true, reviewer_id: 999 })).status, 200)
    assert.equal(f.state.matching[0].reviewer_id, 7)
    assert.equal((await call('/publish', { expected_token: review.review_token, publish_confirmed: true })).status, 409)
    const fresh = await (await call()).json()
    assert.equal((await call('/publish', { expected_token: fresh.review_token, publish_confirmed: true })).status, 200)
    assert.equal((await call('/publish', { expected_token: fresh.review_token, publish_confirmed: true })).status, 409)
  } finally {
    server.closeAllConnections(); await new Promise((resolve) => server.close(resolve))
    pool.query = originalQuery
    if (priorSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = priorSecret
  }
})
after(() => pool.end())
