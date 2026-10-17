import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { CATALOG_REFERENCE_FILES, buildCatalogReferenceIndex, getCatalogCourseReferences } from '../services/catalogCourseReferenceService.js'
import { catalogReferenceHref } from '../../shared/catalogReferenceFields.js'
const datasets = CATALOG_REFERENCE_FILES.map(dataset => ({ ...dataset, ...JSON.parse(fs.readFileSync(new URL(`../data/${dataset.file}`, import.meta.url), 'utf8')) }))

const historicalIndex = buildCatalogReferenceIndex(datasets)
const historical = code => structuredClone(historicalIndex.get(code))

test('all 360 exact catalog codes retain attributable references with a three-reference display cap', () => {
  const missingLinks = [], capped = []
  for (const course of datasets[0].courses) {
    const result = historical(course.course_id)
    assert.equal(result.course_code, course.course_id)
    assert.equal(result.recorded_course_name, course.course_name)
    assert.ok(result.references.length >= 1 && result.references.length <= 3)
    assert.equal(result.references.length + result.omitted_count, result.total_references)
    if (!result.linked_reference_count) missingLinks.push(course.course_id)
    if (result.omitted_count) capped.push(course.course_id)
    for (const reference of result.references) {
      assert.ok(reference.records.length)
      for (const provenance of reference.records) {
        const dataset = datasets.find(row => row.file === provenance.file)
        const [_, courseIndex, sourceIndex] = /^courses\[(\d+)\]\.sources\[(\d+)\]$/.exec(provenance.path)
        const originalCourse = dataset.courses[Number(courseIndex)]
        const original = originalCourse.sources[Number(sourceIndex)]
        assert.equal(originalCourse.course_id, course.course_id)
        assert.equal(provenance.title, original.title.trim())
        assert.equal(provenance.used_for, original.used_for)
        assert.equal(catalogReferenceHref(reference.url), catalogReferenceHref(original.url))
      }
      assert.equal(Object.hasOwn(reference, 'reviewer_id'), false)
      assert.equal(Object.hasOwn(reference, 'current_review'), false)
    }
  }
  assert.equal(datasets[0].courses.length, 360)
  assert.equal(missingLinks.length, 38)
  assert.deepEqual(capped, ['CRS243', 'CRS244', 'CRS246', 'CRS248'])
})

test('Agricultural Technology uses its recorded CMO; missing URLs and new codes are never guessed', () => {
  const source = getCatalogCourseReferences('CRS121').references.find(row => !row.reference_update)
  assert.equal(source.title, 'CMO No. 34, series of 1996')
  assert.match(source.url, /CMO-No\.-34-Series-of-1996/)
  assert.equal(source.records.length, 3)
  assert.equal(historical('CRS050').references[0].url, '')
  assert.deepEqual(getCatalogCourseReferences('CRS428').references, [])
  assert.deepEqual(getCatalogCourseReferences(121).references, [])
  const result = getCatalogCourseReferences('CRS121')
  result.references[0].records[0].used_for = 'Changed by caller'
  assert.notEqual(getCatalogCourseReferences('CRS121').references[0].records[0].used_for, 'Changed by caller')
})

test('merge preserves different recorded purposes, prioritizes usable URLs, and rejects unsafe links', () => {
  const courses = [{ course_id: 'CRS001', course_name: 'Synthetic', sources: [{ title: 'Title only', url: '', used_for: 'Recorded facts' }, ...[1,2,3,4].map(n => ({ title: `Reference ${n}`, url: `https://example.org/${n}`, used_for: 'Recorded description' }))] }]
  const index = buildCatalogReferenceIndex([{ file: 'one.json', label: 'One', courses }, { file: 'two.json', label: 'Two', courses: [{ ...courses[0], sources: [{ title: 'Alternate title', url: 'https://example.org/1', used_for: 'Recorded skills' }] }] }])
  const result = index.get('CRS001')
  assert.equal(result.total_references, 5)
  assert.equal(result.omitted_count, 2)
  assert.equal(result.references[0].records.length, 2)
  assert.deepEqual(result.references.map(row => row.url), [1,2,3].map(n => `https://example.org/${n}`))
  for (const value of ['javascript:alert(1)', 'data:text/html,x', 'https://user:secret@example.org', 'https://example.org:444/a', 'https://example.org/a b', 'https:\\evil.example', '//example.org']) assert.equal(catalogReferenceHref(value), null)
  assert.equal(catalogReferenceHref('https://example.org/reference.pdf'), 'https://example.org/reference.pdf')
})


test('official reference refresh prioritizes explicitly scoped mappings without changing historical provenance or weights', () => {
  const updates = JSON.parse(fs.readFileSync(new URL('../data/learnmatch_catalog_reference_updates.json', import.meta.url), 'utf8'))
  const seen = new Set()
  for (const course of datasets[0].courses) {
    const result = getCatalogCourseReferences(course.course_id)
    assert.ok(result.references.length >= 1 && result.references.length <= 3)
    assert.equal(result.references.length + result.omitted_count, result.total_references)
    for (const source of result.references.filter(row => row.reference_update)) {
      seen.add(course.course_id)
      const mapping = updates.references.find(row => row.id === source.reference_update.id)
      assert.ok(mapping.course_codes.includes(course.course_id))
      assert.equal(source.reference_update.checked_on, '2026-10-18')
      assert.ok(source.reference_update.scope_note)
      assert.ok(source.reference_update.check_method)
      assert.equal(Object.hasOwn(source, 'current_review'), false)
      assert.equal(Object.hasOwn(source.reference_update, 'reviewer_id'), false)
    }
  }
  assert.equal(seen.size, 82)
  const manufacturing = getCatalogCourseReferences('CRS070').references[0]
  assert.equal(manufacturing.reference_update.id, 'manufacturing-2025')
  assert.match(manufacturing.reference_update.scope_note, /HTTP 403/)
  assert.ok(!getCatalogCourseReferences('CRS242').references.some(row => row.reference_update?.id === 'manufacturing-2025'))
  const bet = getCatalogCourseReferences('CRS243').references[0]
  assert.equal(bet.reference_update.id, 'bet-2025')
  assert.equal(bet.reference_update.scope, 'parent_framework')
  assert.match(bet.reference_update.scope_note, /does not independently establish/)
  const bat = getCatalogCourseReferences('CRS121')
  assert.equal(bat.references[0].reference_update.scope, 'transition')
  assert.match(bat.references[0].reference_update.scope_note, /does not establish.*same program/)
  assert.ok(bat.references.some(row => row.reference_update?.scope === 'related_only'))
  assert.ok(bat.references.some(row => row.title === 'CMO No. 34, series of 1996'))
  assert.equal(getCatalogCourseReferences('CRS001').recency_review.status, 'latest_applicability_not_confirmed')
  assert.ok(getCatalogCourseReferences('CRS072').references.some(row => row.reference_update?.id === 'maritime-2023'))
  assert.ok(!getCatalogCourseReferences('CRS082').references.some(row => row.reference_update?.id === 'maritime-2023'))
})
