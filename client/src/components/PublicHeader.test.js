import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = await readFile(new URL('./PublicHeader.jsx', import.meta.url), 'utf8')

test('Dashboard navigation requires explicit browsing context', () => {
  assert.match(source, /showDashboard = false/)
  assert.match(source, /isAuthenticated && showDashboard && activeCollegePhase === false/)
  assert.doesNotMatch(source, /isAuthenticated \? '\/dashboard'/)
})

test('active College Phase suppresses generic navigation', () => {
  assert.match(source, /suppressGenericNavigation = isAuthenticated && activeCollegePhase !== false/)
  assert.match(source, /!suppressGenericNavigation && dashboardNavigation/)
})
