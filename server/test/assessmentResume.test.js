import test from 'node:test'
import assert from 'node:assert/strict'
import { getCurrentAttempt, hasSubmittedAttemptInterests, interestDraftResponse, submittedInterestResponse, updateCurrentAttemptDraft } from '../services/assessmentAttemptService.js'
import { normalizeInterestResponse } from '../services/interestSubmissionService.js'

test('resume returns the latest owned unfinished attempt without writing data', async () => {
  const calls = []
  const expected = { attempt_id: 12, status: 'IN_PROGRESS', personality_answers: { 1: 4 } }
  const database = { async query(sql, params) { calls.push({ sql, params }); return [[expected]] } }
  assert.equal(await getCurrentAttempt(database, 101), expected)
  assert.deepEqual(calls[0].params, [101])
  assert.match(calls[0].sql, /WHERE user_id = \?/)
  assert.match(calls[0].sql, /ORDER BY attempt_id DESC LIMIT 1/)
  assert.ok(calls.every(call => /^SELECT\b/.test(call.sql)))
})

test('a completed latest attempt cannot resurrect an older draft; missing accounts have no draft', async () => {
  assert.equal(await getCurrentAttempt({ query: async () => [[{ attempt_id: 20, status: 'COMPLETED' }]] }, 101), null)
  assert.equal(await getCurrentAttempt({ query: async () => [[]] }, 202), null)
})

test('draft selections are incomplete until submitted; metadata leaves scoring inputs unchanged', () => {
  for (const interests of [{ selected: ['Drawing'], noInterests: false }, { selected: [], noInterests: true }]) {
    assert.equal(hasSubmittedAttemptInterests({ interests }), false)
    const submitted = submittedInterestResponse(interests, new Date('2026-11-11T00:00:00Z'))
    assert.equal(hasSubmittedAttemptInterests({ interests: JSON.stringify(submitted) }), true)
    assert.deepEqual(normalizeInterestResponse(submitted), normalizeInterestResponse(interests))
    assert.deepEqual(interestDraftResponse(submitted), interests)
  }
})

test('completed records and historical downstream progress remain completed without a migration', () => {
  assert.equal(hasSubmittedAttemptInterests({ status: 'COMPLETED' }), true)
  const interests = { selected: ['Drawing'], noInterests: false }
  assert.equal(hasSubmittedAttemptInterests({ interests, skill_questions: '[{"question_id":1}]' }), true)
  assert.equal(hasSubmittedAttemptInterests({ interests, skill_result: '{}' }), true)
  assert.equal(hasSubmittedAttemptInterests({ interests: ['Drawing', 'Painting', 'Photography'] }), true)
  assert.equal(hasSubmittedAttemptInterests({ interests: { selected: [], noInterests: false } }), false)
})

test('autosave cannot promote client-supplied submission metadata to a completed step', async () => {
  const calls = []
  const db = { query: async (sql, params) => { calls.push({ sql, params }); return [{ affectedRows: 1 }] } }
  await updateCurrentAttemptDraft(db, 1, {
    interests: { selected: ['Drawing'], noInterests: false, submittedAt: 'forged' },
  }, 12)
  assert.deepEqual(JSON.parse(calls[0].params[0]), { selected: ['Drawing'], noInterests: false })
})
