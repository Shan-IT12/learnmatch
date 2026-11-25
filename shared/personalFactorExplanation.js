import { PERSONAL_FACTOR_RELEVANCE } from '../server/config/recommendationConfig.js'
import { deriveFactorApplicability, personalFactorResponses } from './personalFactors.js'

const labels = {
  physical: 'Physical / Accessibility', health: 'Health & Well-being',
  financial: 'Financial Constraints', family: 'Family Responsibilities', work: 'Work Responsibilities',
}

// Read the same relevance rules and disclosure handling as the scoring engine.
// Exclude No, Prefer not to say, and Yes -> No impact (0) so neutral/private responses are never surfaced.
export function getPersonalFactorExplanation(profile = {}, recommendations = []) {
  const applicability = deriveFactorApplicability(profile)
  return Object.entries(personalFactorResponses(profile))
    .filter(([factor, impact]) => applicability[factor] === 'yes' && impact !== null && impact > 0)
    .map(([factor, impact]) => ({
      factor, label: labels[factor], impact,
      courses: recommendations.map(course => ({
        code: course.course_code,
        name: course.course_name,
        applied: PERSONAL_FACTOR_RELEVANCE[course.cluster_category]?.[factor] ?? null,
      })),
    }))
}
