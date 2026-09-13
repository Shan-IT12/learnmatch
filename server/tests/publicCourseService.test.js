import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getPublicCourse,
  getPublicCourseCount,
  searchPublicCourses,
} from '../services/publicCourseService.js'

test('loads all validated courses', () => {
  assert.equal(getPublicCourseCount(), 342)
})

test('searches partial names and abbreviations case-insensitively', () => {
  assert.ok(searchPublicCourses('info').some((course) => course.course_name.includes('Information Technology')))
  assert.equal(searchPublicCourses('BSIT')[0].course_abbreviation, 'BSIT')
})

test('searches skills and career paths', () => {
  assert.ok(searchPublicCourses('programming').length > 0)
  assert.ok(searchPublicCourses('teacher').some((course) => course.cluster_category.includes('EDUCATION')))
  assert.ok(searchPublicCourses('nursing').some((course) => course.course_name.includes('Nursing')))
})

test('supports multiple words and blank/no-result queries', () => {
  assert.ok(searchPublicCourses('information technology').length > 0)
  assert.deepEqual(searchPublicCourses('  '), [])
  assert.deepEqual(searchPublicCourses('zzzz-no-such-course-zzzz'), [])
})

test('returns public details by stable course code', () => {
  const course = getPublicCourse('crs001')
  assert.equal(course.course_code, 'CRS001')
  assert.ok(course.obtainable_skills.length > 1)
  assert.ok(course.career_paths.length > 1)
  assert.equal(getPublicCourse('CRS999'), null)
})
