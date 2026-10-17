import test from 'node:test'
import assert from 'node:assert/strict'
import { searchActiveCollegeCourses } from '../services/collegeCourseSearchService.js'

test('college course search parameterizes name, abbreviation and stable-code lookups using an isolated database mock', async () => {
  const fixture = { course_id: 9001, course_code: 'CRS062', course_name: 'Bachelor of Science in Information Technology', course_abbreviation: 'BSIT' }
  const queries = []
  const database = { query: async (sql, args) => {
    queries.push({ sql, args })
    assert.match(sql, /LOWER\(course_name\) LIKE LOWER\(\?\)/)
    assert.match(sql, /LOWER\(course_abbreviation\) LIKE LOWER\(\?\)/)
    assert.match(sql, /LOWER\(course_code\) LIKE LOWER\(\?\)/)
    assert.match(sql, /AND is_active = 1 AND is_draft = 0/)
    assert.equal(args.length, 4)
    const matches = [fixture.course_name, fixture.course_abbreviation, fixture.course_code]
      .some(value => value.toLowerCase().includes(args[0].slice(1, -1).toLowerCase()))
    return [matches ? [{ ...fixture }] : []]
  } }
  const uppercaseResults = await searchActiveCollegeCourses(database, 'BSIT')
  const lowercaseResults = await searchActiveCollegeCourses(database, 'bsit')
  const nameResults = await searchActiveCollegeCourses(database, 'Information Technology')
  const courseCodeResults = await searchActiveCollegeCourses(database, 'CRS062')
  const noResults = await searchActiveCollegeCourses(database, 'not-a-real-course')

  assert.ok(uppercaseResults.some(({ course_code }) => course_code === 'CRS062'))
  assert.ok(lowercaseResults.some(({ course_code }) => course_code === 'CRS062'))
  assert.ok(nameResults.some(({ course_code }) => course_code === 'CRS062'))
  assert.ok(courseCodeResults.some(({ course_code }) => course_code === 'CRS062'))
  assert.deepEqual(noResults, [])
  assert.deepEqual(queries[0].args, ['%BSIT%', '%BSIT%', '%BSIT%', '%BSIT%'])
  assert.deepEqual(queries[2].args, ['%Information Technology%', '%Information Technology%', '%Information Technology%', '%InformationTechnology%'])
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
