import { PARENT_CLUSTERS } from '../config/recommendationConfig.js'

export const FEEDBACK_CATEGORIES = new Set([
  'Bug Report',
  'Suggestion',
  'General Feedback',
])

const PROFILE_BOOLEAN_FIELDS = [
  'factor_physical',
  'factor_health',
  'factor_financial',
  'factor_family',
  'factor_working_student',
]

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
  const fullName = text(body.full_name, { required: true, max: 150 })
  if (!fullName) return { valid: false, message: 'Full name is required and must be at most 150 characters.' }
  for (const field of PROFILE_BOOLEAN_FIELDS) {
    if (typeof body[field] !== 'boolean') {
      return { valid: false, message: `${field} must be a boolean.` }
    }
  }
  const ranges = [['height_cm', 50, 300], ['weight_kg', 10, 500]]
  for (const [field, min, max] of ranges) {
    if (body[field] === '' || body[field] === null || body[field] === undefined) continue
    const value = Number(body[field])
    if (!Number.isFinite(value) || value < min || value > max) {
      return { valid: false, message: `${field} must be between ${min} and ${max}.` }
    }
  }
  return { valid: true, value: { ...body, full_name: fullName } }
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
