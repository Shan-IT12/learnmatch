import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { buildPersonalFactorsSnapshot, createAssessmentAttempt, ensureAttemptPersonalFactors, ensureFinalizedSkillResponses, getCurrentAttempt, getOwnedAttempt, hasCompletePersonalityPrerequisites, hasMatchingFinalizedSkillResponses, insertFinalizedSkillResponses, parseAttemptJson, requestedAttemptId, scoreSkillAnswers, updateAttempt, updateCurrentAttemptDraft } from '../services/assessmentAttemptService.js'

const completeProfile = {
  physical_accessibility_areas: '["seeing"]',
  physical_accessibility_difficulties: '{"seeing":"some_difficulty"}',
  factor_physical_impact: 2,
  factor_health_impact: 1,
  factor_financial_impact: 3,
  factor_family_impact: 4,
  factor_work_impact: 2,
}

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

test('a new retake inserts its Profile PF snapshot while every other section starts fresh', async () => {
  const calls = []
  const database = { query: async (sql, params) => {
    calls.push({ sql, params })
    if (sql.includes('FROM PROFILE')) return [[completeProfile]]
    return [{ insertId: 41, affectedRows: 1 }]
  } }
  const created = await createAssessmentAttempt(database, 7)
  assert.equal(created.attemptId, 41)
  assert.deepEqual(created.personalFactors, buildPersonalFactorsSnapshot(completeProfile))
  const insert = calls.find(({ sql }) => sql.includes('INSERT INTO ASSESSMENT_ATTEMPT'))
  assert.ok(insert)
  assert.equal(JSON.parse(insert.params[1]).factor_family_impact, 4)
  assert.match(insert.sql, /personal_factors, interests, skill_questions, skill_answers/)
  assert.match(insert.sql, /VALUES \(\?, 'IN_PROGRESS', \?, NULL, NULL, NULL, NULL, NULL, NULL\)/)
})

test('recovering a NULL PF snapshot backfills it from the complete Profile', async () => {
  const calls = []
  const database = { query: async (sql, params) => {
    calls.push({ sql, params })
    if (sql.includes('FROM ASSESSMENT_ATTEMPT')) return [[{ attempt_id: 41, status: 'IN_PROGRESS', personal_factors: null }]]
    if (sql.includes('FROM PROFILE')) return [[completeProfile]]
    return [{ affectedRows: 1 }]
  } }
  const snapshot = await ensureAttemptPersonalFactors(database, 7, 41)
  assert.deepEqual(snapshot, buildPersonalFactorsSnapshot(completeProfile))
  assert.ok(calls.find(({ sql }) => sql.startsWith('UPDATE ASSESSMENT_ATTEMPT')))
})

test('recovering or revisiting an attempt preserves its existing PF snapshot', async () => {
  const saved = buildPersonalFactorsSnapshot(completeProfile)
  const calls = []
  const database = { query: async (sql, params) => {
    calls.push({ sql, params })
    return [[{ attempt_id: 41, status: 'IN_PROGRESS', personal_factors: JSON.stringify(saved) }]]
  } }
  assert.deepEqual(await ensureAttemptPersonalFactors(database, 7, 41), saved)
  assert.equal(calls.some(({ sql }) => sql.includes('FROM PROFILE')), false)
  assert.equal(calls.some(({ sql }) => sql.startsWith('UPDATE ASSESSMENT_ATTEMPT')), false)
})

test('all in-progress sections can be persisted on the active attempt', async () => {
  const calls = []
  const database = { query: async (sql, params) => { calls.push({ sql, params }); return [{ affectedRows: 1 }] } }
  assert.equal(await updateAttempt(database, 7, 41, 'skill_questions', [{ question_id: 1 }]), true)
  assert.equal(await updateAttempt(database, 7, 41, 'personality_answers', { 1: 5 }), true)
  assert.equal(calls.length, 2)
})

test('final skill scoring writes explicit binary correctness for correct and incorrect answers', async () => {
  const result = scoreSkillAnswers(
    [
      { question_id: 11, selected_option: 'B' },
      { question_id: 12, selected_option: 'A' },
    ],
    [
      { question_id: 11, correct_answer: 'B', dimension: 'Verbal' },
      { question_id: 12, correct_answer: 'D', dimension: 'Numerical' },
    ]
  )
  assert.deepEqual(result.scoredAnswers.map(({ is_correct }) => is_correct), [1, 0])
  assert.equal(result.correctCount, 1)

  const calls = []
  const database = { query: async (sql, params) => { calls.push({ sql, params }); return [{ affectedRows: 1 }] } }
  await insertFinalizedSkillResponses(database, 7, result.scoredAnswers)
  assert.deepEqual(calls.map(({ params }) => params[3]), [1, 0])
  assert.equal(calls.some(({ params }) => params[3] == null), false)
})

test('authoritative skill scoring replaces boolean and string draft correctness with numeric integers', async () => {
  const { scoredAnswers } = scoreSkillAnswers(
    [
      { question_id: 11, selected_option: 'B', is_correct: false },
      { question_id: 12, selected_option: 'A', is_correct: '1' },
    ],
    [
      { question_id: 11, correct_answer: 'B', dimension: 'Verbal' },
      { question_id: 12, correct_answer: 'D', dimension: 'Numerical' },
    ]
  )
  assert.deepEqual(scoredAnswers.map(({ is_correct }) => is_correct), [1, 0])
  assert.ok(scoredAnswers.every(({ is_correct }) => Number.isInteger(is_correct)))

  const inserted = []
  await insertFinalizedSkillResponses({ query: async (_sql, params) => { inserted.push(params); return [{ affectedRows: 1 }] } }, 7, scoredAnswers)
  assert.deepEqual(inserted.map((params) => params[3]), [1, 0])

  for (const invalid of [true, false, '0', '1', null, undefined, 2]) {
    let queried = false
    await assert.rejects(
      insertFinalizedSkillResponses({ query: async () => { queried = true } }, 7, [{ question_id: 11, selected_option: 'B', is_correct: invalid }]),
      /Finalized skill correctness must be 0 or 1/
    )
    assert.equal(queried, false)
  }
})

test('draft skill answers do not need correctness until finalization', async () => {
  const calls = []
  const database = { query: async (sql, params) => { calls.push({ sql, params }); return [{ affectedRows: 1 }] } }
  const draft = [{ question_id: 12, selected_option: 'B' }]
  assert.equal(await updateCurrentAttemptDraft(database, 7, { skill_answers: draft }, 41), true)
  assert.deepEqual(JSON.parse(calls[0].params[0]), draft)
  assert.equal('is_correct' in draft[0], false)
})

test('legacy Personality compatibility backfills skills only when the finalized set is missing', () => {
  const finalized = [
    { question_id: 11, selected_option: 'B', is_correct: 1 },
    { question_id: 12, selected_option: 'A', is_correct: 0 },
  ]
  assert.equal(hasMatchingFinalizedSkillResponses(finalized, finalized), true)
  assert.equal(hasMatchingFinalizedSkillResponses(finalized.slice(0, 1), finalized), false)
  assert.equal(hasMatchingFinalizedSkillResponses([{ ...finalized[0], is_correct: null }, finalized[1]], finalized), false)
  assert.equal(hasMatchingFinalizedSkillResponses([{ ...finalized[0], is_correct: true }, finalized[1]], finalized), false)
  assert.equal(hasMatchingFinalizedSkillResponses([{ ...finalized[0], is_correct: '1' }, finalized[1]], finalized), false)
  assert.equal(hasMatchingFinalizedSkillResponses(finalized, finalized.map((answer) => ({ ...answer, is_correct: 'invalid draft value' }))), true)
})

test('Personality reuses valid finalized Skills and rebuilds invalid drafts from authoritative answers', async () => {
  const selections = [
    { question_id: 11, selected_option: 'B', is_correct: true },
    { question_id: 12, selected_option: 'A', is_correct: '1' },
  ]
  const finalized = [
    { question_id: 11, selected_option: 'B', is_correct: 1 },
    { question_id: 12, selected_option: 'A', is_correct: 0 },
  ]
  const reuseCalls = []
  const reused = await ensureFinalizedSkillResponses({
    query: async (sql) => { reuseCalls.push(sql); return [finalized] },
  }, 7, selections)
  assert.equal(reused, false)
  assert.equal(reuseCalls.length, 1)

  const inserted = []
  const rebuilt = await ensureFinalizedSkillResponses({
    query: async (sql, params) => {
      if (sql.includes('FROM SKILL_RESPONSE')) return [[]]
      if (sql.includes('FROM QUESTION')) return [[
        { question_id: 11, correct_answer: 'B', dimension: 'Verbal' },
        { question_id: 12, correct_answer: 'D', dimension: 'Numerical' },
      ]]
      inserted.push(params)
      return [{ affectedRows: 1 }]
    },
  }, 7, selections)
  assert.equal(rebuilt, true)
  assert.deepEqual(inserted.map((params) => params[3]), [1, 0])
})

test('PATCH draft semantics update the current attempt and accept partial Academic Skills answers', async () => {
  const calls = []
  const database = { query: async (sql, params) => { calls.push({ sql, params }); return [{ affectedRows: 1 }] } }
  const partialAnswers = [{ question_id: 12, selected_option: 'B' }]
  assert.equal(await updateCurrentAttemptDraft(database, 7, { skill_answers: partialAnswers }), true)
  assert.match(calls[0].sql, /skill_answers = \?/)
  assert.match(calls[0].sql, /status = 'IN_PROGRESS'/)
  assert.doesNotMatch(calls[0].sql, /COMPLETED/)
  assert.deepEqual(JSON.parse(calls[0].params[0]), partialAnswers)
  assert.equal(calls[0].params.at(-1), 7)
})

test('draft updates are scoped to the explicitly active assessment attempt', async () => {
  const calls = []
  const database = { query: async (sql, params) => { calls.push({ sql, params }); return [{ affectedRows: 1 }] } }
  assert.equal(await updateCurrentAttemptDraft(database, 7, { interests: ['Reading'] }, 41), true)
  assert.match(calls[0].sql, /user_id = \? AND status = 'IN_PROGRESS' AND attempt_id = \?/)
  assert.doesNotMatch(calls[0].sql, /ORDER BY attempt_id DESC/)
  assert.deepEqual(calls[0].params, ['["Reading"]', 7, 41])
})

test('current attempt lookup restores persisted draft fields for revisits', async () => {
  const row = { attempt_id: 41, interests: '["Reading"]', skill_answers: '[{"question_id":12,"selected_option":"B"}]', personality_answers: '{"1":5}' }
  const database = { query: async () => [[row]] }
  assert.equal(await getCurrentAttempt(database, 7), row)
})

test('current-attempt PATCH route is authenticated and keeps final validation on quiz submit', async () => {
  const source = await readFile(new URL('../server.js', import.meta.url), 'utf8')
  assert.match(source, /app\.patch\('\/api\/assessment-attempts\/current', authenticateToken/)
  assert.match(source, /updateCurrentAttemptDraft\(pool, req\.user\.userId, draft, requestedAttemptId\(req\)\)/)
  assert.match(source, /No active assessment attempt exists for this user\./)
  assert.match(source, /app\.post\('\/api\/quiz', authenticateToken[\s\S]*?validateSkillQuiz\(req\.body\?\.answers\)/)
})

test('Personality finalization validates finalized skills but never inserts skill responses', async () => {
  const source = await readFile(new URL('../server.js', import.meta.url), 'utf8')
  const mbtiRoute = source.match(/app\.post\('\/api\/mbti',[\s\S]*?\/\/ Returns the user's saved MBTI result/)[0]
  assert.match(mbtiRoute, /hasCompletePersonalityPrerequisites/)
  assert.doesNotMatch(mbtiRoute, /INSERT INTO SKILL_RESPONSE/)
  assert.match(mbtiRoute, /ensureFinalizedSkillResponses\(connection, userId, skillAnswers\)/)
  assert.match(mbtiRoute, /INSERT INTO PERSONALITY_ASSESSMENT/)
})

test('final Personality submission accepts a fully populated in-progress attempt before its result id exists', () => {
  const attempt = {
    status: 'IN_PROGRESS',
    personal_factors: JSON.stringify(buildPersonalFactorsSnapshot(completeProfile)),
    interests: JSON.stringify(['Reading', 'Music', 'Art']),
    skill_questions: JSON.stringify(Array.from({ length: 30 }, (_, index) => ({ question_id: index + 1 }))),
    skill_answers: JSON.stringify(Array.from({ length: 30 }, (_, index) => ({
      question_id: index + 1,
      selected_option: 'A',
      is_correct: index % 2,
    }))),
    skill_result: JSON.stringify({ totalCorrect: 15, totalQuestions: 30, domainScores: {} }),
    personality_answers: JSON.stringify(Object.fromEntries(Array.from({ length: 40 }, (_, index) => [index + 1, 3]))),
    personality_assessment_id: null,
  }
  assert.equal(hasCompletePersonalityPrerequisites(attempt), true)
  assert.equal(hasCompletePersonalityPrerequisites({ ...attempt, personality_assessment_id: 999 }), true)
})

test('final Personality prerequisites use exactly the six populated attempt sections', () => {
  const attempt = {
    status: 'IN_PROGRESS',
    personal_factors: { factor_physical_impact: 1 },
    interests: ['Reading', 'Music', 'Art'],
    skill_questions: Array.from({ length: 30 }, (_, index) => ({ question_id: index + 1 })),
    skill_answers: Array.from({ length: 30 }, (_, index) => ({ question_id: index + 1, selected_option: 'A' })),
    skill_result: {},
    personality_answers: Object.fromEntries(Array.from({ length: 40 }, (_, index) => [index + 1, 3])),
    personality_assessment_id: null,
  }

  assert.equal(hasCompletePersonalityPrerequisites(attempt), true)
  for (const field of ['personal_factors', 'skill_result']) {
    assert.equal(hasCompletePersonalityPrerequisites({ ...attempt, [field]: null }), false)
  }
  for (const [field, value] of [
    ['interests', attempt.interests.slice(0, 2)],
    ['skill_questions', attempt.skill_questions.slice(0, 29)],
    ['skill_answers', attempt.skill_answers.slice(0, 29)],
    ['personality_answers', Object.fromEntries(Object.entries(attempt.personality_answers).slice(0, 39))],
  ]) {
    assert.equal(hasCompletePersonalityPrerequisites({ ...attempt, [field]: value }), false)
  }
})

test('completed attempt keeps its personality assessment link for historical results', () => {
  const row = parseAttemptJson(JSON.stringify({ personality_assessment_id: 88 }))
  assert.equal(row.personality_assessment_id, 88)
})

test('Continue recovery fills missing PF snapshots and Personality requires the completed snapshot', async () => {
  const source = await readFile(new URL('../server.js', import.meta.url), 'utf8')
  const recoverRoute = source.match(/app\.post\('\/api\/assessment-attempts\/recover',[\s\S]*?\n\}\)\r?\n/)[0]
  assert.match(recoverRoute, /ensureAttemptPersonalFactors/)
  assert.match(recoverRoute, /personalFactorsSnapshotted: Boolean\(personalFactors\)/)
  const mbtiRoute = source.match(/app\.post\('\/api\/mbti',[\s\S]*?\/\/ Returns the user's saved MBTI result/)[0]
  assert.match(mbtiRoute, /hasCompletePersonalityPrerequisites\(attemptForValidation\)/)
  assert.doesNotMatch(hasCompletePersonalityPrerequisites.toString(), /personality_assessment_id|COMPLETED/)
  assert.match(mbtiRoute, /INSERT INTO PERSONALITY_ASSESSMENT/)
  assert.match(source, /status = 'IN_PROGRESS'[\s\S]*ORDER BY attempt_id DESC LIMIT 1/)
})

test('starting a recommendation assessment does not mutate College tracking data', async () => {
  const source = await readFile(new URL('../server.js', import.meta.url), 'utf8')
  const route = source.match(/app\.post\('\/api\/assessment-attempts',[\s\S]*?\n\}\)\r?\n/)[0]
  assert.match(route, /createAssessmentAttempt/)
  assert.doesNotMatch(route, /COLLEGE_TRACKING_CYCLE|COLLEGE_TERM|SEMESTER_CHECKIN|UPDATE COURSE/)
})
