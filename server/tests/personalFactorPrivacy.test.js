import test from 'node:test'
import assert from 'node:assert/strict'
import { PERSONAL_FACTOR_KEYS, personalFactorResponses, deriveFactorApplicability } from '../shared/personalFactors.js'
import { validateProfile } from '../services/requestValidationService.js'
import { buildPersonalFactorsSnapshot, hasCompletePersonalityPrerequisites } from '../services/assessmentAttemptService.js'
import { calculatePersonalFactorScore, calculateClusterScore, personalFactorCoverage } from '../services/recommendationEngine.js'
import { CLUSTER_WSM_WEIGHTS, PARENT_CLUSTERS } from '../config/recommendationConfig.js'
import { saveProfileWithDependencies, getProfileWithDependencies } from '../controllers/profileController.js'

const undisclosed = () => ({
  username: 'synthetic_student',
  personal_factor_answers: Object.fromEntries(PERSONAL_FACTOR_KEYS.map(factor => [factor, 'unknown'])),
  physical_accessibility_areas: [], physical_accessibility_difficulties: {},
  ...Object.fromEntries(PERSONAL_FACTOR_KEYS.map(factor => [`factor_${factor}_impact`, null])),
})
const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this }, json(body) { this.body = body; return this } })

test('all factors can remain unknown and still complete the assessment prerequisites', () => {
  assert.equal(validateProfile(undisclosed()).valid, true)
  const snapshot = buildPersonalFactorsSnapshot(undisclosed())
  assert.ok(snapshot)
  assert.equal(hasCompletePersonalityPrerequisites({
    personal_factors: snapshot, interests: { selected: [], noInterests: true },
    skill_questions: Array(30).fill({}), skill_answers: Array(30).fill({}),
    skill_result: { correctCount: 0 }, personality_answers: Object.fromEntries(Array.from({ length: 40 }, (_, i) => [i, 3])),
  }), true)
})

test('unknown factors contribute neither score nor component weight in every cluster', () => {
  const responses = personalFactorResponses(undisclosed())
  for (const cluster of PARENT_CLUSTERS) {
    assert.equal(calculatePersonalFactorScore(responses, cluster), null)
    for (const interestScore of [null, .7]) {
      const weights = CLUSTER_WSM_WEIGHTS[cluster]
      const expected = (.8 * weights.skillsWeight + (interestScore ?? 0) * weights.interestsWeight + weights.personalityWeight)
        / (weights.skillsWeight + (interestScore === null ? 0 : weights.interestsWeight) + weights.personalityWeight)
      assert.ok(Math.abs(calculateClusterScore({ skillScore: .8, interestScore, personalityScore: 1, personalFactorScore: null }, cluster) - expected) < 1e-12)
    }
  }
})

test('partial disclosure excludes unknown weights instead of imputing No or a penalty', () => {
  const responses = { physical: null, health: null, financial: null, family: 4, work: 1 }
  const coverage = personalFactorCoverage(responses)
  assert.equal(coverage, .4)
  const cluster = 'BUSINESS CLUSTER'
  const score = calculatePersonalFactorScore(responses, cluster)
  assert.equal(score, .25)
  const w = CLUSTER_WSM_WEIGHTS[cluster]
  const expected = (.8 * w.skillsWeight + .7 * w.interestsWeight + w.personalityWeight + score * w.personalFactorsWeight * coverage)
    / (1 - w.personalFactorsWeight * .6)
  assert.ok(Math.abs(calculateClusterScore({ skillScore: .8, interestScore: .7, personalityScore: 1, personalFactorScore: score, personalFactorCoverage: coverage }, cluster) - expected) < 1e-12)
})

test('historical impact 1 remains unknown even when old booleans or physical details suggest an answer', () => {
  const historical = { factor_health: false, factor_health_impact: 1, factor_physical_impact: 1, physical_accessibility_areas: ['seeing'] }
  assert.equal(deriveFactorApplicability(historical).health, 'legacy_unknown')
  assert.equal(personalFactorResponses(historical).physical, null)
  assert.equal(personalFactorResponses(historical).health, null)
})

test('profile persistence and attempt snapshots round-trip No, Yes/slight and unknown separately', async () => {
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
  assert.equal(snapshot.personal_factor_answers.work, 'unknown')
  assert.equal(snapshot.factor_work_impact, null)
})

test('undisclosed factors reject stale health and accessibility details rather than storing them', () => {
  assert.equal(validateProfile({ ...undisclosed(), factor_health_impact: 4 }).valid, false)
  assert.equal(validateProfile({ ...undisclosed(), physical_accessibility_areas: ['seeing'], physical_accessibility_difficulties: { seeing: 'cannot_do' } }).valid, false)
  const oldClient = undisclosed()
  delete oldClient.personal_factor_answers
  assert.equal(validateProfile(oldClient).valid, false)
})
