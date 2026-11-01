import test from 'node:test'
import assert from 'node:assert/strict'
import { searchActiveCollegeCourses } from '../services/collegeCourseSearchService.js'
import { searchPublicCourses } from '../services/publicCourseService.js'

test('catalog abbreviations and names find active database courses with missing abbreviations', async () => {
  const catalog = searchPublicCourses('')
  const database = { query: async (sql, args) => {
    assert.match(sql, /AND is_active = 1 AND is_draft = 0/)
    assert.doesNotMatch(sql, /LIMIT 25/)
    // Stable-code candidates must be passed to SQL, not only matched after retrieval.
    return [catalog.filter(course => args.slice(4).includes(course.course_code))
      .map((course, index) => ({ ...course, course_id: index + 1, course_abbreviation: null }))]
  } }
  for (const query of ['bscs', 'BS CS', 'B.S.C.S.', 'Computer Science', 'science computer', 'CRS026']) {
    const results = await searchActiveCollegeCourses(database, query)
    assert.ok(results.some(course => course.course_code === 'CRS026'), query)
    assert.equal(results.find(course => course.course_code === 'CRS026').course_abbreviation, 'BSCS')
  }
  for (const course of catalog.filter(course => course.course_abbreviation)) {
    const results = await searchActiveCollegeCourses(database, course.course_abbreviation.toLowerCase())
    assert.ok(results.some(result => result.course_abbreviation === course.course_abbreviation), course.course_abbreviation)
    const sameAbbreviation = catalog.filter(item => item.course_abbreviation?.toLowerCase() === course.course_abbreviation.toLowerCase())
    if (sameAbbreviation.length <= 5) assert.ok(results.some(result => result.course_code === course.course_code), course.course_abbreviation)
  }
  assert.deepEqual(await searchActiveCollegeCourses(database, 'not-a-real-course'), [])
  assert.deepEqual(await searchActiveCollegeCourses(database, '...'), [])
})

test('exact abbreviation ranks above partial matches before the five-result cutoff', async () => {
  const database = { query: async () => [[
    ...Array.from({ length: 30 }, (_, index) => ({ course_code: `NEW${index}`, course_name: `A partial BSCS ${index}`, is_published_new: 1 })),
    { course_code: 'CRS026', course_name: 'Bachelor of Science in Computer Science', course_abbreviation: null },
  ]] }
  const results = await searchActiveCollegeCourses(database, 'BSCS')
  assert.equal(results.length, 5)
  assert.equal(results[0].course_code, 'CRS026')
})

test('college course search parameterizes name, abbreviation and stable-code lookups using an isolated database mock', async () => {
  const fixture = { course_id: 9001, course_code: 'CRS062', course_name: 'Bachelor of Science in Information Technology', course_abbreviation: 'BSIT' }
  const queries = []
  const database = { query: async (sql, args) => {
    queries.push({ sql, args })
    assert.match(sql, /LOWER\(course_name\) LIKE LOWER\(\?\)/)
    assert.match(sql, /LOWER\(course_abbreviation\) LIKE LOWER\(\?\)/)
    assert.match(sql, /LOWER\(course_code\) LIKE LOWER\(\?\)/)
    assert.match(sql, /AND is_active = 1 AND is_draft = 0/)
    assert.ok(args.length >= 4)
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
  assert.deepEqual(queries[0].args.slice(0, 4), ['%BSIT%', '%BSIT%', '%BSIT%', '%BSIT%'])
  assert.deepEqual(queries[2].args.slice(0, 4), ['%Information Technology%', '%Information Technology%', '%Information Technology%', '%InformationTechnology%'])
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
