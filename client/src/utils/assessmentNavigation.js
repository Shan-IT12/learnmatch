export function getNextAssessmentRoute({ hasProfile, hasInterests, hasSkills, hasPersonality }) {
  if (!hasProfile) return '/onboarding/profile'
  if (!hasInterests) return '/onboarding/interests'
  if (!hasSkills) return '/onboarding/skills'
  if (!hasPersonality) return '/onboarding/personality'
  return '/dashboard/summary'
}

export function getAttemptResumeRoute(attempt) {
  if (!attempt) return null
  if (!attempt.personalFactors) return '/onboarding/profile'
  if (!hasSubmittedAssessmentInterests(attempt)) return '/onboarding/interests'
  if (!attempt.skillResult) return '/onboarding/skills'
  return '/onboarding/personality'
}

export function hasSubmittedAssessmentInterests(attempt) {
  if (typeof attempt?.interestsSubmitted === 'boolean') return attempt.interestsSubmitted
  // Compatibility with older backend responses: valid draft selections alone
  // never prove submission. Already-started later steps remain resumable.
  return Boolean(attempt && (Array.isArray(attempt.interests) && attempt.interests.length >= 3 ||
    attempt.skillQuestions?.length || attempt.skillResult || Object.keys(attempt.personalityAnswers || {}).length))
}
