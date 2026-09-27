export const SUPPORTED_PERSONAL_FACTOR_FIELDS = Object.freeze([
  'factor_physical',
  'factor_health',
  'factor_financial',
  'factor_family',
  'factor_working_student',
  'factor_others',
])

export function personalFactorsChanged(
  current,
  saved,
  currentOthersSelected = Boolean(current?.factor_others),
  savedOthersSelected = Boolean(saved?.factor_others)
) {
  if (currentOthersSelected !== savedOthersSelected) return true
  return SUPPORTED_PERSONAL_FACTOR_FIELDS.some((field) => current?.[field] !== saved?.[field])
}

export function shouldWarnForPersonalFactorAttempt({
  hasRecommendation,
  confirmationGranted,
  nextProfile,
  savedProfile,
  nextOthersSelected,
  savedOthersSelected,
}) {
  return Boolean(
    hasRecommendation
    && !confirmationGranted
    && personalFactorsChanged(
      nextProfile,
      savedProfile,
      nextOthersSelected,
      savedOthersSelected
    )
  )
}

export function shouldOfferRetake({ hasRecommendation, factorsChanged }) {
  return Boolean(hasRecommendation && factorsChanged)
}
