import fs from 'fs'
import path from 'path'
import { parse } from 'csv-parse/sync'

const root = path.resolve(import.meta.dirname, '../..')
const rows = parse(fs.readFileSync(path.join(root, 'sjdm_bulacan_courses.csv'), 'utf8').replace(/^\uFEFF/, ''), { columns: true, skip_empty_lines: true, trim: true })
const canonical = JSON.parse(fs.readFileSync(path.join(root, 'learnmatch_courses_final_342_with_ids.json'), 'utf8')).courses
const byCode = new Map(canonical.map(c => [c.course_id, c]))
const byRawName = new Map(canonical.map(c => [c.course_name, c]))

const normalized = value => String(value || '').toLowerCase().replace(/\([^)]*\)/g, ' ').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim()
const byNormalizedName = new Map()
for (const course of canonical) {
  const key = normalized(course.course_name)
  byNormalizedName.set(key, [...(byNormalizedName.get(key) || []), course])
}

// Only equivalences that are defensible without inventing a new degree are listed.
const aliases = new Map(Object.entries({
  'Bachelor in Human Services': 'CRS054',
  'Bachelor of Arts in Psychology': 'CRS095',
  'Bachelor of Arts in Pyschology': 'CRS095',
  'Bachelor of Arts major in Communication': 'CRS023',
  'Bachelor of Arts major in Political Science': 'CRS093',
  'Bachelor of Elementary Education': 'CRS036',
  'Bachelor of Elementary Education major in General Education': 'CRS207',
  'Bachelor of Elementary Education major in Preschool Education': 'CRS141',
  'Bachelor of Elementary Education major in Pre-School Education': 'CRS141',
  'Bachelor of Hospitality Management': 'CRS053',
  'Bachelor of Physical Education': 'CRS090',
  'Bachelor of Public Administration': 'CRS096',
  'Bachelor of Science in Accounting Information System': 'CRS114',
  'Bachelor of Science in Accounting and Information System': 'CRS114',
  'Bachelor of Science in Computer Science': 'CRS026',
  'Bachelor of Science in Customs Administration': 'CRS028',
  'Bachelor of Science in Early Childhood Education': 'CRS029',
  'Bachelor of Science in Industrical Security Management': 'CRS103',
  'Bachelor of Science in Information System': 'CRS228',
  'Bachelor of Science in Information Systems': 'CRS229',
  'Bachelor of Science in Internal Audit': 'CRS064',
  'Bachelor of Science in Management Accounting': 'CRS001',
  'Bachelor of Science in Medical Technology': 'CRS076',
  'Bachelor of Science in Midwifery': 'CRS080',
  'Bachelor of Science in Nursing': 'CRS083',
  'Bachelor of Science in Office Management': 'CRS086',
  'Bachelor of Science in Pharmacy': 'CRS088',
  'Bachelor of Science in Psychology': 'CRS094',
  'Bachelor of Science in Radiologic Technology': 'CRS098',
  'Bachelor of Science in Social Work': 'CRS105',
  'Bachelor of Technical Vocational Teacher Education major in Food and Service Management': 'CRS111',
  'Bachelor of Technical-Vocational Teacher Education major in Food Service Management': 'CRS111'
}))

function classify(row) {
  for (const value of [row.Full_Program_Name, row.Program_Name]) {
    if (byRawName.has(value)) return { course: byRawName.get(value), classification: row.Major ? 'MAJOR_OR_SPECIALIZATION' : 'EXACT', confidence: 'High', rationale: `Exact canonical name match using ${value === row.Full_Program_Name ? 'Full_Program_Name' : 'Program_Name'}.` }
  }
  for (const value of [row.Full_Program_Name, row.Program_Name]) {
    const matches = byNormalizedName.get(normalized(value)) || []
    if (matches.length === 1) return { course: matches[0], classification: row.Major ? 'MAJOR_OR_SPECIALIZATION' : 'NORMALIZED', confidence: 'High', rationale: 'Same canonical program after punctuation/parenthetical normalization.' }
  }
  const aliasCode = aliases.get(row.Full_Program_Name) || aliases.get(row.Program_Name)
  if (aliasCode) return { course: byCode.get(aliasCode), classification: row.Major ? 'MAJOR_OR_SPECIALIZATION' : 'NORMALIZED', confidence: 'High', rationale: 'Degree title is a clear spelling, degree-prefix, singular/plural, or standard abbreviation variant of the canonical program.' }

  const text = `${row.Full_Program_Name} ${row.Program_Name}`
  const ambiguous = /Business Administration|Secondary Education|Industrial Technology|Physical Education major|Technical Vocational|Technology and Livelihood|Bachelor of Arts$|Religious Studies|Data Science|Retail Technology|General Engineering/.test(text)
  return { course: null, classification: ambiguous ? 'AMBIGUOUS' : 'UNMATCHED', confidence: 'Low', rationale: ambiguous ? 'The canonical catalog contains multiple related specializations or no exact parent degree; equivalence requires academic review.' : 'No defensible equivalent exists in the canonical 342-course catalog.' }
}

const mapping = rows.map((row, index) => {
  const result = classify(row)
  return {
    source_row_number: index + 2,
    source_school_uii: row.UII,
    source_school_name: row.HEI_Name,
    source_full_program_name: row.Full_Program_Name,
    source_program_name: row.Program_Name,
    source_major: row.Major || null,
    source_detailed_name: row.Detailed_Name || null,
    source_psced_discipline_group: row.F2017PSCED_Discipline_Group || null,
    proposed_canonical_course_code: result.course?.course_id || null,
    proposed_canonical_course_name: result.course?.course_name || null,
    mapping_classification: result.classification,
    mapping_confidence: result.confidence,
    mapping_rationale: result.rationale,
    offering_evidence: { source: 'Repository CSV only; original provenance not conclusively verified', file: 'server/data/sjdm_bulacan_courses.csv' },
    academic_reference_year: row.AY || null
  }
})

const duplicates = new Map()
for (const item of mapping) {
  const key = [item.source_school_uii, item.source_full_program_name, item.source_major || ''].join('|')
  duplicates.set(key, [...(duplicates.get(key) || []), item.source_row_number])
}
const duplicateSourceOfferings = [...duplicates.entries()].filter(([, indexes]) => indexes.length > 1).map(([key, source_rows]) => ({ key, source_rows }))
const proposedDuplicates = new Map()
for (const item of mapping.filter(x => x.proposed_canonical_course_code)) {
  const key = [item.source_school_uii, item.proposed_canonical_course_code, item.source_major || ''].join('|')
  proposedDuplicates.set(key, [...(proposedDuplicates.get(key) || []), item.source_row_number])
}

const classifications = Object.fromEntries(['EXACT','NORMALIZED','MAJOR_OR_SPECIALIZATION','AMBIGUOUS','UNMATCHED'].map(k => [k, mapping.filter(x => x.mapping_classification === k).length]))
const confidence = Object.fromEntries(['High','Medium','Low'].map(k => [k, mapping.filter(x => x.mapping_confidence === k).length]))
const mappedCodes = new Set(mapping.flatMap(x => x.proposed_canonical_course_code ? [x.proposed_canonical_course_code] : []))
const summary = {
  generated_on: '2026-09-21', review_only: true, source_rows: mapping.length,
  classifications, confidence,
  unique_canonical_courses_mapped: mappedCodes.size,
  canonical_courses_with_no_proposed_sjdm_school: canonical.length - mappedCodes.size,
  schools_covered: new Set(mapping.map(x => x.source_school_uii)).size,
  schools_with_at_least_one_high_confidence_mapping: new Set(mapping.filter(x => x.mapping_confidence === 'High').map(x => x.source_school_uii)).size,
  rows_needing_manual_review: mapping.filter(x => ['AMBIGUOUS','UNMATCHED'].includes(x.mapping_classification)).length,
  duplicate_source_offerings: duplicateSourceOfferings,
  duplicate_proposed_school_course_major_combinations: [...proposedDuplicates.entries()].filter(([, indexes]) => indexes.length > 1).map(([key, source_rows]) => ({ key, source_rows })),
  integrity: {
    exactly_223_rows: mapping.length === 223,
    all_codes_canonical: mapping.every(x => !x.proposed_canonical_course_code || byCode.has(x.proposed_canonical_course_code)),
    all_names_exact: mapping.every(x => !x.proposed_canonical_course_code || byCode.get(x.proposed_canonical_course_code).course_name === x.proposed_canonical_course_name),
    all_13_schools_accounted_for: new Set(mapping.map(x => x.source_school_uii)).size === 13,
    majors_preserved: mapping.every((x, i) => x.source_major === (rows[i].Major || null))
  }
}

fs.writeFileSync(path.join(import.meta.dirname, 'school_locator_course_mapping_review.json'), JSON.stringify({ metadata: { review_only: true, source_file: 'server/data/sjdm_bulacan_courses.csv', canonical_file: 'server/data/learnmatch_courses_final_342_with_ids.json', generated_on: '2026-09-21' }, rows: mapping }, null, 2) + '\n')
fs.writeFileSync(path.join(import.meta.dirname, 'school_locator_mapping_summary.json'), JSON.stringify(summary, null, 2) + '\n')
console.log(JSON.stringify(summary, null, 2))
