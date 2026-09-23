import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import pool from '../config/db.js'
import { searchActiveCollegeCourses } from '../services/collegeCourseSearchService.js'

test('college course search finds active BSIT courses from the configured database', async () => {
  const uppercaseResults = await searchActiveCollegeCourses(pool, 'BSIT')
  const lowercaseResults = await searchActiveCollegeCourses(pool, 'bsit')
  const nameResults = await searchActiveCollegeCourses(pool, 'Information Technology')
  const courseCodeResults = await searchActiveCollegeCourses(pool, 'CRS062')
  const noResults = await searchActiveCollegeCourses(pool, 'not-a-real-course')

  assert.ok(uppercaseResults.some(({ course_code }) => course_code === 'CRS062'))
  assert.ok(lowercaseResults.some(({ course_code }) => course_code === 'CRS062'))
  assert.ok(nameResults.some(({ course_code }) => course_code === 'CRS062'))
  assert.ok(courseCodeResults.some(({ course_code }) => course_code === 'CRS062'))
  assert.deepEqual(noResults, [])
})

test('college course search limits selectable results to active courses', async () => {
  let capturedSql = ''
  const database = {
    query: async (sql) => {
      capturedSql = sql
      return [[]]
    },
  }

  await searchActiveCollegeCourses(database, 'BSIT')
  assert.match(capturedSql, /AND is_active = 1/)
})

test('college course search excludes deprecated and quarantined identities', async () => {
  const database = {
    query: async () => [[
      { course_code: 'CRS021', course_name: 'Current' },
      { course_code: 'CRS020', course_name: 'Duplicate' },
      { course_code: 'CRS166', course_name: 'Quarantined' },
    ]],
  }

  const results = await searchActiveCollegeCourses(database, 'course')
  assert.deepEqual(results.map(({ course_code }) => course_code), ['CRS021'])
})

after(async () => {
  await pool.end()
})
