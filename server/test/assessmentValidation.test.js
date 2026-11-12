import test from 'node:test'
import assert from 'node:assert/strict'
import { SKILL_DOMAINS } from '../config/recommendationConfig.js'
import { validateQuestionSet, validateSkillAnswerSet, validatePersonalityDraft, validatedAssessmentDraft } from '../services/assessmentValidationService.js'
import { passwordSessionVersion, matchesPasswordSession } from '../services/sessionVersionService.js'

const questions = SKILL_DOMAINS.flatMap((dimension, d) => Array.from({ length: 5 }, (_, i) => ({ question_id: d * 5 + i + 1, dimension, question_text: 'Question', choice_a: 'A', choice_b: 'B', choice_c: 'C', choice_d: 'D' })))
const answers = questions.map(q => ({ question_id: q.question_id, selected_option: 'A' }))
test('password-bound sessions reject old passwords and pre-upgrade tokens, including immediate resets', () => {
  const version = passwordSessionVersion('old-hash', 'test-secret')
  assert.equal(matchesPasswordSession(version, 'old-hash', 'test-secret'), true)
  assert.equal(matchesPasswordSession(version, 'new-hash', 'test-secret'), false)
  assert.equal(matchesPasswordSession(undefined, 'old-hash', 'test-secret'), false)
  assert.equal(matchesPasswordSession('invalid', 'old-hash', 'test-secret'), false)
  assert.equal(matchesPasswordSession(passwordSessionVersion('new-hash', 'test-secret'), 'new-hash', 'test-secret'), true)
})
test('quiz requires six balanced domains and answers bound to exactly those questions', () => {
  assert.equal(validateQuestionSet(questions).size, 30)
  assert.deepEqual(validateSkillAnswerSet(answers, questions), answers)
  assert.throws(() => validateQuestionSet(questions.map(q => ({ ...q, dimension: 'Numerical' }))))
  assert.throws(() => validateQuestionSet([...questions.slice(1), questions[1]]))
  assert.throws(() => validateSkillAnswerSet([{ question_id: 999, selected_option: 'A' }], questions, { partial: true }))
  assert.throws(() => validateSkillAnswerSet([answers[0], answers[0]], questions, { partial: true }))
  assert.deepEqual(validateSkillAnswerSet([], questions, { partial: true }), [])
})
test('personality drafts support partial responses and reject malformed IDs and ratings', () => {
  validatePersonalityDraft({})
  validatePersonalityDraft({ 1: 1, 40: 5 })
  for (const draft of [null, [], { garbage: 'invalid' }, { 0: 3 }, { 41: 3 }, { 1: 6 }, { 1: '3' }]) assert.throws(() => validatePersonalityDraft(draft))
})
test('draft saves restore canonical questions, accept partial answers and reject poisoned or replaced sets', async () => {
  const db = { query: async () => [[...questions].reverse()] }
  const safe = await validatedAssessmentDraft(db, { skill_questions: questions.map(q => ({ ...q, question_text: 'forged' })), skill_answers: answers.slice(0, 1), personality_answers: { 1: 4 } }, {})
  assert.equal(safe.skill_questions[0].question_text, 'Question')
  assert.deepEqual(safe.skill_answers, answers.slice(0, 1))
  await assert.rejects(validatedAssessmentDraft(db, { skill_questions: [null], skill_answers: [null] }, {}))
  await assert.rejects(validatedAssessmentDraft(db, { skill_questions: questions.map(q => ({ ...q, question_id: q.question_id + 30 })) }, { skill_questions: questions }))
  await assert.rejects(validatedAssessmentDraft(db, { skill_answers: answers }, { skill_questions: questions, skill_result: {} }))
})
