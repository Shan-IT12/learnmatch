import fs from 'node:fs'
import { catalogReferenceHref } from '../../shared/catalogReferenceFields.js'

export const CATALOG_REFERENCE_FILES = [
  { file: 'learnmatch_courses_final_342_with_ids.json', label: 'Course catalog' },
  { file: 'learnmatch_course_matching_profiles_final_342_with_ids.json', label: 'Matching-profile catalog' },
  { file: 'learnmatch_342_year_levels_and_careers_final.json', label: 'Year-level and career catalog' },
]

export function buildCatalogReferenceIndex(datasets, updates = null) {
  const index = new Map()
  for (const { file, label, courses } of datasets) {
    const ids = new Set()
    courses.forEach((course, rowIndex) => {
      if (ids.has(course.course_id)) throw new Error(`Duplicate catalog reference identity in ${file}`)
      ids.add(course.course_id)
      if (!index.has(course.course_id)) index.set(course.course_id, { course_code: course.course_id, recorded_course_name: course.course_name, references: [] })
      const entry = index.get(course.course_id)
      for (const [sourceIndex, source] of (course.sources || []).entries()) {
        const url = typeof source.url === 'string' ? source.url.trim() : ''
        const title = typeof source.title === 'string' ? source.title.trim() : ''
        // Blank URLs are title-only references, never inferred links.
        const key = url ? `url:${catalogReferenceHref(url) || url}` : `title:${title}`
        let reference = entry.references.find(row => row.key === key)
        if (!reference) { reference = { key, title, url, records: [] }; entry.references.push(reference) }
        reference.records.push({ dataset: label, file, path: `courses[${rowIndex}].sources[${sourceIndex}]`, title, used_for: typeof source.used_for === 'string' ? source.used_for : '' })
      }
    })
  }
  if (updates) for (const [updateIndex, update] of updates.references.entries()) {
    if (!catalogReferenceHref(update.url)) throw new Error('Unsafe researched catalog reference URL')
    for (const code of update.course_codes) {
      const entry = index.get(code)
      if (!entry) throw new Error(`Unknown stable code in catalog reference updates: ${code}`)
      const key = `url:${catalogReferenceHref(update.url)}`
      let reference = entry.references.find(row => row.key === key)
      if (!reference) { reference = { key, title: update.title, url: update.url, records: [] }; entry.references.push(reference) }
      reference.reference_update = Object.fromEntries(Object.entries(update).filter(([field]) => field !== 'course_codes'))
      reference.records.push({ dataset: 'Official reference lookup (not admin verification)', file: 'learnmatch_catalog_reference_updates.json', path: `references[${updateIndex}]`, title: update.title, used_for: update.scope_note })
    }
  }
  for (const entry of index.values()) {
    // Explicitly researched program mappings precede historical provenance. Never sort blindly by year.
    const researched = entry.references.filter(row => row.reference_update)
    const historical = entry.references.filter(row => !row.reference_update)
    const all = researched.concat(historical.filter(row => catalogReferenceHref(row.url)), historical.filter(row => !catalogReferenceHref(row.url)))
    entry.recency_review = {
      status: researched.length ? 'official_reference_located' : 'latest_applicability_not_confirmed',
      checked_on: researched.length ? updates.checked_on : null,
      limitations: updates?.limitations || 'Current applicability and later amendments have not been established.',
    }
    entry.total_references = all.length
    entry.linked_reference_count = all.filter(row => catalogReferenceHref(row.url)).length
    entry.missing_url_count = all.length - entry.linked_reference_count
    entry.omitted_count = Math.max(0, all.length - 3)
    entry.references = all.slice(0, 3).map(({ key, ...reference }) => reference)
  }
  return index
}
const updates = JSON.parse(fs.readFileSync(new URL('../data/learnmatch_catalog_reference_updates.json', import.meta.url), 'utf8'))
const index = buildCatalogReferenceIndex(CATALOG_REFERENCE_FILES.map(dataset => ({ ...dataset, ...JSON.parse(fs.readFileSync(new URL(`../data/${dataset.file}`, import.meta.url), 'utf8')) })), updates)

// Exact stable-code mapping only; no course-name guesses or duplicate/successor inheritance.
export function getCatalogCourseReferences(courseCode) {
  const code = typeof courseCode === 'string' ? courseCode.trim().toUpperCase() : ''
  return structuredClone(index.get(code) || { course_code: code, recorded_course_name: null, references: [], total_references: 0, linked_reference_count: 0, missing_url_count: 0, omitted_count: 0 })
}
