import test from 'node:test'
import assert from 'node:assert/strict'

import { getCourseOverviewBackNavigation } from './courseOverviewNavigation.js'

test('a Landing selection returns Course Overview to Course Search', () => {
  assert.deepEqual(getCourseOverviewBackNavigation({ entryContext: 'landing' }), {
    path: '/courses/search',
    label: 'Back to Course Search',
  })
})

test('Dashboard context survives a Course Overview refresh through the URL', () => {
  assert.deepEqual(getCourseOverviewBackNavigation(undefined, '?source=dashboard'), {
    path: '/courses/search?source=dashboard',
    label: 'Back to Course Search',
    state: { entryContext: 'dashboard' },
  })
})

test('a public Course Search selection preserves its exact search URL', () => {
  assert.deepEqual(getCourseOverviewBackNavigation({
    entryContext: 'public-search',
    returnTo: '/courses/search?q=information%20technology',
  }), {
    path: '/courses/search?q=information%20technology',
    label: 'Back to Course Search',
  })
})

test('a Dashboard search selection preserves Dashboard context', () => {
  assert.deepEqual(getCourseOverviewBackNavigation({
    entryContext: 'dashboard',
    returnTo: '/courses/search?q=BSIT',
  }), {
    path: '/courses/search?q=BSIT',
    label: 'Back to Course Search',
    state: { entryContext: 'dashboard' },
  })
})

test('missing or unsafe route state falls back safely to Course Search', () => {
  assert.deepEqual(getCourseOverviewBackNavigation(undefined), {
    path: '/courses/search',
    label: 'Back to Course Search',
  })
  assert.equal(getCourseOverviewBackNavigation({
    entryContext: 'public-search',
    returnTo: '/dashboard',
  }).path, '/courses/search')
})

test('Results context returns Course Overview to Results and survives refresh', () => {
  assert.deepEqual(getCourseOverviewBackNavigation(undefined, '?source=results'), {
    path: '/results',
    label: 'Back to Results',
  })
  assert.deepEqual(getCourseOverviewBackNavigation({ entryContext: 'results' }), {
    path: '/results',
    label: 'Back to Results',
  })
})

test('an active College Phase always returns Course Overview to Results', () => {
  assert.deepEqual(getCourseOverviewBackNavigation({ entryContext: 'public-search' }, '', true), {
    path: '/results',
    label: 'Back to Results',
  })
})
