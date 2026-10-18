import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { parseAttemptJson } from '../services/assessmentAttemptService.js'
import { validateInterestSubmission } from '../services/interestSubmissionService.js'

const source = await readFile(new URL('../server.js', import.meta.url), 'utf8')
const route = source.slice(source.indexOf("app.get('/api/dashboard/status'"), source.indexOf("app.get('/api/college/status'"))

async function dashboardStatus(attempts, counts = {}) {
  let handler
  const app = { get: (_path, _auth, callback) => { handler = callback } }
  const pool = { query: async (sql, params) => {
    assert.deepEqual(params, [7])
    assert.match(sql.trim(), /^SELECT/)
    if (sql.includes('FROM ASSESSMENT_ATTEMPT')) {
      assert.match(sql, /ORDER BY \(status = 'COMPLETED'\) DESC, attempt_id DESC/)
      return [[...attempts].sort((left, right) => Number(right.status === 'COMPLETED') - Number(left.status === 'COMPLETED') || right.attempt_id - left.attempt_id).slice(0, 1)]
    }
    if (sql.includes('FROM SEMESTER_CHECKIN')) return [[]]
    const table = sql.match(/FROM (\w+)/)[1]
    return [[{ count: counts[table] || 0 }]]
  } }
  new Function('app', 'authenticateToken', 'pool', 'parseAttemptJson', 'validateInterestSubmission', route)(app, () => {}, pool, parseAttemptJson, validateInterestSubmission)
  let result
  await handler({ user: { userId: 7 } }, { json: data => { result = data }, status: code => { throw new Error(`Unexpected response ${code}`) } })
  return result
}

test('completed no-interest assessment remains 4/4 despite newer empty retake drafts', async () => {
  const result = await dashboardStatus([
    { attempt_id: 24, status: 'IN_PROGRESS', interests: null },
    { attempt_id: 23, status: 'COMPLETED', interests: { selected: [], noInterests: true } },
  ], { PROFILE: 1, SKILL_RESPONSE: 30, PERSONALITY_ASSESSMENT: 1 })
  assert.equal(result.hasCompletedAssessment, true)
  assert.equal(result.hasProfile, true)
  assert.equal(result.hasInterests, true)
  assert.equal(result.hasSkills, true)
  assert.equal(result.hasPersonality, true)
})

test('completed assessments remain evidence independently of current response rows', async () => {
  const result = await dashboardStatus([{ attempt_id: 23, status: 'COMPLETED', interests: [] }])
  assert.equal(result.hasCompletedAssessment, true)
  assert.equal(result.hasInterests, true)
})

test('first-time empty drafts stay incomplete while explicit no interests completes that section', async () => {
  const blank = await dashboardStatus([{ attempt_id: 24, status: 'IN_PROGRESS', interests: null }])
  assert.equal(blank.hasCompletedAssessment, false)
  assert.equal(blank.hasInterests, false)
  assert.equal(blank.hasPersonality, false)
  const none = await dashboardStatus([{ attempt_id: 24, status: 'IN_PROGRESS', interests: JSON.stringify({ selected: [], noInterests: true }) }])
  assert.equal(none.hasCompletedAssessment, false)
  assert.equal(none.hasInterests, true)
})
