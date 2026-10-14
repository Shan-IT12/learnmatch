import { CURRENT_INTEREST_RIASEC_MAP } from '../config/interestRiasecConfig.js'

// Only legacy activity-array submissions use the former minimum.
export const MIN_INTEREST_SELECTIONS = 3
export const MAX_INTEREST_SELECTIONS = 10
const CURRENT_INTEREST_NAMES = new Set(Object.keys(CURRENT_INTEREST_RIASEC_MAP))

// Compatibility for drafts saved using the earlier category design.
const LEGACY_CATEGORY_NAMES = [
  'Creative & Arts', 'Technology & Science', 'Sports & Physical',
  'Social & Service', 'Business & Practical', 'Nature & Environment',
]

export function normalizeInterestResponse(value) {
  if (Array.isArray(value)) return { selected: value, noInterests: false, legacy: true }
  if (!value || typeof value !== 'object') return null
  const selected = Array.isArray(value.selected) ? value.selected : null
  const noInterests = value.noInterests !== undefined ? value.noInterests
    : Array.isArray(value.noneGroups)
      ? selected?.length === 0 && LEGACY_CATEGORY_NAMES.every((group) => value.noneGroups.includes(group))
      : undefined
  return { selected, noInterests, legacy: false }
}

export function getSelectedInterestNames(value) {
  return normalizeInterestResponse(value)?.selected || []
}

export function validateInterestSubmission(interests, { draft = false } = {}) {
  const response = normalizeInterestResponse(interests)
  if (!response) return 'interests must be an array or an interest response.'
  const { selected, noInterests, legacy } = response
  if (!Array.isArray(selected)) return 'Selected interests must be an array.'
  if (selected.length > MAX_INTEREST_SELECTIONS) return `Select no more than ${MAX_INTEREST_SELECTIONS} interests.`
  if (new Set(selected).size !== selected.length) return 'Duplicate interests are not allowed.'
  if (selected.some((interest) => typeof interest !== 'string' || !CURRENT_INTEREST_NAMES.has(interest))) {
    return 'One or more selected interests are not recognized.'
  }
  if (legacy) {
    return !draft && selected.length < MIN_INTEREST_SELECTIONS
      ? `Select at least ${MIN_INTEREST_SELECTIONS} interests.` : null
  }
  if (typeof noInterests !== 'boolean') return 'noInterests must be a boolean.'
  if (noInterests && selected.length > 0) return 'No interests or hobbies cannot be combined with selected activities.'
  if (!draft && !noInterests && selected.length === 0) {
    return 'Select at least one activity or check No interests or hobbies.'
  }
  return null
}
