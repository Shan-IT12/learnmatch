import { SKILL_DOMAINS } from '../config/recommendationConfig.js'

const object = value => value && typeof value === 'object' && !Array.isArray(value)
const id = value => Number.isSafeInteger(value) && value > 0
export class AssessmentValidationError extends Error {}
const reject = message => { throw new AssessmentValidationError(message) }

export function validateQuestionSet(questions) {
  if (!Array.isArray(questions) || questions.length !== 30) reject('Exactly 30 active quiz questions are required.')
  const ids = new Set()
  const counts = Object.fromEntries(SKILL_DOMAINS.map(domain => [domain, 0]))
  for (const question of questions) {
    if (!object(question) || !id(question.question_id) || ids.has(question.question_id) || !Object.hasOwn(counts, question.dimension)) reject('Invalid or duplicate quiz question.')
    ids.add(question.question_id)
    counts[question.dimension]++
  }
  if (Object.values(counts).some(count => count !== 5)) reject('The quiz requires five questions in each of the six skill domains.')
  return ids
}

export function validateSkillAnswerSet(answers, questions, { partial = false } = {}) {
  const ids = validateQuestionSet(questions)
  if (!Array.isArray(answers) || answers.length > 30 || (!partial && answers.length !== 30)) reject('Invalid number of quiz answers.')
  const seen = new Set()
  return answers.map(answer => {
    if (!object(answer) || !id(answer.question_id) || !ids.has(answer.question_id) || seen.has(answer.question_id) || !['A', 'B', 'C', 'D'].includes(answer.selected_option)) reject('Answers must refer to unique questions in this assessment quiz.')
    seen.add(answer.question_id)
    return { question_id: answer.question_id, selected_option: answer.selected_option }
  })
}

export function validatePersonalityDraft(answers) {
  if (!object(answers) || Object.keys(answers).length > 40) reject('Invalid personality draft.')
  for (const [key, value] of Object.entries(answers)) {
    if (!/^(?:[1-9]|[1-3][0-9]|40)$/.test(key) || !Number.isInteger(value) || value < 1 || value > 5) reject('Personality answers require item IDs from 1 to 40 and ratings from 1 to 5.')
  }
}

export async function validatedAssessmentDraft(database, draft, attempt) {
  const result = { ...draft }
  const parse = value => typeof value === 'string' ? JSON.parse(value) : value
  const existing = parse(attempt.skill_questions) || []
  let questions = existing
  if (draft.skill_questions !== undefined) {
    const requested = draft.skill_questions
    validateQuestionSet(requested)
    const requestedIds = requested.map(q => q.question_id)
    if (existing.length && (existing.length !== 30 || existing.some(q => !q || !requestedIds.includes(q.question_id)))) reject('The saved quiz question set cannot be replaced. Please resume the current quiz.')
    const [rows] = await database.query(`SELECT question_id, question_text, image_url, dimension, choice_a, choice_b, choice_c, choice_d FROM QUESTION WHERE is_active = 1 AND question_id IN (${requestedIds.map(() => '?').join(',')})`, requestedIds)
    validateQuestionSet(rows)
    const byId = new Map(rows.map(row => [row.question_id, row]))
    questions = requestedIds.map(key => byId.get(key))
    result.skill_questions = questions
  }
  if (draft.skill_answers !== undefined) {
    result.skill_answers = validateSkillAnswerSet(draft.skill_answers, questions, { partial: true })
    if (attempt.skill_result) reject('Academic Skills has already been finalized for this attempt.')
  }
  if (draft.personality_answers !== undefined) validatePersonalityDraft(draft.personality_answers)
  return result
}
