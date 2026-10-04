import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { getOwnedAttempt, parseAttemptJson, requestedAttemptId, updateAttempt } from '../services/assessmentAttemptService.js'

test('normal revisit has no attempt id and therefore keeps the existing saved-answer path', () => {
  assert.equal(requestedAttemptId({ get: () => undefined }), null)
})

test('retake reads only its isolated fresh attempt', async () => {
  const calls = []
  const database = { query: async (sql, params) => { calls.push({ sql, params }); return [[]] } }
  assert.equal(await getOwnedAttempt(database, 7, 41), null)
  assert.match(calls[0].sql, /attempt_id = \? AND user_id = \?/)
  assert.deepEqual(calls[0].params, [41, 7])
})

test('new attempt answers are written independently by attempt and user', async () => {
  const calls = []
  const database = { query: async (sql, params) => { calls.push({ sql, params }); return [{ affectedRows: 1 }] } }
  assert.equal(await updateAttempt(database, 7, 41, 'interests', ['Reading', 'Music', 'Art']), true)
  assert.match(calls[0].sql, /status = 'IN_PROGRESS'/)
  assert.deepEqual(calls[0].params.slice(1), [41, 7])
})

test('completed attempt keeps its personality assessment link for historical results', () => {
  const row = parseAttemptJson(JSON.stringify({ personality_assessment_id: 88 }))
  assert.equal(row.personality_assessment_id, 88)
})

test('retake completion requires canonical Profile Personal Factors without copying an attempt snapshot', async () => {
  const source = await readFile(new URL('../server.js', import.meta.url), 'utf8')
  assert.match(source, /SELECT profile_id FROM PROFILE/)
  assert.match(source, /profileRows\.length !== 1/)
  assert.doesNotMatch(source, /UPDATE PROFILE SET physical_accessibility_areas/)
  assert.match(source, /\/api\/assessment-attempts\/recover/)
  assert.doesNotMatch(source, /Active assessment attempt not found\./)
})

test('starting a recommendation assessment does not mutate College tracking data', async () => {
  const source = await readFile(new URL('../server.js', import.meta.url), 'utf8')
  const route = source.match(/app\.post\('\/api\/assessment-attempts',[\s\S]*?\n\}\)\r?\n/)[0]
  assert.match(route, /INSERT INTO ASSESSMENT_ATTEMPT/)
  assert.doesNotMatch(route, /COLLEGE_TRACKING_CYCLE|COLLEGE_TERM|SEMESTER_CHECKIN|UPDATE COURSE/)
})
