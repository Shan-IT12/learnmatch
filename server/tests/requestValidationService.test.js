import assert from 'node:assert/strict'
import test from 'node:test'
import {
  validateCareer,
  validateCourse,
  validateFeedback,
  validateProfile,
  validateSkillQuiz,
} from '../services/requestValidationService.js'

test('feedback validation enforces rating, categories, and comment limits', () => {
  assert.equal(validateFeedback({ rating: 5, category: 'Suggestion', comment: 'Useful' }).valid, true)
  assert.equal(validateFeedback({ rating: 6, category: 'Suggestion' }).valid, false)
  assert.equal(validateFeedback({ rating: 4, category: 'Injected' }).valid, false)
  assert.equal(validateFeedback({ rating: 4, category: 'Bug Report', comment: 'x'.repeat(2001) }).valid, false)
})

test('skill quiz requires 30 unique positive IDs and A-D options', () => {
  const answers = Array.from({ length: 30 }, (_, index) => ({ question_id: index + 1, selected_option: 'A' }))
  assert.equal(validateSkillQuiz(answers).valid, true)
  assert.equal(validateSkillQuiz(answers.slice(0, 29)).valid, false)
  assert.equal(validateSkillQuiz([...answers.slice(0, 29), answers[0]]).valid, false)
  assert.equal(validateSkillQuiz(answers.map((item, index) => index ? item : { ...item, selected_option: 'E' })).valid, false)
})

test('profile validation enforces structured accessibility and impact responses', () => {
  const profile = {
    username: 'student_name',
    physical_accessibility_areas: ['seeing'],
    physical_accessibility_difficulties: { seeing: 'some_difficulty' },
    factor_physical_impact: 1,
    factor_health_impact: 2,
    factor_financial_impact: 3,
    factor_family_impact: 4,
    factor_work_impact: 1,
  }
  const result = validateProfile(profile)
  assert.equal(result.valid, true)
  assert.equal(result.value.username, 'student_name')
  assert.equal(Object.hasOwn(result.value, 'full_name'), false)
  assert.equal(Object.hasOwn(result.value, 'height_cm'), false)
  assert.equal(Object.hasOwn(result.value, 'weight_kg'), false)
  assert.equal(Object.hasOwn(result.value, 'factor_others'), false)
  assert.equal(validateProfile({ ...profile, height_cm: 'invalid', weight_kg: {}, factor_others: ['ignored'] }).valid, true)
  assert.equal(validateProfile({ ...profile, factor_health_impact: '2' }).valid, false)
  assert.equal(validateProfile({ ...profile, username: '   ' }).valid, false)
  assert.equal(validateProfile({ ...profile, username: 'ab' }).valid, false)
  assert.equal(validateProfile({ ...profile, username: 'student-name' }).valid, false)
  assert.equal(validateProfile({ ...profile, username: 'a'.repeat(31) }).valid, false)
  assert.equal(validateProfile({ ...profile, factor_family_impact: 5 }).valid, false)
  assert.equal(validateProfile({ ...profile, physical_accessibility_areas: ['none'], physical_accessibility_difficulties: {} }).valid, false)
  assert.equal(validateProfile({ ...profile, physical_accessibility_areas: ['none', 'seeing'] }).valid, false)
  assert.equal(validateProfile({ ...profile, physical_accessibility_difficulties: {} }).valid, false)
  assert.equal(validateProfile({ ...profile, physical_accessibility_difficulties: { seeing: 'no_difficulty' } }).valid, false)
  assert.equal(validateProfile({ ...profile, physical_accessibility_difficulties: { seeing: 'severe' } }).valid, false)
  assert.equal(validateProfile({ ...profile, factor_physical_impact: 1, physical_accessibility_areas: [], physical_accessibility_difficulties: {} }).valid, true)
  assert.equal(validateProfile({ ...profile, factor_physical_impact: 2, physical_accessibility_areas: [], physical_accessibility_difficulties: {} }).valid, false)
})

test('admin course and career validation trims values and caps text', () => {
  const course = validateCourse({ course_name: ' BS IT ', cluster_category: 'ENGINEERING / STEM CLUSTER' })
  assert.equal(course.valid, true)
  assert.equal(course.value.course_name, 'BS IT')
  assert.equal(validateCourse({ course_name: 'BS IT', cluster_category: 'Technology' }).valid, false)
  assert.equal(validateCourse({ course_name: 'x'.repeat(256), cluster_category: 'ENGINEERING / STEM CLUSTER' }).valid, false)
  assert.equal(validateCourse({ course_name: 'BS IT', cluster_category: 'BUSINESS CLUSTER', program_type: 'x'.repeat(51) }).valid, false)
  assert.equal(validateCourse({ course_name: 'BS IT', cluster_category: 'BUSINESS CLUSTER', psced_group: 'x'.repeat(151) }).valid, false)
  assert.equal(validateCareer({ job_title: 'Developer', salary_range: 'PHP 20k-40k' }).valid, true)
  assert.equal(validateCareer({ job_title: '', salary_range: 'PHP 20k-40k' }).valid, false)
})
