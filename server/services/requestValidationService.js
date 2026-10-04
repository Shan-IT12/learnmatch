import { PARENT_CLUSTERS } from '../config/recommendationConfig.js'
import { validateUsername } from './usernameValidationService.js'

export const FEEDBACK_CATEGORIES = new Set([
  'Bug Report',
  'Suggestion',
  'General Feedback',
])

export const PHYSICAL_ACCESSIBILITY_AREAS = Object.freeze([
  'seeing',
  'hearing',
  'walking_climbing',
  'self_care',
  'other',
])

export const PHYSICAL_DIFFICULTY_LEVELS = Object.freeze([
  'some_difficulty',
  'a_lot_of_difficulty',
  'cannot_do',
])

export const PERSONAL_FACTOR_IMPACT_FIELDS = Object.freeze([
  'factor_physical_impact',
  'factor_health_impact',
  'factor_financial_impact',
  'factor_family_impact',
  'factor_work_impact',
])

const text = (value, { required = false, max }) => {
  if (value === undefined || value === null || value === '') {
    return required ? null : ''
  }
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  if ((required && !normalized) || normalized.length > max) return null
  return normalized
}

export function positiveInteger(value) {
  const normalized = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value
  return Number.isInteger(normalized) && normalized > 0 ? normalized : null
}

export function validateFeedback(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { valid: false, message: 'Invalid feedback.' }
  }
  const rating = Number(body.rating)
  const category = text(body.category, { required: true, max: 40 })
  const comment = text(body.comment, { max: 2000 })
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { valid: false, message: 'Rating must be an integer from 1 through 5.' }
  }
  if (!category || !FEEDBACK_CATEGORIES.has(category)) {
    return { valid: false, message: 'Invalid feedback category.' }
  }
  if (comment === null) return { valid: false, message: 'Comment must be text up to 2000 characters.' }
  return { valid: true, value: { rating, category, comment: comment || null } }
}

export function validateSkillQuiz(answers) {
  if (!Array.isArray(answers) || answers.length !== 30) {
    return { valid: false, message: 'Exactly 30 answers are required.' }
  }
  const seen = new Set()
  const normalized = []
  for (const answer of answers) {
    if (!answer || typeof answer !== 'object' || Array.isArray(answer)) {
      return { valid: false, message: 'Each answer must be a valid object.' }
    }
    const questionId = positiveInteger(answer.question_id)
    const selectedOption = typeof answer.selected_option === 'string'
      ? answer.selected_option.trim().toUpperCase()
      : ''
    if (!questionId || !['A', 'B', 'C', 'D'].includes(selectedOption)) {
      return { valid: false, message: 'Each answer must have a valid question ID and option.' }
    }
    if (seen.has(questionId)) return { valid: false, message: 'Duplicate question IDs are not allowed.' }
    seen.add(questionId)
    normalized.push({ question_id: questionId, selected_option: selectedOption })
  }
  return { valid: true, answers: normalized }
}

export function validateProfile(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { valid: false, message: 'Invalid profile.' }
  }
  const usernameValidation = validateUsername(body.username)
  if (!usernameValidation.valid) {
    return { valid: false, field: 'username', message: usernameValidation.message }
  }
  const areas = body.physical_accessibility_areas
  if (!Array.isArray(areas) || (areas.length === 0 && body.factor_physical_impact !== 1)) {
    return { valid: false, message: 'Select at least one physical or accessibility area when the factor applies.' }
  }
  if (
    new Set(areas).size !== areas.length
    || areas.some((area) => !PHYSICAL_ACCESSIBILITY_AREAS.includes(area))
  ) {
    return { valid: false, message: 'Invalid physical or accessibility areas.' }
  }

  const difficulties = body.physical_accessibility_difficulties
  if (!difficulties || typeof difficulties !== 'object' || Array.isArray(difficulties)) {
    return { valid: false, message: 'Physical or accessibility difficulty levels are required.' }
  }
  const expectedDifficultyAreas = areas
  const difficultyAreas = Object.keys(difficulties)
  if (
    difficultyAreas.length !== expectedDifficultyAreas.length
    || expectedDifficultyAreas.some((area) => !PHYSICAL_DIFFICULTY_LEVELS.includes(difficulties[area]))
    || difficultyAreas.some((area) => !expectedDifficultyAreas.includes(area))
  ) {
    return { valid: false, message: 'Provide one valid difficulty level for each selected area.' }
  }

  for (const field of PERSONAL_FACTOR_IMPACT_FIELDS) {
    if (!Number.isInteger(body[field]) || body[field] < 1 || body[field] > 4) {
      return { valid: false, message: `${field} must be an integer from 1 to 4.` }
    }
  }
  return {
    valid: true,
    value: {
      username: usernameValidation.value,
      physical_accessibility_areas: [...areas],
      physical_accessibility_difficulties: { ...difficulties },
      ...Object.fromEntries(PERSONAL_FACTOR_IMPACT_FIELDS.map((field) => [field, body[field]])),
    },
  }
}

export function validateCourse(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { valid: false, message: 'Invalid course.' }
  }
  const limits = {
    course_name: [true, 255],
    program_type: [false, 50],
    cluster_category: [true, 100],
    psced_group: [false, 150],
    description: [false, 5000],
    obtainable_skills: [false, 5000],
  }
  const value = {}
  for (const [field, [required, max]] of Object.entries(limits)) {
    const normalized = text(body[field], { required, max })
    if (normalized === null) return { valid: false, message: `Invalid ${field}.` }
    value[field] = normalized || null
  }
  if (!PARENT_CLUSTERS.includes(value.cluster_category)) {
    return { valid: false, message: 'Select a supported cluster category.' }
  }
  return { valid: true, value }
}

export function validateCareer(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { valid: false, message: 'Invalid career opportunity.' }
  }
  const jobTitle = text(body.job_title, { required: true, max: 255 })
  const salaryRange = text(body.salary_range, { max: 100 })
  const description = text(body.description, { max: 3000 })
  if (!jobTitle || salaryRange === null || description === null) {
    return { valid: false, message: 'Invalid career opportunity fields.' }
  }
  return { valid: true, value: { job_title: jobTitle, salary_range: salaryRange || null, description: description || null } }
}
