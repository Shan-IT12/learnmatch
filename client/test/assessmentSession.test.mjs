import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ASSESSMENT_SESSION_KEYS as keys, beginAssessmentAttempt, getAssessmentAttemptId,
  invalidateAssessmentSession, readActiveAttempt, restoreInterestAttempt, saveActiveAttemptDraft,
  readAssessmentSession, writeAssessmentSession } from '../src/utils/assessmentSession.js'
import { getAttemptResumeRoute, hasSubmittedAssessmentInterests } from '../src/utils/assessmentNavigation.js'
import { clearUserAuth, storeUserAuth } from '../src/utils/userAuth.js'

function storage() {
  const data = new Map()
  return { get length() { return data.size }, key: index => [...data.keys()][index],
    getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, String(value)), removeItem: key => data.delete(key) }
}
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const inactive = () => json({ code: 'ASSESSMENT_ATTEMPT_NOT_ACTIVE' }, 404)

test('missing and stale browser identifiers recover only through authenticated reads, without creating attempts', async t => {
  const session = storage(), requests = []
  session.setItem(keys.skills, JSON.stringify({ answers: { foreign: 'A' } }))
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    requests.push({ url, options })
    if (options.headers['X-Assessment-Attempt-Id'] === '999') return inactive()
    return json({ attemptId: 12, skillAnswers: [{ question_id: 2, selected_option: 'B' }] })
  })
  const recovered = await readActiveAttempt('', 'user-A', session)
  assert.equal(recovered.attemptId, 12)
  assert.equal(session.getItem(keys.skills), null)
  session.setItem(keys.attemptId, '999')
  assert.equal((await readActiveAttempt('', 'user-A', session)).attemptId, 12)
  assert.equal(requests.length, 3)
  assert.ok(requests.every(({ options }) => !options.method && options.headers.Authorization === 'Bearer user-A'))
})

test('no unfinished attempt clears stale browser data without creating a new attempt', async t => {
  const session = storage()
  beginAssessmentAttempt(session, 12)
  t.mock.method(globalThis, 'fetch', async () => inactive())
  assert.equal(await readActiveAttempt('', 'user-A', session), null)
  assert.equal(getAssessmentAttemptId(session), null)
})

test('the exact legacy 404 retries an authenticated lookup before clearing a stale browser attempt', async t => {
  const session = storage()
  const requests = []
  let ownedAttempt = { attemptId: 12, personalityAnswers: { 1: 4 } }
  const endpoint = 'https://precious-renewal-production-b034.up.railway.app'
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, `${endpoint}/api/assessment-attempts/current`)
    assert.equal(options.method, undefined)
    assert.equal(options.headers.Authorization, 'Bearer user-A')
    const id = options.headers['X-Assessment-Attempt-Id']
    requests.push(id)
    if (id || !ownedAttempt) return json({ message: 'Assessment progress is no longer active.' }, 404)
    return json(ownedAttempt)
  })

  beginAssessmentAttempt(session, 99)
  assert.deepEqual(await readActiveAttempt(endpoint, 'user-A', session), ownedAttempt)
  assert.equal(getAssessmentAttemptId(session), 12)
  ownedAttempt = null
  writeAssessmentSession(session, keys.personality, { answers: { 1: 4 } })
  assert.equal(await readActiveAttempt(endpoint, 'user-A', session), null)
  assert.equal(getAssessmentAttemptId(session), null)
  assert.equal(session.getItem(keys.personality), null)
  assert.deepEqual(requests, ['99', undefined, '12', undefined])
})

test('unrelated 404s, auth failures and invalid data preserve drafts and prevent recovery writes', async t => {
  const session = storage()
  beginAssessmentAttempt(session, 12)
  const draft = { answers: { 1: 4 }, pending: true }
  writeAssessmentSession(session, keys.personality, draft)
  const mock = t.mock.method(globalThis, 'fetch')
  for (const response of [new Response('<html>Not found</html>', { status: 404 }), json({ message: 'Route not found' }, 404), json({}, 401), json({}, 403), json({}, 500), json(null)]) {
    mock.mock.mockImplementation(async (_url, options) => {
      assert.equal(options.method, undefined)
      return response
    })
    await assert.rejects(restoreInterestAttempt('', 'user-A', session), /assessment progress/)
    assert.equal(getAssessmentAttemptId(session), 12)
    assert.deepEqual(readAssessmentSession(session, keys.personality, {}), draft)
  }
  assert.equal(mock.mock.callCount(), 6)
})

test('late inactive and active responses cannot replace a newer browser attempt', async t => {
  const session = storage()
  let respond
  t.mock.method(globalThis, 'fetch', () => new Promise(resolve => { respond = resolve }))
  for (const response of [inactive(), json({ attemptId: 12 })]) {
    beginAssessmentAttempt(session, 12)
    const read = readActiveAttempt('', 'user-A', session)
    beginAssessmentAttempt(session, 20)
    respond(response)
    await assert.rejects(read, /Assessment progress changed/)
    assert.equal(getAssessmentAttemptId(session), 20)
  }
})

test('concurrent initial interest recovery shares creation instead of starting duplicate attempts', async t => {
  const session = storage()
  let created = false, postCount = 0
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (options.method === 'POST') {
      postCount++
      await new Promise(resolve => setImmediate(resolve))
      created = true
      return json({ attemptId: 12 })
    }
    return created ? json({ attemptId: 12, interests: [] }) : inactive()
  })
  const attempts = await Promise.all([restoreInterestAttempt('', 'A', session), restoreInterestAttempt('', 'A', session)])
  assert.equal(postCount, 1)
  assert.ok(attempts.every(attempt => attempt.attemptId === 12))
})

test('a late recovery response cannot reattach a draft to an older attempt', async t => {
  const session = storage()
  let finishRecovery
  const recovering = new Promise(resolve => { finishRecovery = resolve })
  let respond
  const fetchMock = t.mock.method(globalThis, 'fetch', async (_url, options) => {
    if (options.method !== 'POST') return inactive()
    return new Promise(resolve => {
      respond = resolve
      finishRecovery()
    })
  })

  const pending = restoreInterestAttempt('', 'user-A', session)
  await recovering
  beginAssessmentAttempt(session, 20)
  const draft = { selected: ['Drawing'], pending: true }
  writeAssessmentSession(session, keys.interests, draft)
  respond(json({ attemptId: 12 }))

  await assert.rejects(pending, /Assessment progress changed/)
  assert.equal(getAssessmentAttemptId(session), 20)
  assert.deepEqual(readAssessmentSession(session, keys.interests, {}), draft)
  assert.equal(fetchMock.mock.callCount(), 2)
})

test('ordered writes capture their original attempt and token across navigation', async t => {
  const session = storage(), requests = []
  beginAssessmentAttempt(session, 12)
  let finishFirst
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    requests.push(options)
    if (requests.length === 1) await new Promise(resolve => { finishFirst = resolve })
    return json({ saved: true })
  })
  const first = saveActiveAttemptDraft('', 'user-A', session, { personality_answers: { 1: 2 } })
  const second = saveActiveAttemptDraft('', 'user-A', session, { personality_answers: { 1: 4 } })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(requests.length, 1)
  session.setItem(keys.attemptId, '20')
  finishFirst()
  await Promise.all([first, second])
  assert.deepEqual(requests.map(request => JSON.parse(request.body).personality_answers[1]), [2, 4])
  assert.ok(requests.every(request => request.headers['X-Assessment-Attempt-Id'] === '12' &&
    request.headers.Authorization === 'Bearer user-A' && request.keepalive === true))
})

test('success responses are fully consumed before another queued keepalive save starts', async t => {
  const session = storage(), responses = []
  beginAssessmentAttempt(session, 12)
  t.mock.method(globalThis, 'fetch', async () => {
    assert.ok(responses.every(response => response.bodyUsed), 'Previous response must release its keepalive budget')
    const response = json({ saved: true })
    responses.push(response)
    return response
  })
  for (let index = 0; index < 30; index++) {
    await saveActiveAttemptDraft('', 'A', session, { skill_answers: [{ question_id: index + 1, selected_option: 'A' }] })
  }
  assert.equal(responses.length, 30)
  assert.ok(responses.every(response => response.bodyUsed))
})

test('retry responses are drained and a successful HTTP status alone cannot confirm saving', async t => {
  const session = storage()
  beginAssessmentAttempt(session, 12)
  const failed = json({ message: 'Temporary failure' }, 503), success = json({ saved: true })
  const responses = [failed, success]
  const mock = t.mock.method(globalThis, 'fetch', async () => responses.shift())
  await saveActiveAttemptDraft('', 'A', session, { personality_answers: { 1: 4 } })
  assert.equal(failed.bodyUsed, true)
  assert.equal(success.bodyUsed, true)
  mock.mock.mockImplementation(async () => json({}))
  await assert.rejects(saveActiveAttemptDraft('', 'A', session, { personality_answers: { 1: 5 } }), /Could not confirm/)
})

test('network retry, explicit failures, missing identities and logout do not falsely confirm saves', async t => {
  const session = storage()
  beginAssessmentAttempt(session, 12)
  let calls = 0
  const mock = t.mock.method(globalThis, 'fetch', async () => { calls++; if (calls === 1) throw Error('offline'); return json({ saved: true }) })
  await saveActiveAttemptDraft('', 'user-A', session, { personality_answers: { 1: 3 } })
  assert.equal(calls, 2)
  mock.mock.mockImplementation(async () => json({ message: 'Session expired' }, 401))
  await assert.rejects(saveActiveAttemptDraft('', 'user-A', session, { personality_answers: {} }), /Session expired/)
  await assert.rejects(saveActiveAttemptDraft('', 'user-A', storage(), {}), /restore/)
  const pending = saveActiveAttemptDraft('', 'user-A', session, { personality_answers: {} })
  invalidateAssessmentSession()
  await assert.rejects(pending, /session has changed/)
})

test('account switching clears local answers and an old response cannot restore the previous identity', async t => {
  const local = storage(), session = storage()
  storeUserAuth(local, { token: 'A', userId: 1, username: 'A' }, session)
  beginAssessmentAttempt(session, 12)
  session.setItem(keys.personality, JSON.stringify({ answers: { 1: 5 } }))
  let respond
  t.mock.method(globalThis, 'fetch', () => new Promise(resolve => { respond = resolve }))
  const oldRead = readActiveAttempt('', 'A', session)
  clearUserAuth(local, session)
  storeUserAuth(local, { token: 'B', userId: 2, username: 'B' }, session)
  respond(json({ attemptId: 12, personalityAnswers: { 1: 5 } }))
  assert.equal(await oldRead, null)
  assert.equal(session.getItem(keys.personality), null)
  assert.equal(getAssessmentAttemptId(session), null)
})

test('logout during an in-flight request cannot confirm the old session save', async t => {
  const session = storage()
  beginAssessmentAttempt(session, 12)
  let respond
  t.mock.method(globalThis, 'fetch', () => new Promise(resolve => { respond = resolve }))
  const save = saveActiveAttemptDraft('', 'A', session, { personality_answers: { 1: 4 } })
  await new Promise(resolve => setImmediate(resolve))
  invalidateAssessmentSession()
  respond(json({ saved: true }))
  await assert.rejects(save, /session has changed/)
})

test('question-position writes retain pending save identity across restoration', () => {
  const session = storage()
  writeAssessmentSession(session, keys.skills, { answers: { 1: 'A' }, pending: true, pendingSaveId: 'save-1' })
  writeAssessmentSession(session, keys.skills, { answers: { 1: 'A' }, currentIndex: 1 })
  assert.deepEqual(readAssessmentSession(session, keys.skills, {}), {
    answers: { 1: 'A' }, currentIndex: 1, pending: true, pendingSaveId: 'save-1',
  })
})

test('resume picks the unfinished step and never marks unsubmitted personality answers completed', () => {
  assert.equal(getAttemptResumeRoute(null), null)
  assert.equal(getAttemptResumeRoute({}), '/onboarding/profile')
  const attempt = { personalFactors: {} }
  assert.equal(getAttemptResumeRoute(attempt), '/onboarding/interests')
  attempt.interests = { selected: [], noInterests: true }
  assert.equal(getAttemptResumeRoute(attempt), '/onboarding/interests')
  attempt.interestsSubmitted = true
  assert.equal(getAttemptResumeRoute(attempt), '/onboarding/skills')
  attempt.skillResult = { domainScores: {} }
  attempt.personalityAnswers = Object.fromEntries(Array.from({ length: 40 }, (_, index) => [index + 1, 3]))
  assert.equal(getAttemptResumeRoute(attempt), '/onboarding/personality')
})

test('autosaved interest selections do not complete the step or skip its confirmation', () => {
  for (const interests of [{ selected: ['Drawing'], noInterests: false }, { selected: [], noInterests: true }]) {
    const attempt = { personalFactors: {}, interests, interestsSubmitted: false }
    assert.equal(hasSubmittedAssessmentInterests(attempt), false)
    assert.equal(getAttemptResumeRoute(attempt), '/onboarding/interests')
    assert.equal(hasSubmittedAssessmentInterests({ ...attempt, interestsSubmitted: true }), true)
    assert.equal(getAttemptResumeRoute({ ...attempt, interestsSubmitted: true }), '/onboarding/skills')
  }
})

test('older backend responses resume later steps only with evidence beyond draft selections', () => {
  const attempt = { personalFactors: {}, interests: { selected: ['Drawing'], noInterests: false } }
  assert.equal(getAttemptResumeRoute(attempt), '/onboarding/interests')
  assert.equal(getAttemptResumeRoute({ ...attempt, skillQuestions: [{ question_id: 1 }] }), '/onboarding/skills')
  assert.equal(getAttemptResumeRoute({ ...attempt, skillResult: {} }), '/onboarding/personality')
})
