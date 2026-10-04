export const SUPPORTED_PERSONAL_FACTOR_FIELDS = Object.freeze([
  'physical_accessibility_areas',
  'physical_accessibility_difficulties',
  'factor_physical_impact',
  'factor_health_impact',
  'factor_financial_impact',
  'factor_family_impact',
  'factor_work_impact',
])

export const PERSONAL_FACTOR_KEYS = Object.freeze(['physical', 'health', 'financial', 'family', 'work'])

const impactField = (factor) => `factor_${factor}_impact`

export function deriveFactorApplicability(profile = {}) {
  const physicalAreas = Array.isArray(profile.physical_accessibility_areas)
    ? profile.physical_accessibility_areas.filter((area) => area !== 'none')
    : []
  const physicalImpact = Number(profile.factor_physical_impact)
  const applicability = {
    physical: physicalAreas.length > 0 || physicalImpact > 1
      ? 'yes'
      : physicalImpact === 1 ? 'no' : '',
  }
  for (const factor of PERSONAL_FACTOR_KEYS.slice(1)) {
    const impact = Number(profile[impactField(factor)])
    applicability[factor] = impact > 1 ? 'yes' : impact === 1 ? 'no' : ''
  }
  return applicability
}

export function applyFactorApplicability(profile, factor, answer) {
  const next = { ...profile, [impactField(factor)]: answer === 'no' ? 1 : '' }
  if (factor === 'physical' && answer === 'no') {
    next.physical_accessibility_areas = []
    next.physical_accessibility_difficulties = {}
  }
  return next
}

export function shouldShowFactorDetails(applicability, factor) {
  return applicability?.[factor] === 'yes'
}

export function buildProfilePayload(profile) {
  return {
    username: profile.username.trim(),
    physical_accessibility_areas: profile.physical_accessibility_areas,
    physical_accessibility_difficulties: profile.physical_accessibility_difficulties,
    factor_physical_impact: Number(profile.factor_physical_impact),
    factor_health_impact: Number(profile.factor_health_impact),
    factor_financial_impact: Number(profile.factor_financial_impact),
    factor_family_impact: Number(profile.factor_family_impact),
    factor_work_impact: Number(profile.factor_work_impact),
  }
}

function stableValue(value) {
  if (Array.isArray(value)) return JSON.stringify([...value].sort())
  if (value && typeof value === 'object') {
    return JSON.stringify(Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))))
  }
  return value ?? ''
}

export function personalFactorsChanged(current, saved) {
  return SUPPORTED_PERSONAL_FACTOR_FIELDS.some(
    (field) => stableValue(current?.[field]) !== stableValue(saved?.[field])
  )
}

export function shouldWarnForPersonalFactorAttempt({
  hasRecommendation,
  confirmationGranted,
  nextProfile,
  savedProfile,
}) {
  return Boolean(
    hasRecommendation
    && !confirmationGranted
    && personalFactorsChanged(nextProfile, savedProfile)
  )
}

export function shouldOfferRetake({ hasRecommendation, factorsChanged }) {
  return Boolean(hasRecommendation && factorsChanged)
}
