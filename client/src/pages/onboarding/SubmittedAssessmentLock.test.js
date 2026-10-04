import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = (relativePath) => readFile(new URL(relativePath, import.meta.url), 'utf8')

test('submitted assessment routes resolve persisted results before editable questions', async () => {
  const [skills, personality] = await Promise.all([
    source('./OnboardingSkills.jsx'),
    source('./OnboardingPersonality.jsx'),
  ])

  assert.ok(skills.indexOf('/api/quiz/results') < skills.indexOf('/api/quiz`'))
  assert.match(skills, /setResults\(\{ domainScores, totalCorrect: totals\.correct, totalQuestions: totals\.total \}\)/)
  assert.match(skills, /if \(assessmentAccessError\)/)
  assert.match(skills, /const overallPercentage = results\.totalQuestions > 0/)
  assert.match(skills, /\{overallPercentage\}%/)
  assert.match(skills, /out of \{results\.totalQuestions\} correct/)
  assert.match(skills, /Strongest Areas/)
  assert.match(skills, /Areas to Improve/)
  assert.match(skills, /Continue to Personality Assessment/)

  assert.match(personality, /fetch\(`\$\{import\.meta\.env\.VITE_API_URL\}\/api\/mbti`/)
  assert.match(personality, /setResult\(savedResult\)/)
  assert.match(personality, /if \(resultCheckFailed\)/)
})

test('recommendation navigation goes to the Summary Dashboard without reopening Personality', async () => {
  const results = await source('../Results.jsx')
  assert.match(results, /navigate\('\/dashboard\/summary'\)/)
  assert.match(results, /Go to Summary Dashboard/)
  assert.doesNotMatch(results, /Back to Personality Result/)
})

test('retake reuses canonical Personal Factors while Profile keeps separate view and edit modes', async () => {
  const [onboardingProfile, profile, profileEdit, app] = await Promise.all([
    source('./OnboardingProfile.jsx'),
    source('../Profile.jsx'),
    source('../ProfileEdit.jsx'),
    source('../../App.jsx'),
  ])
  assert.match(onboardingProfile, /<PersonalFactorsForm/)
  assert.doesNotMatch(onboardingProfile, /UsernameField|Account username/)
  assert.match(onboardingProfile, /Continue to Interests/)
  assert.match(onboardingProfile, /Saved Personal Factors/)
  assert.match(onboardingProfile, /Edit Personal Factors/)
  assert.match(onboardingProfile, /setIsEditing\(false\)/)
  assert.match(onboardingProfile, /api\/assessment-attempts\/recover/)
  assert.match(onboardingProfile, /fetch\(`\$\{import\.meta\.env\.VITE_API_URL\}\/api\/profile`, \{ method: 'POST', headers: \{ 'Content-Type': 'application\/json', Authorization: `Bearer \$\{token\}` \}/)
  assert.match(onboardingProfile, /disabled=\{saving \|\| !isComplete\}/)
  assert.match(onboardingProfile, /headers: \{ Authorization: `Bearer \$\{token\}` \}/)
  assert.match(onboardingProfile, /response\.status === 404 \|\| response\.status === 204/)
  assert.doesNotMatch(onboardingProfile, /fetch\(`\$\{import\.meta\.env\.VITE_API_URL\}\/api\/profile`, \{ headers: assessmentHeaders/)
  assert.doesNotMatch(onboardingProfile, /View Profile|navigate\('\/profile'\)/)
  assert.doesNotMatch(onboardingProfile, /if \(getAssessmentAttemptId\(sessionStorage\)\) \{ navigate/)
  assert.doesNotMatch(onboardingProfile, /isEmptyAttemptProfileResponse/)
  assert.doesNotMatch(profile, /<PersonalFactorsForm|<UsernameField|Save Changes/)
  assert.match(profile, /Account Username/)
  assert.match(profile, /Physical \/ Accessibility/)
  assert.match(profile, /navigate\('\/profile\/edit'\)/)
  assert.match(profile, /Edit Profile/)
  assert.match(profileEdit, /<PersonalFactorsForm/)
  assert.match(profileEdit, /<UsernameField/)
  assert.match(profileEdit, /Save Changes/)
  assert.match(profileEdit, /navigate\('\/profile', \{ replace: true, state: \{ message: 'Profile updated successfully\.' \} \}\)/)
  assert.match(app, /path="\/profile\/edit" element=\{<ProfileEdit \/>\}/)
  assert.doesNotMatch(profile, /dashboard\/summary/)
  assert.doesNotMatch(profile, /Retake Assessment|Changes will not update an existing saved recommendation/)
})
