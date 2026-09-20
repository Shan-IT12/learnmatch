export const ASSESSMENT_COMPLETION_REQUIREMENTS = Object.freeze({
  profiles: 1,
  interests: 3,
  skills: 30,
  personalities: 1,
})

export function getAssessmentStatus({
  profileCount = 0,
  interestCount = 0,
  skillCount = 0,
  personalityCount = 0,
}) {
  const completed = (
    Number(profileCount) >= ASSESSMENT_COMPLETION_REQUIREMENTS.profiles
    && Number(interestCount) >= ASSESSMENT_COMPLETION_REQUIREMENTS.interests
    && Number(skillCount) >= ASSESSMENT_COMPLETION_REQUIREMENTS.skills
    && Number(personalityCount) >= ASSESSMENT_COMPLETION_REQUIREMENTS.personalities
  )
  if (completed) return 'Completed'

  const started = [profileCount, interestCount, skillCount, personalityCount]
    .some((count) => Number(count) > 0)
  return started ? 'In Progress' : 'Not Started'
}

export function assessmentStatusSql({
  profileCount = '0',
  interestCount = '0',
  skillCount = '0',
  personalityCount = '0',
} = {}) {
  const profile = `COALESCE(${profileCount}, 0)`
  const interest = `COALESCE(${interestCount}, 0)`
  const skill = `COALESCE(${skillCount}, 0)`
  const personality = `COALESCE(${personalityCount}, 0)`

  return `CASE
    WHEN ${profile} >= ${ASSESSMENT_COMPLETION_REQUIREMENTS.profiles}
     AND ${interest} >= ${ASSESSMENT_COMPLETION_REQUIREMENTS.interests}
     AND ${skill} >= ${ASSESSMENT_COMPLETION_REQUIREMENTS.skills}
     AND ${personality} >= ${ASSESSMENT_COMPLETION_REQUIREMENTS.personalities}
      THEN 'Completed'
    WHEN ${profile} + ${interest} + ${skill} + ${personality} > 0
      THEN 'In Progress'
    ELSE 'Not Started'
  END`
}
