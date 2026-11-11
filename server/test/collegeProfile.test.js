import test from 'node:test'
import assert from 'node:assert/strict'
import { getProfileWithDependencies, saveProfileWithDependencies } from '../controllers/profileController.js'

const factors = {
  personal_factor_answers: { physical: 'no', health: 'no', financial: 'no', family: 'no', work: 'no' },
  physical_accessibility_areas: [], physical_accessibility_difficulties: {},
  factor_physical_impact: null, factor_health_impact: null, factor_financial_impact: null,
  factor_family_impact: null, factor_work_impact: null,
}
const changedFactors = { ...factors, personal_factor_answers: { ...factors.personal_factor_answers, health: 'yes' }, factor_health_impact: 2 }

function fixture({ college = { lifecycleStatus: 'active' }, attempt = null, duplicate = false } = {}) {
  const calls = []
  let committed = false, rolledBack = false, refreshed = false
  const database = {
    beginTransaction: async () => {},
    commit: async () => { committed = true },
    rollback: async () => { rolledBack = true },
    query: async (sql, params) => {
      calls.push({ sql, params })
      if (sql.includes('SELECT username')) return [[{ username: 'student', is_active: 1 }]]
      if (sql.includes('SELECT user_id FROM USER_ACCOUNT')) return [duplicate ? [{ user_id: 2 }] : []]
      if (sql.includes('ORDER BY attempt_id DESC')) { assert.deepEqual(params, [1]); return [attempt ? [attempt] : []] }
      if (sql.includes('FROM PROFILE')) return [[{ profile_id: 1, ...factors }]]
      if (/^\s*(UPDATE|INSERT)/.test(sql)) return [{ affectedRows: 1 }]
      return [[]]
    },
  }
  const res = { statusCode: 200, status(code) { this.statusCode = code; return this }, json(body) { this.body = body; return this } }
  return {
    calls, res,
    state: () => ({ committed, rolledBack, refreshed }),
    save: async (body, attemptId) => saveProfileWithDependencies(
      { user: { userId: 1 }, body, get: () => attemptId }, res,
      { database, readCollegeStatus: async () => college, refreshRecommendations: async () => { refreshed = true; return { refreshed: true } } }
    ),
    load: async () => getProfileWithDependencies({ user: { userId: 1 } }, res, { database, readCollegeStatus: async () => college }),
  }
}

test('profile exposes the College lock including paused/ended and legacy tracking', async () => {
  for (const college of [{ lifecycleStatus: 'active' }, { lifecycleStatus: 'paused' }, { lifecycleStatus: 'ended' }, { checkinId: 1 }, null]) {
    const f = fixture({ college })
    await f.load()
    assert.equal(f.res.body.personalFactorsReadOnly, Boolean(college))
    assert.deepEqual(f.res.body.profile.personal_factor_answers, factors.personal_factor_answers)
    assert.ok(f.calls.every(({ sql }) => /^\s*SELECT/.test(sql)))
  }
})

test('College profile edits cannot change factors or bypass the lock with invalid attempt headers', async () => {
  for (const [attemptId, attempt] of [[undefined, null], ['99', null], ['99', { attempt_id: 12, status: 'IN_PROGRESS' }], ['12', { attempt_id: 12, status: 'COMPLETED' }]]) {
    const f = fixture({ attempt })
    await f.save({ username: 'new_name', ...changedFactors }, attemptId)
    assert.equal(f.res.statusCode, 409)
    assert.equal(f.res.body.code, 'PERSONAL_FACTORS_READ_ONLY')
    assert.deepEqual(f.state(), { committed: false, rolledBack: true, refreshed: false })
    assert.ok(f.calls.every(({ sql }) => /^\s*SELECT/.test(sql)), 'rejected edits must not write username, factors, results or tracking')
  }
})

test('College username edit commits without touching assessment, profile, recommendations or tracking', async () => {
  const f = fixture()
  await f.save({ username: 'new_name' })
  assert.equal(f.res.statusCode, 200)
  assert.equal(f.res.body.username, 'new_name')
  assert.deepEqual(f.state(), { committed: true, rolledBack: false, refreshed: false })
  assert.deepEqual(f.calls.filter(({ sql }) => /^\s*(UPDATE|INSERT)/.test(sql)).map(({ sql }) => sql), ['UPDATE USER_ACCOUNT SET username = ? WHERE user_id = ?'])
})

test('College username validation and duplicate protection remain enforced', async () => {
  const invalid = fixture()
  await invalid.save({ username: '!' })
  assert.equal(invalid.res.statusCode, 400)
  assert.equal(invalid.res.body.field, 'username')
  assert.equal(invalid.calls.length, 0)
  const duplicate = fixture({ duplicate: true })
  await duplicate.save({ username: 'existing_user' })
  assert.equal(duplicate.res.statusCode, 409)
  assert.equal(duplicate.res.body.field, 'username')
  assert.ok(duplicate.calls.every(({ sql }) => /^\s*SELECT/.test(sql)))
})

test('a non-College profile still requires and saves validated Personal Factors', async () => {
  const incomplete = fixture({ college: null })
  await incomplete.save({ username: 'new_name' })
  assert.equal(incomplete.res.statusCode, 400)
  assert.ok(incomplete.calls.every(({ sql }) => /^\s*SELECT/.test(sql)))
  const f = fixture({ college: null })
  await f.save({ username: 'student', ...changedFactors })
  assert.equal(f.res.statusCode, 200)
  assert.equal(f.state().committed, true)
  assert.equal(f.state().refreshed, true)
})

test('an explicit current owned assessment preserves the existing College retake flow', async () => {
  const f = fixture({ attempt: { attempt_id: 12, status: 'IN_PROGRESS' } })
  await f.save({ username: 'student', ...factors }, '12')
  assert.equal(f.res.statusCode, 200)
  assert.equal(f.state().committed, true)
  assert.ok(f.calls.some(({ sql, params }) => sql.startsWith('UPDATE ASSESSMENT_ATTEMPT') && params[1] === 12 && params[2] === 1))
})
