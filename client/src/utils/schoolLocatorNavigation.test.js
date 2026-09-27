import test from 'node:test'
import assert from 'node:assert/strict'

import { getSchoolLocatorBackNavigation } from './schoolLocatorNavigation.js'

test('recommendation source returns to Results regardless of authentication inference', () => {
  assert.deepEqual(getSchoolLocatorBackNavigation('results', true), {
    path: '/results',
    label: 'Back to Results',
  })
})

test('logged-in explorer source returns to Dashboard even if recommendations may exist', () => {
  assert.deepEqual(getSchoolLocatorBackNavigation('explorer', true), {
    path: '/dashboard',
    label: 'Back to Dashboard',
  })
})

test('guest public search returns to Course Search', () => {
  assert.deepEqual(getSchoolLocatorBackNavigation('public-search', false), {
    path: '/courses/search',
    label: 'Back to Course Search',
  })
})

test('unknown origins use safe authenticated and guest fallbacks', () => {
  assert.equal(getSchoolLocatorBackNavigation(undefined, true).path, '/dashboard')
  assert.equal(getSchoolLocatorBackNavigation(undefined, false).path, '/courses/search')
})

