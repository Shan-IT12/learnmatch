export const PERSONAL_FACTOR_KEYS = Object.freeze(['physical', 'health', 'financial', 'family', 'work'])

export const VALID_APPLICABILITY_ANSWERS = Object.freeze(['no', 'yes', 'prefer_not_to_say'])

function object(value, fallback = {}) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value
  if (typeof value !== 'string') return fallback
  try { return object(JSON.parse(value), fallback) } catch { return fallback }
}

// Missing metadata is historical data, never evidence that an impact of 1 meant No.
export function deriveFactorApplicability(profile = {}) {
  const saved = object(profile.personal_factor_answers)
  return Object.fromEntries(PERSONAL_FACTOR_KEYS.map((factor) => {
    if (['yes', 'no', 'prefer_not_to_say', 'unknown', 'legacy_unknown'].includes(saved[factor])) {
      return [factor, saved[factor]]
    }
    const rawImpact = profile[`factor_${factor}_impact`]
    const impact = rawImpact === '' || rawImpact === null || rawImpact === undefined ? NaN : Number(rawImpact)
    return [factor, impact === 1 ? 'legacy_unknown' : impact >= 2 && impact <= 4 ? 'yes' : 'unknown']
  }))
}

export function personalFactorResponses(profile = {}) {
  const states = deriveFactorApplicability(profile)
  return Object.fromEntries(PERSONAL_FACTOR_KEYS.map((factor) => {
    const rawImpact = profile[`factor_${factor}_impact`]
    const impact = rawImpact === '' || rawImpact === null || rawImpact === undefined ? NaN : Number(rawImpact)
    if (states[factor] === 'no' || states[factor] === 'prefer_not_to_say') {
      return [factor, 0]
    }
    if (states[factor] === 'yes' && Number.isInteger(impact) && impact >= 0 && impact <= 4) {
      return [factor, impact]
    }
    return [factor, null]
  }))
}
