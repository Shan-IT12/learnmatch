import test from 'node:test'
import assert from 'node:assert/strict'

import {
  cameFromCareerPathChooser,
  careerPathChooserSearch,
  careerPathDetailSearch,
  getCareerPathReturnDestination,
} from './careerPathNavigation.js'

test('summary source remains stable in the URL across refreshes', () => {
  assert.deepEqual(getCareerPathReturnDestination('?returnTo=summary', false), {
    path: '/dashboard/summary',
    label: 'Back to Summary Dashboard',
    key: 'summary',
  })
  assert.equal(careerPathDetailSearch('?returnTo=summary'), '?returnTo=summary&via=chooser')
  assert.equal(cameFromCareerPathChooser('?returnTo=summary&via=chooser'), true)
  assert.equal(careerPathChooserSearch('?returnTo=summary&via=chooser'), '?returnTo=summary')
})

test('results is the safe fallback for direct or unknown navigation', () => {
  assert.equal(getCareerPathReturnDestination('', false).path, '/results')
  assert.equal(getCareerPathReturnDestination('?returnTo=/admin', false).path, '/results')
})

test('active College Phase always preserves the Results return flow', () => {
  assert.deepEqual(getCareerPathReturnDestination('?returnTo=summary', true), {
    path: '/results',
    label: 'Back to Results',
    key: 'results',
  })
})
