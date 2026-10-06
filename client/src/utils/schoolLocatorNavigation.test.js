import test from 'node:test'
import assert from 'node:assert/strict'

import { getSchoolLocatorBackNavigation } from './schoolLocatorNavigation.js'

test('recommendation source returns to Results', () => {
  assert.deepEqual(getSchoolLocatorBackNavigation('results'), {
    path: '/results',
    label: 'Back to Results',
  })
})

test('an explicit Dashboard explorer source returns to Dashboard', () => {
  assert.deepEqual(getSchoolLocatorBackNavigation('explorer'), {
    path: '/dashboard',
    label: 'Back to Dashboard',
  })
})

test('public search returns to Course Search', () => {
  assert.deepEqual(getSchoolLocatorBackNavigation('public-search'), {
    path: '/courses/search',
    label: 'Back to Course Search',
  })
})

test('Course Overview source returns to the exact course and preserves its origin state', () => {
  const returnState = {
    entryContext: 'public-search',
    returnTo: '/courses/search?q=BSIT',
  }
  assert.deepEqual(getSchoolLocatorBackNavigation({
    name: 'course-overview',
    returnTo: '/courses/CRS024',
    returnState,
  }), {
    path: '/courses/CRS024',
    label: 'Back to Course Overview',
    state: returnState,
  })
})

test('an invalid Course Overview return path uses the existing safe fallback', () => {
  assert.equal(getSchoolLocatorBackNavigation({
    name: 'course-overview',
    returnTo: '/dashboard',
  }).path, '/courses/search')
})

test('unknown origins use a safe public Course Search fallback', () => {
  assert.equal(getSchoolLocatorBackNavigation(undefined).path, '/courses/search')
})

test('a results-backed Course Overview remains results-backed when restored', () => {
  const navigation = getSchoolLocatorBackNavigation({
    name: 'course-overview',
    returnTo: '/courses/CRS024?source=results',
    returnState: { entryContext: 'results' },
  })
  assert.equal(navigation.path, '/courses/CRS024?source=results')
  assert.equal(navigation.state.entryContext, 'results')
})
