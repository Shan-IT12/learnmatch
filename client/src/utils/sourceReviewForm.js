import { COURSE_SOURCE_FIELDS } from '../../../shared/courseSourceFields.js'

export function sourceConfirmationPayload(source, confirmedToken, blocked) {
  if (blocked || source.is_removed || !source.review_token || confirmedToken !== source.review_token) return null
  // Identity and timestamps are never part of the client confirmation payload.
  return { confirmed: true, expected_token: source.review_token }
}

// Use only persisted claims backed by a current explicit review, never review context.
export function savedSourceCoverage(sources) {
  const covered = new Set(sources.filter(source => !Number(source.is_removed) && source.reviews?.some(review => review.current)).flatMap(source => source.supported_fields))
  const fields = Object.keys(COURSE_SOURCE_FIELDS)
  return { confirmed: fields.filter(key => covered.has(key)), missing: fields.filter(key => !covered.has(key)) }
}
export function sourceSupportLabels(source) {
  return Object.keys(COURSE_SOURCE_FIELDS).filter(key => source.supported_fields.includes(key)).map(key => COURSE_SOURCE_FIELDS[key]).join(', ')
}
