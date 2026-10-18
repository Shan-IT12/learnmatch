import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { getProfileReturnDestination } from './profileNavigation.js'

test('Summary profile return survives refresh and remains attached through editing', () => {
  const fromSummary = getProfileReturnDestination('?returnTo=summary')
  assert.equal(fromSummary.path, '/dashboard/summary')
  assert.equal(fromSummary.label, 'Back to Summary Dashboard')
  assert.equal(getProfileReturnDestination(fromSummary.search).path, '/dashboard/summary')
  assert.equal(getProfileReturnDestination('', { assessmentComplete: true }).path, '/dashboard/summary')
  assert.equal(getProfileReturnDestination().path, '/dashboard')
  assert.equal(getProfileReturnDestination('?returnTo=https://example.com').path, '/dashboard')
})

test('Profile navigation and successful edits preserve the explicit Summary return destination', async () => {
  const [summary, profile, edit] = await Promise.all(['SummaryDashboard', 'Profile', 'ProfileEdit'].map(name => readFile(new URL(`../pages/${name}.jsx`, import.meta.url), 'utf8')))
  assert.match(summary, /navigate\('\/profile\?returnTo=summary'/)
  assert.match(profile, /navigate\(returnDestination\.path\)/)
  assert.match(profile, /navigate\(`\/profile\/edit\$\{profileSearch\}`/)
  assert.match(edit, /navigate\(profilePath, \{ replace: true/)
  assert.doesNotMatch(profile, /navigate\('\/dashboard'\)/)
})
