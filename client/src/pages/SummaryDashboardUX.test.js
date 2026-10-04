import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('Summary Dashboard shows a self-contained student-friendly personality profile', async () => {
  const source = await readFile(new URL('./SummaryDashboard.jsx', import.meta.url), 'utf8')
  assert.match(source, /getDimensionResults\(mbti\.mbtiType, mbti\.scores\)/)
  assert.match(source, /personalityMeaning/)
  assert.match(source, /MBTI_TYPE_CONTENT\[mbti\.mbtiType\]\?\.summary/)
  assert.match(source, /dimension\.preferredName/)
  assert.match(source, /What your letters mean/)
  assert.match(source, /dimension\.preferredMeaning/)
  assert.doesNotMatch(source, /View Personality Details/)
  assert.doesNotMatch(source, /navigate\('\/onboarding\/personality'\)/)
  assert.doesNotMatch(source, /tie-breaking|raw scoring|formula/i)
})

test('Results uses a prominent school CTA and milestone-scoped feedback prompt', async () => {
  const source = await readFile(new URL('./Results.jsx', import.meta.url), 'utf8')
  assert.match(source, /IconSchool[\s\S]*Find Schools in SJDM/)
  assert.match(source, /bg-orange-500[\s\S]*focus:ring-2/)
  assert.match(source, /api\/recommendations\/latest/)
  assert.match(source, /milestoneReached=\{!loading && !error && recommendations\.length > 0\}/)
})

test('Course and Career Overview stays compact and delegates details to Career Path', async () => {
  const source = await readFile(new URL('./SummaryDashboard.jsx', import.meta.url), 'utf8')
  assert.match(source, /summarizeCourseDescription/)
  assert.match(source, /slice\(0, 2\)/)
  assert.match(source, /obtainableSkills\.slice\(0, 3\)/)
  assert.match(source, /careerOpportunities\.slice\(0, 3\)/)
  assert.match(source, /View Full Career Path/)
  assert.match(source, /navigate\('\/results\/career-path\?returnTo=summary'\)/)
  assert.doesNotMatch(source, /Explore Detailed Career Path/)
  assert.doesNotMatch(source, /Salary figures are estimates/)
  assert.doesNotMatch(source, /estimated_monthly_salary_php/)
})
