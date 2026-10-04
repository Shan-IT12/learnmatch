import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('active College Dashboard starts a fresh assessment without entering College Setup', async () => {
  const source = await readFile(new URL('./CollegeDashboard.jsx', import.meta.url), 'utf8')
  assert.match(source, /Take Assessment Again/)
  assert.match(source, /api\/assessment-attempts/)
  assert.match(source, /beginAssessmentAttempt\(sessionStorage, payload\.attemptId\)/)
  assert.match(source, /navigate\('\/onboarding\/profile'\)/)
  assert.doesNotMatch(source.match(/const handleTakeAssessment[\s\S]*?\n\s{2}\}/)[0], /college\/setup|tracking\/pause|tracking\/end/)
  assert.match(source, /lifecycleStatus !== 'active'/)
  assert.match(source, />\s*Dashboard\s*</)
})
