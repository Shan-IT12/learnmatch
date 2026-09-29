import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { ACADEMIC_CALENDARS, resolveCalendarTerm } from '../services/academicCalendar.js'
import { calculateNextAcademicStage } from '../services/collegeTrackingService.js'

test('calendar registry exposes only the supported semester and trimester terms', () => {
  assert.deepEqual(Object.keys(ACADEMIC_CALENDARS), ['semester', 'trimester'])
  assert.deepEqual(ACADEMIC_CALENDARS.semester.terms.map(({ code }) => code), ['SEM_1', 'SEM_2', 'SUMMER_MIDYEAR'])
  assert.deepEqual(ACADEMIC_CALENDARS.trimester.terms.map(({ code }) => code), ['TRI_1', 'TRI_2', 'TRI_3', 'SUMMER_MIDYEAR'])
  assert.equal(ACADEMIC_CALENDARS.semester.terms.at(-1).optional, true)
  assert.equal(ACADEMIC_CALENDARS.trimester.terms.at(-1).optional, true)
})

test('legacy semester labels resolve without treating Third Semester as a trimester', () => {
  assert.deepEqual(resolveCalendarTerm({ semester: '1st Semester' }), {
    calendarType: 'semester', termCode: 'SEM_1', termLabel: '1st Semester', optional: false,
  })
  assert.equal(resolveCalendarTerm({ semester: '3rd Semester' }).calendarType, 'legacy')
  assert.equal(resolveCalendarTerm({ calendarType: 'semester', termCode: 'TRI_1' }), null)
})

test('semester progression supports optional Summer/Midyear without creating it automatically', () => {
  assert.equal(calculateNextAcademicStage('2nd Year', '2nd Semester', 4).termCode, 'SEM_1')
  assert.deepEqual(
    calculateNextAcademicStage('2nd Year', '2nd Semester', 4, 'semester', 'SEM_2', { startOptionalTerm: true }),
    { programCompleted: false, yearLevel: '2nd Year', semester: 'Summer/Midyear', calendarType: 'semester', termCode: 'SUMMER_MIDYEAR' }
  )
  assert.equal(calculateNextAcademicStage('2nd Year', 'Summer/Midyear', 4).termCode, 'SEM_1')
})

test('trimester progression advances through all three terms and then the year level', () => {
  assert.equal(calculateNextAcademicStage('1st Year', '1st Trimester', 4, 'trimester', 'TRI_1').termCode, 'TRI_2')
  assert.equal(calculateNextAcademicStage('1st Year', '2nd Trimester', 4, 'trimester', 'TRI_2').termCode, 'TRI_3')
  const nextYear = calculateNextAcademicStage('1st Year', '3rd Trimester', 4, 'trimester', 'TRI_3')
  assert.deepEqual(nextYear, { programCompleted: false, yearLevel: '2nd Year', semester: '1st Trimester', calendarType: 'trimester', termCode: 'TRI_1' })
  assert.equal(
    calculateNextAcademicStage('1st Year', '3rd Trimester', 4, 'trimester', 'TRI_3', { startOptionalTerm: true }).termCode,
    'SUMMER_MIDYEAR'
  )
})

test('final program completion respects each calendar final regular term', () => {
  assert.equal(calculateNextAcademicStage('4th Year', '2nd Semester', 4, 'semester', 'SEM_2').programCompleted, true)
  assert.equal(calculateNextAcademicStage('4th Year', 'Summer/Midyear', 4, 'semester', 'SUMMER_MIDYEAR').programCompleted, true)
  assert.equal(calculateNextAcademicStage('4th Year', '3rd Trimester', 4, 'trimester', 'TRI_3').programCompleted, true)
  assert.equal(calculateNextAcademicStage('4th Year', '2nd Trimester', 4, 'trimester', 'TRI_2').programCompleted, false)
})

test('migration backfills standard terms and preserves ambiguous Third Semester', () => {
  const sql = fs.readFileSync(new URL('../migrations/20260929_generalize_college_terms.sql', import.meta.url), 'utf8')
  assert.match(sql, /term_code = 'SEM_1'[\s\S]*semester = '1st Semester'/)
  assert.match(sql, /term_code = 'SEM_2'[\s\S]*semester = '2nd Semester'/)
  assert.match(sql, /term_code = 'SUMMER_MIDYEAR'[\s\S]*semester IN \('Summer', 'Summer\/Midyear'\)/)
  assert.match(sql, /term_code = 'LEGACY_3RD_SEMESTER'[\s\S]*semester = '3rd Semester'/)
  assert.doesNotMatch(sql, /semester = '3rd Semester'[\s\S]{0,120}TRI_3/)
})
