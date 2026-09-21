import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getSchoolsForCourse,
  SCHOOL_LOCATOR_ACADEMIC_YEAR,
  SCHOOL_LOCATOR_SCOPE,
} from '../services/schoolLocatorService.js'

const course = {
  course_id: 62,
  course_code: 'CRS062',
  course_name: 'Bachelor of Science in Information Technology',
  course_abbreviation: 'BSIT',
}

function database({ courseRows = [course], offeringRows = [], error = null } = {}) {
  const calls = []
  return {
    calls,
    async query(sql, params) {
      calls.push({ sql, params })
      if (error) throw error
      if (sql.includes('FROM COURSE')) return [courseRows]
      if (sql.includes('FROM SCHOOL_COURSE')) return [offeringRows]
      throw new Error(`Unexpected query: ${sql}`)
    },
  }
}

const schoolOffering = (major = null, overrides = {}) => ({
  school_id: 7,
  uii: '03194',
  school_name: 'First City Providential College',
  hei_type: 'Private',
  hei_type2: 'Private Non-Sectarian',
  address: 'San Jose Del Monte City, Bulacan',
  major,
  ...overrides,
})

test('returns mapped active course with public context', async () => {
  const result = await getSchoolsForCourse('CRS062', database({ offeringRows: [schoolOffering()] }))
  assert.equal(result.course.course_code, 'CRS062')
  assert.equal(result.schools.length, 1)
  assert.equal(result.location_scope, SCHOOL_LOCATOR_SCOPE)
  assert.equal(result.academic_year, SCHOOL_LOCATOR_ACADEMIC_YEAR)
})

test('attaches exact reviewed coordinates by UII', async () => {
  const result = await getSchoolsForCourse('CRS062', database({ offeringRows: [schoolOffering()] }))
  assert.equal(result.schools[0].latitude, 14.81028)
  assert.equal(result.schools[0].longitude, 121.06149)
})

test('returns null coordinates for a reviewed school without retained coordinates', async () => {
  const result = await getSchoolsForCourse('CRS062', database({
    offeringRows: [schoolOffering(null, {
      uii: '13228',
      school_name: 'STI College - San Jose del Monte',
    })],
  }))
  assert.equal(result.schools[0].latitude, null)
  assert.equal(result.schools[0].longitude, null)
})

test('returns null coordinates for an unknown UII without changing the school offering', async () => {
  const sourceOffering = schoolOffering('Cyber Security', {
    uii: 'unknown-uii',
    school_name: 'Unknown reviewed location',
  })
  const result = await getSchoolsForCourse('CRS062', database({ offeringRows: [sourceOffering] }))

  assert.equal(result.schools.length, 1)
  assert.equal(result.schools[0].latitude, null)
  assert.equal(result.schools[0].longitude, null)
  assert.deepEqual(result.schools[0].offerings, [{ major: 'Cyber Security' }])
  assert.equal(sourceOffering.major, 'Cyber Security')
})

test('returns an empty school list for an unmapped active canonical course', async () => {
  const result = await getSchoolsForCourse('CRS062', database())
  assert.deepEqual(result.schools, [])
})

test('returns null for malformed or nonexistent course codes', async () => {
  const malformedDb = database()
  assert.equal(await getSchoolsForCourse('not-a-code', malformedDb), null)
  assert.equal(malformedDb.calls.length, 0)
  assert.equal(await getSchoolsForCourse('CRS999', database({ courseRows: [] })), null)
})

test('returns null for an inactive course because the query requires active status', async () => {
  const inactiveDb = database({ courseRows: [] })
  assert.equal(await getSchoolsForCourse('CRS062', inactiveDb), null)
  assert.match(inactiveDb.calls[0].sql, /is_active = 1/)
})

test('requests only active schools', async () => {
  const db = database()
  await getSchoolsForCourse('CRS062', db)
  assert.match(db.calls[1].sql, /s\.is_active = 1/)
})

test('groups multiple majors into one school result', async () => {
  const result = await getSchoolsForCourse('CRS062', database({
    offeringRows: [schoolOffering(null), schoolOffering('Cyber Security'), schoolOffering('Software Engineering')],
  }))
  assert.equal(result.schools.length, 1)
  assert.deepEqual(result.schools[0].offerings, [
    { major: null },
    { major: 'Cyber Security' },
    { major: 'Software Engineering' },
  ])
  assert.equal(result.schools[0].latitude, 14.81028)
  assert.equal(result.schools[0].longitude, 121.06149)
})

test('deduplicates equivalent majors without merging distinct schools', async () => {
  const result = await getSchoolsForCourse('CRS062', database({
    offeringRows: [
      schoolOffering('Cyber Security'),
      schoolOffering(' cyber security '),
      schoolOffering(null, { school_id: 11, uii: '13228', school_name: 'STI College - San Jose del Monte' }),
    ],
  }))
  assert.equal(result.schools.length, 2)
  assert.equal(result.schools[0].offerings.length, 1)
})

test('normalizes CRS code case and resolves by course_code before internal course_id', async () => {
  const db = database()
  await getSchoolsForCourse(' crs062 ', db)
  assert.deepEqual(db.calls[0].params, ['CRS062'])
  assert.deepEqual(db.calls[1].params, [62])
})

test('propagates database failures for the route to handle safely', async () => {
  await assert.rejects(
    getSchoolsForCourse('CRS062', database({ error: new Error('database unavailable') })),
    /database unavailable/
  )
})
