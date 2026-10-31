import test from 'node:test'
import assert from 'node:assert/strict'
import { PERSONAL_FACTOR_KEYS, personalFactorResponses, deriveFactorApplicability } from '../shared/personalFactors.js'
import { validateProfile } from '../services/requestValidationService.js'
import { buildPersonalFactorsSnapshot, hasCompletePersonalityPrerequisites } from '../services/assessmentAttemptService.js'
import { calculatePersonalFactorScore, calculateClusterScore } from '../services/recommendationEngine.js'
import { CLUSTER_WSM_WEIGHTS, PARENT_CLUSTERS } from '../config/recommendationConfig.js'
import { saveProfileWithDependencies, getProfileWithDependencies } from '../controllers/profileController.js'

const undisclosed = () => ({
  username: 'synthetic_student',
  personal_factor_answers: Object.fromEntries(PERSONAL_FACTOR_KEYS.map(factor => [factor, 'unknown'])),
  physical_accessibility_areas: [], physical_accessibility_difficulties: {},
  ...Object.fromEntries(PERSONAL_FACTOR_KEYS.map(factor => [`factor_${factor}_impact`, null])),
})
const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this }, json(body) { this.body = body; return this } })

test('all five explicit Yes/No answers are required for saving and assessment completion', () => {
  const complete = undisclosed()
  for (const factor of PERSONAL_FACTOR_KEYS) complete.personal_factor_answers[factor] = 'no'
  assert.equal(validateProfile(complete).valid, true)
  assert.ok(buildPersonalFactorsSnapshot(complete))
  for (const factor of PERSONAL_FACTOR_KEYS) {
    for (const invalid of ['unknown', 'legacy_unknown', '', null, undefined, 'YES', true]) {
      const candidate = { ...complete, personal_factor_answers: { ...complete.personal_factor_answers, [factor]: invalid } }
      assert.equal(validateProfile(candidate).valid, false)
      assert.equal(buildPersonalFactorsSnapshot(candidate), null)
      assert.equal(hasCompletePersonalityPrerequisites({
        personal_factors: candidate, interests: { selected: [], noInterests: true },
        skill_questions: Array(30).fill({}), skill_answers: Array(30).fill({}),
        skill_result: { correctCount: 0 }, personality_answers: Object.fromEntries(Array.from({ length: 40 }, (_, i) => [i, 3])),
      }), false)
    }
  }
})

test('complete factors use the full configured WSM weight in every cluster', () => {
  for (const cluster of PARENT_CLUSTERS) {
    const responses = { physical: 1, health: 2, financial: 3, family: 4, work: 1 }
    const score = calculatePersonalFactorScore(responses, cluster)
    for (const interestScore of [null, .7]) {
      const w = CLUSTER_WSM_WEIGHTS[cluster]
      const expected = (.8 * w.skillsWeight + (interestScore ?? 0) * w.interestsWeight + w.personalityWeight + score * w.personalFactorsWeight)
        / (1 - (interestScore === null ? w.interestsWeight : 0))
      assert.ok(Math.abs(calculateClusterScore({ skillScore: .8, interestScore, personalityScore: 1, personalFactorScore: score }, cluster) - expected) < 1e-12)
    }
    assert.throws(() => calculatePersonalFactorScore({ ...responses, health: null }, cluster))
    assert.throws(() => calculatePersonalFactorScore(personalFactorResponses(undisclosed()), cluster))
    assert.throws(() => calculateClusterScore({ skillScore: .8, interestScore: .7, personalityScore: 1, personalFactorScore: null }, cluster))
  }
})

test('historical impact 1 remains unknown even when old booleans or physical details suggest an answer', () => {
  const historical = { factor_health: false, factor_health_impact: 1, factor_physical_impact: 1, physical_accessibility_areas: ['seeing'] }
  assert.equal(deriveFactorApplicability(historical).health, 'legacy_unknown')
  assert.equal(personalFactorResponses(historical).physical, null)
  assert.equal(personalFactorResponses(historical).health, null)
})

test('profile persistence and attempt snapshots round-trip No and Yes/slight separately', async () => {
  let row
  const db = { async beginTransaction() {}, async commit() {}, async rollback() {}, async query(sql, params) {
    if (sql.startsWith('SELECT username') && sql.includes('FROM USER_ACCOUNT')) return [[{ username: 'synthetic_student', is_active: 1 }]]
    if (sql.includes('SELECT profile_id')) return [row ? [row] : []]
    if (sql.startsWith('INSERT INTO PROFILE')) {
      const columns = sql.match(/INSERT INTO PROFILE\s*\(([^)]+)\)/)[1].split(',').map(field => field.trim())
      row = Object.fromEntries(columns.map((column, index) => [column, params[index]]))
    }
    return [{ affectedRows: 1, insertId: 1 }]
  } }
  const body = undisclosed()
  body.personal_factor_answers = Object.fromEntries(PERSONAL_FACTOR_KEYS.map(factor => [factor, 'no']))
  body.personal_factor_answers.health = 'yes'
  body.factor_health_impact = 1
  body.personal_factor_answers.financial = 'no'
  const req = { user: { userId: 9 }, body }
  const saved = response()
  await saveProfileWithDependencies(req, saved, { database: db })
  assert.equal(saved.statusCode, 201)
  const loaded = response()
  await getProfileWithDependencies(req, loaded, { database: db })
  const snapshot = buildPersonalFactorsSnapshot(loaded.body.profile)
  assert.equal(snapshot.personal_factor_answers.health, 'yes')
  assert.equal(snapshot.factor_health_impact, 1)
  assert.equal(snapshot.personal_factor_answers.financial, 'no')
  assert.equal(snapshot.factor_financial_impact, null)
  assert.equal(snapshot.personal_factor_answers.work, 'no')
  assert.equal(snapshot.factor_work_impact, null)
})

test('No factors reject stale health and accessibility details rather than storing them', () => {
  const no = undisclosed()
  no.personal_factor_answers = Object.fromEntries(PERSONAL_FACTOR_KEYS.map(factor => [factor, 'no']))
  assert.equal(validateProfile({ ...no, factor_health_impact: 4 }).valid, false)
  assert.equal(validateProfile({ ...no, physical_accessibility_areas: ['seeing'], physical_accessibility_difficulties: { seeing: 'cannot_do' } }).valid, false)
  const oldClient = undisclosed()
  delete oldClient.personal_factor_answers
  assert.equal(validateProfile(oldClient).valid, false)
})
