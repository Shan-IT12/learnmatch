import test from 'node:test'
import assert from 'node:assert/strict'
import { getCalendarTerms, resolveCalendarTerm } from './academicCalendars.js'

test('College Setup calendar choices use stable dependent term codes', () => {
  assert.deepEqual(getCalendarTerms('semester').map(({ code }) => code), ['SEM_1', 'SEM_2'])
  assert.deepEqual(getCalendarTerms('trimester').map(({ code }) => code), ['TRI_1', 'TRI_2', 'TRI_3'])
  assert.equal(getCalendarTerms('quarter').length, 0)
})

test('legacy Summer/Midyear records still resolve without becoming active choices', () => {
  assert.equal(resolveCalendarTerm({ calendarType: 'semester', termCode: 'SUMMER_MIDYEAR' }).label, 'Summer/Midyear')
  assert.equal(resolveCalendarTerm({ calendarType: 'trimester', termCode: 'SUMMER_MIDYEAR' }).label, 'Summer/Midyear')
})

test('existing semester API records resolve to calendar metadata', () => {
  assert.deepEqual(resolveCalendarTerm({ semester: '2nd Semester' }), {
    calendarType: 'semester', termCode: 'SEM_2', label: '2nd Semester',
  })
})
