import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const skillsPath = new URL('./OnboardingSkills.jsx', import.meta.url)
const personalityPath = new URL('./OnboardingPersonality.jsx', import.meta.url)

test('question flows use one local pager and no selected-answer checkmark', async () => {
  const [skills, personality] = await Promise.all([
    readFile(skillsPath, 'utf8'),
    readFile(personalityPath, 'utf8'),
  ])

  for (const source of [skills, personality]) {
    assert.match(source, /AssessmentQuestionNavigation/)
    assert.match(source, /showFooterNavigation=\{false\}/)
    assert.doesNotMatch(source, /M5 13l4 4L19 7/)
    assert.match(source, /aria-pressed=\{/)
    assert.match(source, /border-orange-500/)
    assert.match(source, /writeAssessmentSession/)
  }

  assert.match(skills, /finalLabel="Submit Academic Skills"/)
  assert.doesNotMatch(skills, /Submit Quiz/)

  assert.equal((personality.match(/finalLabel="View Results"/g) || []).length, 1)
  assert.doesNotMatch(personality, /See Your Results|Submit Assessment/)
})
