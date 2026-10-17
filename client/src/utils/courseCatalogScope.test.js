import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { archivedCourseIdentity, archivedCourseLabel, matchesCatalogScope, courseCatalogCounts } from './courseCatalogScope.js'
import { courseListLocation, readCourseListLocation } from './courseListNavigation.js'

const registry = JSON.parse(fs.readFileSync(new URL('../../../server/data/learnmatch_course_identity_registry.json', import.meta.url), 'utf8'))
const catalog = JSON.parse(fs.readFileSync(new URL('../../../server/data/learnmatch_courses_final_342_with_ids.json', import.meta.url), 'utf8')).courses
const fixture = () => [...catalog.map((row, i) => ({ course_id: i + 1, course_code: row.course_id, course_name: row.course_name, is_active: 1, is_draft: 0, is_published_new: 0, catalog_identity: registry.records.find(r => r.course_id === row.course_id) || null })), { course_id: 1001, course_code: 'CRS427', is_draft: 1, is_active: 0 }, { course_id: 1002, course_code: 'CRS428', is_draft: 0, is_active: 1, is_published_new: 1 }]

test('current list excludes precisely the 56 registered identities and drafts, retaining published additions and all stored records', () => {
  const rows = fixture(), before = structuredClone(rows)
  assert.deepEqual(courseCatalogCounts(rows), { original: 304, published: 1, drafts: 1, archived: 56 })
  const current = rows.filter(row => matchesCatalogScope(row))
  assert.equal(current.length, 305)
  assert.ok(current.some(row => row.course_code === 'CRS428'))
  assert.ok(!current.some(row => row.course_code === 'CRS427'))
  assert.deepEqual(rows.filter(row => matchesCatalogScope(row, 'archived')).map(row => row.course_code).sort(), registry.records.map(row => row.course_id).sort())
  assert.equal(rows.filter(row => matchesCatalogScope(row, 'all')).length, 362)
  assert.deepEqual(rows.filter(row => matchesCatalogScope(row, 'current', 'draft')).map(row => row.course_code), ['CRS427'])
  assert.deepEqual(rows, before)
})

test('archive reasons preserve the recorded identity and canonical/successor codes; older backend exclusions are recognized', () => {
  const rows = fixture()
  assert.equal(archivedCourseLabel(rows.find(row => row.course_code === 'CRS020')), 'Duplicate - see CRS021')
  assert.equal(archivedCourseLabel(rows.find(row => row.course_code === 'CRS249')), 'Historical title - see CRS072, CRS244')
  assert.equal(archivedCourseLabel(rows.find(row => row.course_code === 'CRS166')), 'Quarantined identity')
  const oldBackend = { recommendation_readiness: { reasons: [{ code: 'INELIGIBLE_COURSE_IDENTITY' }] } }
  assert.ok(archivedCourseIdentity(oldBackend))
  assert.equal(matchesCatalogScope(oldBackend), false)
  assert.equal(archivedCourseIdentity({ recommendation_readiness: { reasons: [{ code: 'MISSING_SKILL_PROFILE' }] } }), null)
})

test('archived scope and filters survive saved-view navigation, back and refresh', () => {
  const filters = { scope: 'archived', search: 'Civil', cluster: 'ENGINEERING / STEM CLUSTER', sort: 'code-asc' }
  const list = courseListLocation(filters)
  const saved = courseListLocation(filters, { courseId: 20 })
  const restored = readCourseListLocation(new URL(saved, 'http://localhost').search)
  assert.equal(restored.scope, 'archived')
  assert.equal(courseListLocation(restored), list)
  assert.equal(readCourseListLocation('?scope=invalid').scope, 'current')
})
