import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getPublicCourse,
  getPublicCourseCount,
  getAvailablePublicCourse,
  searchAvailablePublicCourses,
  searchPublicCourses,
} from '../services/publicCourseService.js'

const databaseWithActiveCodes = (...courseCodes) => ({
  query: async (sql) => {
    assert.equal(sql, 'SELECT course_code FROM COURSE WHERE is_active = 1')
    return [courseCodes.map((course_code) => ({ course_code }))]
  },
})

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

test('includes active courses and excludes inactive or unmapped courses from public search', async () => {
  const baseline = searchPublicCourses('information technology')
  const first = baseline[0]
  const activeResults = await searchAvailablePublicCourses(
    'information technology',
    {},
    databaseWithActiveCodes(first.course_code)
  )
  const inactiveResults = await searchAvailablePublicCourses(
    first.course_name,
    {},
    databaseWithActiveCodes()
  )

  assert.deepEqual(activeResults, [first])
  assert.deepEqual(inactiveResults, [])
})

test('preserves ranking among remaining active public courses', async () => {
  const baseline = searchPublicCourses('business')
  const activeCodes = baseline.slice(1, 5).map(({ course_code }) => course_code)
  const filtered = await searchAvailablePublicCourses(
    'business',
    {},
    databaseWithActiveCodes(...activeCodes)
  )

  assert.deepEqual(filtered.map(({ course_code }) => course_code), activeCodes)
})

test('makes active details available and inactive or unmapped details unavailable', async () => {
  assert.ok(await getAvailablePublicCourse('CRS001', databaseWithActiveCodes('CRS001')))
  assert.equal(await getAvailablePublicCourse('CRS001', databaseWithActiveCodes()), null)
  assert.equal(await getAvailablePublicCourse('CRS999', databaseWithActiveCodes('CRS999')), null)
})
