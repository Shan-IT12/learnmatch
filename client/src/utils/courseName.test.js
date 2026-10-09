import test from 'node:test'
import assert from 'node:assert/strict'
import { formatCourseNameSingleLine, getDisplayCourseAbbreviation, parseCourseName } from './courseName.js'

test('splits Major in while preserving official wording', () => {
  assert.deepEqual(parseCourseName('Bachelor of Science in Information Technology Major in Network Technology'), {
    baseName: 'Bachelor of Science in Information Technology',
    specialization: 'Major in Network Technology',
  })
})

test('supports specialization markers', () => {
  assert.equal(parseCourseName('Bachelor of Arts Specialization in Communication').specialization, 'Specialization in Communication')
  assert.equal(parseCourseName('Bachelor of Arts Specialization: Communication').specialization, 'Specialization: Communication')
})

test('supports track markers', () => {
  assert.equal(parseCourseName('Bachelor of Education Track: Early Childhood').specialization, 'Track: Early Childhood')
  assert.equal(parseCourseName('Bachelor of Education Track in Early Childhood').specialization, 'Track in Early Childhood')
})

test('supports concentration markers', () => {
  assert.equal(parseCourseName('Bachelor of Science Concentration in Analytics').specialization, 'Concentration in Analytics')
})

test('supports option markers', () => {
  assert.equal(parseCourseName('Bachelor of Science Option in Applied Mathematics').specialization, 'Option in Applied Mathematics')
  assert.equal(parseCourseName('Bachelor of Science Option: Applied Mathematics').specialization, 'Option: Applied Mathematics')
})

test('leaves a course without an explicit marker unchanged', () => {
  const name = 'Bachelor of Science in Information Technology'
  assert.deepEqual(parseCourseName(name), { baseName: name, specialization: '' })
})

test('handles long titles without truncating either display segment', () => {
  const name = 'Bachelor of Science in Hospitality and International Tourism Management Major in Sustainable Destination Development and Operations'
  assert.deepEqual(parseCourseName(name), {
    baseName: 'Bachelor of Science in Hospitality and International Tourism Management',
    specialization: 'Major in Sustainable Destination Development and Operations',
  })
})

test('does not modify the canonical source value', () => {
  const canonical = 'Bachelor of Science in Business Administration Major in Marketing Management'
  const original = canonical
  parseCourseName(canonical)
  assert.equal(canonical, original)
  assert.equal(formatCourseNameSingleLine(canonical, 'BSBA'), `${canonical} (BSBA-MM)`)
})

test('creates major-aware BSBA display abbreviations', () => {
  assert.equal(getDisplayCourseAbbreviation('Bachelor of Science in Business Administration Major in Financial Management', 'BSBA'), 'BSBA-FM')
  assert.equal(getDisplayCourseAbbreviation('Bachelor of Science in Business Administration Major in Human Resource Development Management', 'BSBA'), 'BSBA-HRDM')
  assert.equal(getDisplayCourseAbbreviation('Bachelor of Science in Business Administration Major in Marketing Management', 'BSBA'), 'BSBA-MM')
  assert.equal(getDisplayCourseAbbreviation('Bachelor of Science in Business Administration Major in Operations Management', 'BSBA'), 'BSBA-OM')
})

test('keeps the original abbreviation without a specialization', () => {
  assert.equal(getDisplayCourseAbbreviation('Bachelor of Science in Business Administration', 'BSBA'), 'BSBA')
})

test('normalizes descriptor casing without changing the canonical source', () => {
  const canonical = 'Bachelor of Science in Business Administration major in Financial Management'
  assert.equal(parseCourseName(canonical).specialization, 'Major in Financial Management')
  assert.equal(canonical, 'Bachelor of Science in Business Administration major in Financial Management')
})
