export function getNextAssessmentRoute({ hasProfile, hasInterests, hasSkills, hasPersonality }) {
  if (!hasProfile) return '/onboarding/profile'
  if (!hasInterests) return '/onboarding/interests'
  if (!hasSkills) return '/onboarding/skills'
  if (!hasPersonality) return '/onboarding/personality'
  return '/dashboard/summary'
}
