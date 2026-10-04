import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = (relativePath) => readFile(new URL(relativePath, import.meta.url), 'utf8')

test('active College results hide the full Summary Dashboard shortcut', async () => {
  const results = await source('./Results.jsx')
  assert.match(results, /Open Full Summary/)
  assert.match(results, /Return to College Dashboard|returnDestination\.label/)
  assert.match(results, /loading \|\| returnDestination\.path === '\/college'/)
  assert.match(results, /returnDestination\.path !== '\/college'/)
})

test('Career Path resolves active College state and returns directly to assessment results', async () => {
  const careerPath = await source('./CareerPath.jsx')
  assert.match(careerPath, /useActiveCollegePhase/)
  assert.match(careerPath, /if \(hasActiveCollegePhase\)[\s\S]*?navigate\('\/results'\)/)
  assert.match(careerPath, /Back to Results/)
  assert.match(careerPath, /hasActiveCollegePhase === false/)
})

test('School Locator resolves active College state independently of temporary route state', async () => {
  const locator = await source('./SchoolLocator.jsx')
  assert.match(locator, /useActiveCollegePhase/)
  assert.match(locator, /hasActiveCollegePhase[\s\S]*?\? 'results'/)
  assert.match(locator, /Resolving return destination/)
  assert.match(locator, /<PublicHeader activeCollegePhase=\{hasActiveCollegePhase\}/)
  const header = await source('../components/PublicHeader.jsx')
  assert.match(header, /suppressGenericNavigation/)
  assert.match(header, /activeCollegePhase !== false/)
})

test('assessment cancel and Step 1 back use persisted active College Phase status', async () => {
  const [layout, hook] = await Promise.all([
    source('../components/OnboardingLayout.jsx'),
    source('../hooks/useActiveCollegePhase.js'),
  ])
  assert.match(layout, /useActiveCollegePhase\(\)/)
  assert.match(layout, /hasActiveCollegePhase \? '\/college' : '\/dashboard\/summary'/)
  assert.match(layout, /Cancel Assessment/)
  assert.doesNotMatch(layout, /navigate\('\/dashboard\/summary'\)/)
  assert.match(hook, /api\/college\/status/)
  assert.match(hook, /status\?\.lifecycleStatus === 'active'/)
  assert.match(hook, /setHasActiveCollegePhase\(null\)/)
})
