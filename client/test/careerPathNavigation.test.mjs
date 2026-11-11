import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cameFromCareerPathChooser, careerPathChooserSearch, careerPathDetailSearch,
  careerPathFromResultsSearch, getCareerPathReturnDestination } from '../src/utils/careerPathNavigation.js'

test('Career Path returns to its entry source regardless of College status', () => {
  for (const collegeStatus of [true, false, null]) {
    assert.equal(getCareerPathReturnDestination('?returnTo=summary', collegeStatus).path, '/dashboard/summary')
    assert.equal(getCareerPathReturnDestination('?returnTo=summary', collegeStatus).label, 'Back to Summary Dashboard')
    assert.equal(getCareerPathReturnDestination('?returnTo=results', collegeStatus).path, '/results')
    assert.equal(getCareerPathReturnDestination('', collegeStatus).label, 'Back to Results')
  }
})

test('chooser, course detail and refresh preserve the Summary origin', () => {
  const detail = careerPathDetailSearch('?returnTo=summary')
  assert.equal(cameFromCareerPathChooser(detail), true)
  assert.equal(careerPathChooserSearch(detail), '?returnTo=summary')
  assert.equal(getCareerPathReturnDestination(careerPathChooserSearch(detail)).path, '/dashboard/summary')
})

test('Results-origin course detail returns to the same saved Results context using only safe destinations', () => {
  const search = careerPathFromResultsSearch('?saved=1&returnTo=summary')
  assert.equal(getCareerPathReturnDestination(search).label, 'Back to Results')
  assert.equal(getCareerPathReturnDestination(search).path, '/results?saved=1&returnTo=summary')
  assert.equal(getCareerPathReturnDestination(careerPathFromResultsSearch('?saved=1')).path, '/results?saved=1')
  assert.equal(getCareerPathReturnDestination(careerPathFromResultsSearch('')).path, '/results')
  assert.equal(getCareerPathReturnDestination('?returnTo=https://example.test&resultsReturnTo=//example.test').path, '/results')
  assert.equal(getCareerPathReturnDestination(careerPathFromResultsSearch('?returnTo=https://example.test')).path, '/results')
})
