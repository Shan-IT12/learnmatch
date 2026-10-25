import test from 'node:test'
import assert from 'node:assert/strict'
import { getSchoolsForCourse } from '../services/schoolLocatorService.js'
import evidence from '../data/schoolLocatorVerifiedOfferings.json' with { type: 'json' }
import catalog from '../data/learnmatch_courses_final_342_with_ids.json' with { type: 'json' }
import { resolveCanonicalCourseIds } from '../services/courseIdentityService.js'

const calls = []
function database(code = 'CRS062', missing = false) {
  return { async query(sql, params) {
    calls.push({ sql, params })
    if (sql.includes('FROM COURSE')) return [missing ? [] : [{ course_id: 999, course_code: code, course_name: 'Test course' }]]
    assert.match(sql, /FROM SCHOOL WHERE is_active = 1/)
    return [evidence.schools.filter(s => params[0].includes(s.uii)).map((s, i) => ({ ...s, school_id: i + 1 }))]
  } }
}

test('audits all 13 institutions and all mapped course identities', () => {
  assert.equal(evidence.schools.length, 13)
  assert.equal(new Set(evidence.schools.map(s => s.uii)).size, 13)
  const codes = new Set(catalog.courses.map(c => c.course_id))
  for (const school of evidence.schools) {
    assert.ok(school.programs.length)
    for (const p of school.programs) for (const code of p.course_codes) {
      assert.equal(p.status, 'ACTIVE')
      assert.ok(codes.has(code), code)
      assert.deepEqual(resolveCanonicalCourseIds(code), [code], code)
    }
  }
})

for (const school of evidence.schools) test(`${school.uii}: verified offerings and destination accuracy`, async () => {
  const codes = new Set(school.programs.flatMap(p => p.course_codes))
  assert.ok(codes.size)
  for (const code of codes) {
    const result = await getSchoolsForCourse(code, database(code))
    const found = result.schools.find(s => s.uii === school.uii)
    assert.ok(found, code)
    assert.equal(found.latitude, school.latitude)
    assert.equal(found.longitude, school.longitude)
    assert.equal(found.school_name, school.school_name)
    assert.ok(found.offerings.every(p => p.source_url.startsWith('https://')))
    assert.equal(found.verified_on, '2026-10-26')
  }
})

test('new accountancy maps to standalone Accountancy, never the combined economics degree', async () => {
  assert.ok((await getSchoolsForCourse('CRS343', database('CRS343'))).schools.length >= 4)
  assert.deepEqual((await getSchoolsForCourse('CRS232', database('CRS232'))).schools, [])
})
test('phased-out Psychology and former Accounting Technology are excluded', async () => {
  assert.equal((await getSchoolsForCourse('CRS094', database('CRS094'))).schools.some(s => s.uii === '03196'), false)
  assert.deepEqual((await getSchoolsForCourse('CRS002', database('CRS002'))).schools, [])
  assert.ok((await getSchoolsForCourse('CRS114', database('CRS114'))).schools.some(s => s.uii === '03196'))
})
test('STI pending Psychology excluded; verified courses and Operations major included', async () => {
  assert.equal((await getSchoolsForCourse('CRS095', database('CRS095'))).schools.some(s => s.uii === '13228'), false)
  for (const code of ['CRS024', 'CRS026', 'CRS062', 'CRS113', 'CRS023', 'CRS345']) assert.ok((await getSchoolsForCourse(code, database(code))).schools.some(s => s.uii === '13228'))
})
test('Bestlink uses the independently reviewed Bulacan campus destination', async () => {
  const school = (await getSchoolsForCourse('CRS113', database('CRS113'))).schools.find(s => s.uii === '03279')
  assert.equal(school.latitude, 14.84686)
  assert.equal(school.longitude, 121.08018)
  assert.equal(school.address, 'IPO Road, Barangay Minuyan Proper, City of San Jose del Monte, Bulacan')
  assert.equal(school.coordinate_source_url, 'https://mapcarta.com/W1544355825')
  assert.equal(school.location_note, null)
})

test('all 13 reviewed schools have usable destination coordinates and evidence', () => {
  for (const school of evidence.schools) {
    assert.ok(Number.isFinite(school.latitude), school.uii)
    assert.ok(Number.isFinite(school.longitude), school.uii)
    assert.ok(school.latitude > 14.7 && school.latitude < 14.9, school.uii)
    assert.ok(school.longitude > 121 && school.longitude < 121.2, school.uii)
    assert.ok(school.coordinate_source_url.startsWith('https://'), school.uii)
  }
})
test('no verified offering returns an empty list and no school query', async () => {
  calls.length = 0
  assert.deepEqual((await getSchoolsForCourse('CRS348', database('CRS348'))).schools, [])
  assert.equal(calls.length, 1)
})
test('invalid, inactive and quarantined courses remain hidden; aliases resolve', async () => {
  assert.equal(await getSchoolsForCourse('invalid', database()), null)
  assert.equal(await getSchoolsForCourse('CRS166', database()), null)
  assert.equal(await getSchoolsForCourse('CRS062', database('CRS062', true)), null)
  calls.length = 0
  assert.equal((await getSchoolsForCourse(' crs020 ', database('CRS021'))).course.course_code, 'CRS021')
  assert.deepEqual(calls[0].params, ['CRS021'])
})
