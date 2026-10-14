import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import express from 'express'

import interestGroups, {
  MAX_INTEREST_SELECTIONS as CLIENT_MAX,
  MIN_INTEREST_SELECTIONS as CLIENT_MIN,
  updateInterestSelection,
  isInterestStateComplete,
  NO_INTERESTS_LABEL,
  restoreInterestState,
  toggleNoInterests,
  updateInterestActivity,
} from '../../client/src/data/interestList.js'
import {
  CURRENT_INTEREST_RIASEC_MAP,
  HISTORICAL_INTEREST_RIASEC_MAP,
  PRIMARY_INTEREST_CONTRIBUTION,
  SECONDARY_INTEREST_CONTRIBUTION,
} from '../config/interestRiasecConfig.js'
import {
  MAX_INTEREST_SELECTIONS,
  MIN_INTEREST_SELECTIONS,
  validateInterestSubmission,
  getSelectedInterestNames,
} from '../services/interestSubmissionService.js'
import { buildStudentRiasecVector } from '../services/recommendationService.js'
import { getCurrentAttempt, hasCompletePersonalityPrerequisites, parseAttemptJson, requestedAttemptId, updateCurrentAttemptDraft } from '../services/assessmentAttemptService.js'
import { getAssessmentStatus } from '../services/assessmentCompletionService.js'
import { getOrCreateSavedRecommendations } from '../services/recommendationPersistenceService.js'
import { SKILL_DOMAINS } from '../config/recommendationConfig.js'

const currentItems = interestGroups.flatMap((group) => group.items)
const currentNames = currentItems.map((item) => item.name)
const validCodes = new Set(['R', 'I', 'A', 'S', 'E', 'C'])

test('the selectable list has exactly 35 unique canonical interests with valid mappings', () => {
  assert.equal(currentNames.length, 35)
  assert.equal(new Set(currentNames).size, 35)
  assert.deepEqual(new Set(currentNames), new Set(Object.keys(CURRENT_INTEREST_RIASEC_MAP)))

  for (const item of currentItems) {
    assert.ok(validCodes.has(item.primary))
    assert.ok(item.secondary === null || validCodes.has(item.secondary))
    assert.deepEqual(CURRENT_INTEREST_RIASEC_MAP[item.name], {
      primary: item.primary,
      secondary: item.secondary,
    })
  }
})

test('interest scoring contributions remain 1.0 primary and 0.5 secondary', () => {
  assert.equal(PRIMARY_INTEREST_CONTRIBUTION, 1)
  assert.equal(SECONDARY_INTEREST_CONTRIBUTION, 0.5)
})

test('all four deprecated combined interests remain available for historical scoring', () => {
  assert.deepEqual(Object.keys(HISTORICAL_INTEREST_RIASEC_MAP).sort(), [
    'Building / Fixing Gadgets',
    'Dancing / Performing Arts',
    'Music / Singing',
    'Video Editing / Filmmaking',
  ])
  assert.deepEqual(buildStudentRiasecVector(Object.keys(HISTORICAL_INTEREST_RIASEC_MAP)), {
    R: 1,
    I: 1,
    A: 3,
    S: 0.5,
    E: 0,
    C: 0,
  })
})

test('legacy activity-array limits remain available for compatibility', () => {
  assert.equal(CLIENT_MIN, 3)
  assert.equal(CLIENT_MAX, 10)
  assert.ok([0, 1, 2].every((count) => count < CLIENT_MIN))
  assert.ok([3, 10].every((count) => count >= CLIENT_MIN && count <= CLIENT_MAX))
})

const noInterests = { selected: [], noInterests: true }

test('the actual autosave route accepts global checkbox drafts and persists their boolean with the owned attempt', async () => {
  const source = await readFile(new URL('../server.js', import.meta.url), 'utf8')
  const start = source.indexOf("app.patch('/api/assessment-attempts/current'")
  const route = source.slice(start, source.indexOf('app.listen(', start))
  const writes = []
  const pool = { query: async (sql, params) => { writes.push({ sql, params }); return [{ affectedRows: 1 }] } }
  const app = express()
  app.use(express.json())
  const authenticate = (req, _res, next) => { req.user = { userId: 7 }; next() }
  new Function('app', 'authenticateToken', 'pool', 'validateInterestSubmission', 'updateCurrentAttemptDraft', 'requestedAttemptId', route)(
    app, authenticate, pool, validateInterestSubmission, updateCurrentAttemptDraft, requestedAttemptId
  )
  const server = app.listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  try {
    const url = `http://127.0.0.1:${server.address().port}/api/assessment-attempts/current`
    for (const state of [noInterests, { selected: [], noInterests: false }, { selected: ['Drawing'], noInterests: false }]) {
      const response = await fetch(url, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json', 'X-Assessment-Attempt-Id': '41' },
        body: JSON.stringify({ interests_json: { ...state, updatedAt: 123 } }),
      })
      assert.equal(response.status, 200)
      assert.deepEqual(await response.json(), { saved: true })
      assert.deepEqual(JSON.parse(writes.at(-1).params[0]), { ...state, updatedAt: 123 })
      assert.deepEqual(writes.at(-1).params.slice(1), [7, 41])
    }
    const invalid = await fetch(url, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ interests_json: { selected: ['Drawing'], noInterests: true } }),
    })
    assert.equal(invalid.status, 400)
    assert.equal(writes.length, 3)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})

test('the global checkbox clears all activities and blocks selection until unchecked', () => {
  const original = { selected: ['Drawing', 'Basketball'], noInterests: false }
  const checked = toggleNoInterests(original)
  assert.deepEqual(checked.selected, [])
  assert.equal(checked.noInterests, true)
  assert.deepEqual(updateInterestActivity(checked, 'Music').selected, [])
  const unchecked = toggleNoInterests(checked)
  assert.equal(unchecked.noInterests, false)
  assert.equal(isInterestStateComplete(unchecked), false)
  const selected = updateInterestActivity(unchecked, 'Drawing')
  assert.deepEqual(selected.selected, ['Drawing'])
  assert.equal(isInterestStateComplete(selected), true)
  assert.deepEqual(original.selected, ['Drawing', 'Basketball'])
})

test('one activity in any category or the checked checkbox can continue; category completion is unnecessary', () => {
  assert.equal(validateInterestSubmission(noInterests), null)
  assert.equal(isInterestStateComplete(noInterests), true)
  for (const group of interestGroups) {
    for (const item of group.items) {
      const state = { selected: [item.name], noInterests: false }
      assert.equal(validateInterestSubmission(state), null)
      assert.equal(isInterestStateComplete(state), true)
    }
  }
  assert.equal(validateInterestSubmission({ selected: currentNames.slice(0, 10), noInterests: false }), null)
  const max = { selected: currentNames.slice(0, 10), noInterests: false }
  assert.equal(updateInterestActivity(max, currentNames[10]).maxReached, true)
  assert.deepEqual(toggleNoInterests(max).selected, [])
})

test('server distinguishes unchecked empty drafts from explicit no interests and rejects conflicting or invalid answers', () => {
  const empty = { selected: [], noInterests: false }
  assert.ok(validateInterestSubmission(empty))
  assert.equal(validateInterestSubmission(empty, { draft: true }), null)
  for (const invalid of [
    { selected: ['Drawing'], noInterests: true },
    { selected: [], noInterests: 'true' },
    { selected: [], noInterests: null },
    { selected: [], noInterests: undefined },
    { selected: null, noInterests: true },
    { selected: ['Drawing', 'Drawing'], noInterests: false },
    { selected: currentNames.slice(0, 11), noInterests: false },
    { selected: [NO_INTERESTS_LABEL], noInterests: false },
  ]) assert.ok(validateInterestSubmission(invalid))
  assert.equal(CURRENT_INTEREST_RIASEC_MAP[NO_INTERESTS_LABEL], undefined)
})

test('restore preserves the global checkbox, cleared answers, legacy activities, and newer local edits', () => {
  const saved = { ...noInterests, updatedAt: 20 }
  assert.deepEqual(restoreInterestState({}, JSON.parse(JSON.stringify(saved))), saved)
  assert.deepEqual(restoreInterestState(saved, null), saved)
  assert.deepEqual(restoreInterestState(saved, []), saved)
  const cleared = { selected: [], noInterests: false, updatedAt: 30 }
  assert.deepEqual(restoreInterestState(saved, cleared), cleared)
  assert.deepEqual(restoreInterestState(cleared, saved), cleared)
  assert.deepEqual(restoreInterestState({}, ['Drawing']), { selected: ['Drawing'], noInterests: false, updatedAt: 0 })
  const oldNone = { selected: [], noneGroups: interestGroups.map((group) => group.group) }
  assert.equal(restoreInterestState({}, oldNone).noInterests, true)
  assert.equal(validateInterestSubmission(oldNone), null)
  const oldMixed = { selected: ['Drawing'], noneGroups: ['Nature & Environment'] }
  assert.deepEqual(restoreInterestState({}, oldMixed).selected, ['Drawing'])
  assert.equal(restoreInterestState({}, oldMixed).noInterests, false)
})

test('attempt persistence saves and restores the global checkbox separately from unanswered state', async () => {
  let savedJson = null
  const database = { query: async (sql, params) => {
    if (sql.startsWith('UPDATE')) {
      assert.deepEqual(params.slice(1), [7, 41])
      savedJson = params[0]
      return [{ affectedRows: 1 }]
    }
    return [[{ attempt_id: 41, interests: savedJson }]]
  } }
  await updateCurrentAttemptDraft(database, 7, { interests: noInterests }, 41)
  const restored = parseAttemptJson((await getCurrentAttempt(database, 7)).interests)
  assert.deepEqual(restored, noInterests)
  assert.equal(validateInterestSubmission(restored), null)
  assert.deepEqual(getSelectedInterestNames(restored), [])
  await updateCurrentAttemptDraft(database, 7, { interests: { selected: [], noInterests: false } }, 41)
  assert.ok(validateInterestSubmission(parseAttemptJson(savedJson)))
})

test('no interests or a single activity satisfies Personality prerequisites without inventing scores', () => {
  const attempt = {
    personal_factors: {}, interests: JSON.stringify(noInterests),
    skill_questions: Array(30).fill({}), skill_answers: Array(30).fill({}),
    skill_result: {}, personality_answers: Object.fromEntries(Array.from({ length: 40 }, (_, index) => [index, 3])),
  }
  assert.equal(hasCompletePersonalityPrerequisites(attempt), true)
  assert.equal(hasCompletePersonalityPrerequisites({ ...attempt, interests: { selected: ['Drawing'], noInterests: false } }), true)
  assert.equal(hasCompletePersonalityPrerequisites({ ...attempt, interests: { selected: [], noInterests: false } }), false)
  assert.equal(getAssessmentStatus({ profileCount: 1, interestCount: 0, skillCount: 30, personalityCount: 1, completedAttemptCount: 1 }), 'Completed')
})

test('no interests reuses the existing ranking block without writing recommendation snapshots', async () => {
  const database = { query: async (sql) => {
    assert.match(sql, /^\s*SELECT/)
    if (sql.includes('FROM PERSONALITY_ASSESSMENT')) return [[{ assessment_id: 88, mbti_type: 'INTJ' }]]
    if (sql.includes('FROM SKILL_RESPONSE')) return [[...SKILL_DOMAINS.flatMap((dimension) => Array.from({ length: 5 }, () => ({ dimension, is_correct: 1 })))]]
    return [[]]
  }, getConnection: async () => { throw new Error('Must not write recommendation snapshots') } }
  await assert.rejects(() => getOrCreateSavedRecommendations(database, 7), (error) => {
    assert.equal(error.code, 'MISSING_INTEREST_SCORING_POLICY')
    return true
  })
  assert.deepEqual(buildStudentRiasecVector(getSelectedInterestNames({ selected: ['Photography'], noInterests: false })), buildStudentRiasecVector(['Photography']))
})

test('an attempted 11th selection is blocked and a selected interest can be removed', () => {
  const ten = currentNames.slice(0, 10)
  assert.deepEqual(updateInterestSelection(ten, currentNames[10]), {
    selected: ten,
    maxReached: true,
  })
  assert.deepEqual(updateInterestSelection(ten, ten[0]), {
    selected: ten.slice(1),
    maxReached: false,
  })
})

test('server validation enforces canonical unique submissions containing 3 to 10 interests', () => {
  assert.equal(MIN_INTEREST_SELECTIONS, 3)
  assert.equal(MAX_INTEREST_SELECTIONS, 10)
  assert.ok(validateInterestSubmission(currentNames.slice(0, 2)))
  assert.ok(validateInterestSubmission(currentNames.slice(0, 11)))
  assert.ok(validateInterestSubmission([currentNames[0], currentNames[1], currentNames[1]]))
  assert.ok(validateInterestSubmission([currentNames[0], currentNames[1], 'Unknown']))
  assert.ok(validateInterestSubmission([
    currentNames[0], currentNames[1], 'Video Editing / Filmmaking',
  ]))
  assert.equal(validateInterestSubmission(currentNames.slice(0, 3)), null)
  assert.equal(validateInterestSubmission(currentNames.slice(0, 10)), null)
})
