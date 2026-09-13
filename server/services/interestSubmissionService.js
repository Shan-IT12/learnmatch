import { CURRENT_INTEREST_RIASEC_MAP } from '../config/interestRiasecConfig.js'

export const MIN_INTEREST_SELECTIONS = 3
export const MAX_INTEREST_SELECTIONS = 10

const CURRENT_INTEREST_NAMES = new Set(Object.keys(CURRENT_INTEREST_RIASEC_MAP))

export function validateInterestSubmission(interests) {
  if (!Array.isArray(interests)) return 'interests must be an array'
  if (interests.length < MIN_INTEREST_SELECTIONS) {
    return `Select at least ${MIN_INTEREST_SELECTIONS} interests.`
  }
  if (interests.length > MAX_INTEREST_SELECTIONS) {
    return `Select no more than ${MAX_INTEREST_SELECTIONS} interests.`
  }
  if (new Set(interests).size !== interests.length) {
    return 'Duplicate interests are not allowed.'
  }
  if (interests.some((interest) => typeof interest !== 'string' || !CURRENT_INTEREST_NAMES.has(interest))) {
    return 'One or more selected interests are not recognized.'
  }
  return null
}
