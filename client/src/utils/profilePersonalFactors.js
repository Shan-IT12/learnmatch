import { PERSONAL_FACTOR_KEYS, VALID_APPLICABILITY_ANSWERS, deriveFactorApplicability } from '../../../shared/personalFactors.js'
export { PERSONAL_FACTOR_KEYS, VALID_APPLICABILITY_ANSWERS, deriveFactorApplicability }

const impactField = (factor) => `factor_${factor}_impact`
const isValidImpact = (raw) => raw !== '' && raw !== null && raw !== undefined && [0, 1, 2, 3, 4].includes(Number(raw))

export function isPersonalFactorsComplete(profile = {}) {
  const applicability = deriveFactorApplicability(profile)
  if (PERSONAL_FACTOR_KEYS.some((factor) => !VALID_APPLICABILITY_ANSWERS.includes(applicability[factor]))) return false
  if (PERSONAL_FACTOR_KEYS.some((factor) => applicability[factor] === 'yes' && !isValidImpact(profile[impactField(factor)]))) return false
  if (applicability.physical === 'yes') {
    const areas = Array.isArray(profile.physical_accessibility_areas) ? profile.physical_accessibility_areas : []
    const difficulties = profile.physical_accessibility_difficulties && typeof profile.physical_accessibility_difficulties === 'object' ? profile.physical_accessibility_difficulties : {}
    if (areas.length === 0 || areas.some((area) => !['some_difficulty', 'a_lot_of_difficulty', 'cannot_do'].includes(difficulties[area]))) return false
  }
  return true
}

export function applyFactorApplicability(profile, factor, answer) {
  const next = { ...profile, personal_factor_answers: { ...deriveFactorApplicability(profile), [factor]: answer }, [impactField(factor)]: answer === 'yes' ? '' : null }
  if (factor === 'physical' && answer !== 'yes') {
    next.physical_accessibility_areas = []
    next.physical_accessibility_difficulties = {}
  }
  if (factor === 'health' && answer !== 'yes') {
    next.health_wellbeing_areas = []
  }
  return next
}

export function shouldShowFactorDetails(applicability, factor) {
  return applicability?.[factor] === 'yes'
}

export function buildProfilePayload(profile, applicability = deriveFactorApplicability(profile)) {
  const answers = Object.fromEntries(PERSONAL_FACTOR_KEYS.map(factor => [factor, applicability[factor] || '']))
  return {
    username: profile.username.trim(),
    personal_factor_answers: answers,
    physical_accessibility_areas: answers.physical === 'yes' ? (profile.physical_accessibility_areas || []) : [],
    physical_accessibility_difficulties: answers.physical === 'yes' ? (profile.physical_accessibility_difficulties || {}) : {},
    health_wellbeing_areas: answers.health === 'yes' ? (profile.health_wellbeing_areas || []) : [],
    ...Object.fromEntries(PERSONAL_FACTOR_KEYS.map(factor => [impactField(factor),
      answers[factor] === 'yes' ? Number(profile[impactField(factor)]) : null])),
  }
}
