import { PERSONAL_FACTOR_RELEVANCE } from '../server/config/recommendationConfig.js'
import { deriveFactorApplicability, personalFactorResponses } from './personalFactors.js'

const labels = {
  physical: 'Physical / accessibility', health: 'Health-related needs',
  financial: 'Financial circumstances', family: 'Family responsibilities', work: 'Work responsibilities',
}

// Read the same relevance rules and disclosure handling as the scoring engine.
export function getPersonalFactorExplanation(profile = {}, recommendations = []) {
  const applicability = deriveFactorApplicability(profile)
  return Object.entries(personalFactorResponses(profile)).filter(([factor, impact]) => applicability[factor] === 'yes' && impact !== null)
    .map(([factor, impact]) => ({
      factor, label: labels[factor], impact,
      courses: recommendations.map(course => ({
        code: course.course_code,
        name: course.course_name,
        applied: PERSONAL_FACTOR_RELEVANCE[course.cluster_category]?.[factor] ?? null,
      })),
    }))
}
