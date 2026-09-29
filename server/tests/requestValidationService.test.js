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

test('profile validation enforces required text, booleans, and physical ranges', () => {
  const profile = {
    full_name: 'Student Name', height_cm: 170, weight_kg: 65,
    factor_physical: false, factor_health: false, factor_financial: false,
    factor_family: false, factor_working_student: false,
  }
  assert.equal(validateProfile(profile).valid, true)
  assert.equal(validateProfile({ ...profile, factor_health: 'false' }).valid, false)
  assert.equal(validateProfile({ ...profile, height_cm: 999 }).valid, false)
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
