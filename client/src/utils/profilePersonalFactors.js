import { PERSONAL_FACTOR_KEYS, deriveFactorApplicability } from '../../../shared/personalFactors.js'
export { PERSONAL_FACTOR_KEYS, deriveFactorApplicability }

export const SUPPORTED_PERSONAL_FACTOR_FIELDS = Object.freeze([
  'personal_factor_answers',
  'physical_accessibility_areas',
  'physical_accessibility_difficulties',
  'factor_physical_impact',
  'factor_health_impact',
  'factor_financial_impact',
  'factor_family_impact',
  'factor_work_impact',
])

const impactField = (factor) => `factor_${factor}_impact`

export function isPersonalFactorsComplete(profile = {}) {
  const applicability = deriveFactorApplicability(profile)
  if (PERSONAL_FACTOR_KEYS.some((factor) => !applicability[factor])) return false
  if (PERSONAL_FACTOR_KEYS.some((factor) => applicability[factor] === 'yes' && ![1, 2, 3, 4].includes(Number(profile[impactField(factor)])))) return false
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
  return next
}

export function shouldShowFactorDetails(applicability, factor) {
  return applicability?.[factor] === 'yes'
}

export function buildProfilePayload(profile, applicability = deriveFactorApplicability(profile)) {
  const answers = Object.fromEntries(PERSONAL_FACTOR_KEYS.map(factor => [factor, applicability[factor] || 'unknown']))
  return {
    username: profile.username.trim(),
    personal_factor_answers: answers,
    physical_accessibility_areas: answers.physical === 'yes' || answers.physical === 'legacy_unknown' ? profile.physical_accessibility_areas : [],
    physical_accessibility_difficulties: answers.physical === 'yes' || answers.physical === 'legacy_unknown' ? profile.physical_accessibility_difficulties : {},
    ...Object.fromEntries(PERSONAL_FACTOR_KEYS.map(factor => [impactField(factor),
      ['yes', 'legacy_unknown'].includes(answers[factor]) ? Number(profile[impactField(factor)]) : null])),
  }
}
