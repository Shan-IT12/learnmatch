import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'fs'

import {
  COURSE_IDENTITY_METADATA,
  getCourseIdentityRecord,
  isCurrentIndependentCourse,
  resolveCanonicalCourseIds,
} from '../services/courseIdentityService.js'

test('course identity registry preserves approved catalog counts', () => {
  assert.deepEqual(COURSE_IDENTITY_METADATA, {
    stored_records: 360,
    active_independent_programs: 304,
    deprecated_non_independent: 54,
    quarantined: 2,
  })
})

test('single-target aliases resolve to their approved canonical IDs', () => {
  assert.equal(getCourseIdentityRecord('CRS020').status, 'confirmed_duplicate')
  assert.deepEqual(resolveCanonicalCourseIds('CRS020'), ['CRS021'])
  assert.deepEqual(resolveCanonicalCourseIds('CRS304'), ['CRS302'])
})

test('CRS249 retains its approved one-to-many successor relationship', () => {
  assert.deepEqual(resolveCanonicalCourseIds('CRS249'), ['CRS072', 'CRS244'])
})

test('quarantined courses have no redirect and active courses resolve to themselves', () => {
  assert.equal(isCurrentIndependentCourse('CRS166'), false)
  assert.deepEqual(resolveCanonicalCourseIds('CRS166'), [])
  assert.equal(isCurrentIndependentCourse('CRS343'), true)
  assert.deepEqual(resolveCanonicalCourseIds('CRS343'), ['CRS343'])
})

test('approved school mappings use current identities without duplicate school/course/major keys', () => {
  const manifest = JSON.parse(fs.readFileSync(
    new URL('../data/review/school_locator/school_locator_import_manifest_review.json', import.meta.url),
    'utf8'
  ))
  const identities = manifest.mappings.map((mapping) => [
    mapping.source_uii,
    mapping.canonical_course_code,
    String(mapping.major || '').trim().toLowerCase(),
  ].join('|'))

  assert.ok(manifest.mappings.every((mapping) => (
    isCurrentIndependentCourse(mapping.canonical_course_code)
  )))
  assert.equal(new Set(identities).size, identities.length)
})
