export const PERSONAL_FACTOR_KEYS = Object.freeze(['physical', 'health', 'financial', 'family', 'work'])

function object(value, fallback = {}) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value
  if (typeof value !== 'string') return fallback
  try { return object(JSON.parse(value), fallback) } catch { return fallback }
}

// Missing metadata is historical data, never evidence that an impact of 1 meant No.
export function deriveFactorApplicability(profile = {}) {
  const saved = object(profile.personal_factor_answers)
  return Object.fromEntries(PERSONAL_FACTOR_KEYS.map((factor) => {
    if (['yes', 'no', 'unknown', 'legacy_unknown'].includes(saved[factor])) return [factor, saved[factor]]
    const impact = Number(profile[`factor_${factor}_impact`])
    return [factor, impact === 1 ? 'legacy_unknown' : impact >= 2 && impact <= 4 ? 'yes' : 'unknown']
  }))
}

export function personalFactorResponses(profile = {}) {
  const states = deriveFactorApplicability(profile)
  return Object.fromEntries(PERSONAL_FACTOR_KEYS.map((factor) => {
    const impact = Number(profile[`factor_${factor}_impact`])
    return [factor, states[factor] === 'no' ? 1
      : states[factor] === 'yes' && Number.isInteger(impact) && impact >= 1 && impact <= 4 ? impact : null]
  }))
}
