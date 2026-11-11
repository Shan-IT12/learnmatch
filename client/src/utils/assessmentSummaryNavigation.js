// A saved recommendation belongs to a finalized personality assessment. Use the
// authenticated saved-result response, never browser draft/completion flags.
export function hasSavedAssessmentSummary(data) {
  return Boolean(data?.recommendation?.assessment_id &&
    data.recommendation.recommendation_id &&
    Array.isArray(data.recommendations) && data.recommendations.length > 0)
}

export function collegePhasePath(status) {
  return status?.active === true ? '/college' : '/college/setup'
}
