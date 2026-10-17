import test from 'node:test'
import assert from 'node:assert/strict'
import { emptyDraftFields, draftFormFromCourse, resizeCourseYears, buildDraftPayload } from './courseDraftForm.js'

test('new form has no guessed profile weights and requires duration/profiles', () => {
  assert.ok(emptyDraftFields.riasec_profile.every((entry) => entry.weight === ''))
  const result = buildDraftPayload(emptyDraftFields, true)
  assert.ok(result.errors.program_duration_years)
  assert.ok(result.errors.matching_profiles)
})

test('career values survive reload, ignore unused slots, and use the actual existing title limit', () => {
  const form = draftFormFromCourse({ course: {}, careers: [{ opportunity_id: 4, job_title: 'Synthetic career', salary_range: null, description: 'Source-supported test description' }] })
  assert.equal(form.career_opportunities[0].salary_range, '')
  const changed = { ...form, career_opportunities: [...form.career_opportunities, { job_title: '', salary_range: '', description: '' }] }
  const payload = buildDraftPayload(changed, true).payload.career_opportunities
  assert.equal(payload.length, 1); assert.equal(payload[0].opportunity_id, 4)
  assert.equal(buildDraftPayload({ ...form, career_opportunities: [{ job_title: 'x'.repeat(151) }] }, true).errors.career_opportunities, 'Career job title must use at most 150 characters.')
  assert.equal(buildDraftPayload({ ...form, career_opportunities: [{ job_title: '', description: 'Entered partial row' }] }, true).errors.career_opportunities, 'Enter a job title for each career opportunity you include.')
  assert.equal(Object.hasOwn(buildDraftPayload(form, false).payload, 'career_opportunities'), false)
  assert.equal(Object.hasOwn(buildDraftPayload(form, true, form).payload, 'career_opportunities'), false)
})

test('loaded profiles preserve exact weights/evidence and zero is explicit', () => {
  const form = draftFormFromCourse({ course: { program_duration_years: 1, year_levels: [{ year: 1, label: 'First', overview: 'Foundation' }] },
    skillProfile: [{ skill_domain: 'Verbal', weight: 3, evidence: 'Existing evidence' }],
    riasecProfile: emptyDraftFields.riasec_profile.map((row) => ({ ...row, weight: 0 })) })
  const result = buildDraftPayload(form, true)
  assert.deepEqual(result.errors, {})
  assert.deepEqual(result.payload.skill_profile, form.skill_profile)
  assert.ok(result.payload.riasec_profile.every((entry) => entry.weight === 0))
  assert.equal(resizeCourseYears(form, '2').year_levels[0].overview, 'Foundation')
  assert.equal(resizeCourseYears(form, '2').year_levels[1].year, 2)
})

test('legacy missing optional data is omitted rather than overwritten or invented', () => {
  const form = draftFormFromCourse({ course: {} })
  const result = buildDraftPayload(form, false)
  assert.deepEqual(result.errors, {})
  assert.equal(Object.hasOwn(result.payload, 'program_duration_years'), false)
  assert.equal(Object.hasOwn(result.payload, 'skill_profile'), false)
})

test('saving only legacy description does not rewrite duration or profiles', () => {
  const initial = draftFormFromCourse({ course: { program_duration_years: 4, year_levels: [{ year: 1, label: 'First', overview: 'Legacy' }] },
    skillProfile: [{ skill_domain: 'Verbal', weight: 2, evidence: null }] })
  const result = buildDraftPayload({ ...initial, description: 'Updated' }, false, initial)
  assert.deepEqual(result.errors, {})
  assert.equal(Object.hasOwn(result.payload, 'program_duration_years'), false)
  assert.equal(Object.hasOwn(result.payload, 'year_levels'), false)
  assert.equal(Object.hasOwn(result.payload, 'skill_profile'), false)
  assert.equal(Object.hasOwn(result.payload, 'riasec_profile'), false)
})

test('hidden legacy fields are neither loaded into the form nor sent on create/edit', () => {
  const loaded = draftFormFromCourse({ course: { program_type: 'Legacy program type', psced_group: 'Legacy PSCED' } })
  for (const key of ['program_type', 'psced_group']) {
    assert.equal(Object.hasOwn(emptyDraftFields, key), false)
    assert.equal(Object.hasOwn(loaded, key), false)
  }
  for (const requireComplete of [true, false]) {
    const { payload } = buildDraftPayload({ ...loaded, program_type: '', psced_group: '' }, requireComplete)
    assert.equal(Object.hasOwn(payload, 'program_type'), false)
    assert.equal(Object.hasOwn(payload, 'psced_group'), false)
  }
})
