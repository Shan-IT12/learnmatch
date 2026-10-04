// The 2-point limit is just below the observed 90th-percentile adjacent gap
// (2.16 points across 15 persisted Top 3 snapshots on 2026-10-05).
export const DIVERSITY_SCORE_GAP_LIMIT = 0.02

export function courseProgramFamily(course) {
  const normalized = String(course?.course_name || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/^bachelor(?: s)? (?:of|in) (?:science|arts?) (?:(?:major )?in )?/, '')
    .replace(/^bs in /, '')
    .replace(/^bachelor(?: s)? (?:of|in) /, '')

  return normalized
    .split(/\s+(?:major|specialization|option|track|concentration)\s+(?:in\s+)?/, 1)[0]
    .trim()
}

export function selectDiversifiedTopThree(
  rawRanking,
  scoreGapLimit = DIVERSITY_SCORE_GAP_LIMIT
) {
  if (!Array.isArray(rawRanking)) throw new TypeError('rawRanking must be an array')
  if (!Number.isFinite(scoreGapLimit) || scoreGapLimit < 0) {
    throw new RangeError('scoreGapLimit must be a non-negative number')
  }
  if (rawRanking.length <= 1) return rawRanking.map((course) => ({ ...course }))

  const selected = [{ ...rawRanking[0] }]
  const selectedIds = new Set([rawRanking[0].course_id])
  const skippedIds = new Set()

  while (selected.length < 3 && selectedIds.size + skippedIds.size < rawRanking.length) {
    const candidate = rawRanking.find((course) => (
      !selectedIds.has(course.course_id) && !skippedIds.has(course.course_id)
    ))
    if (!candidate) break

    const selectedFamilies = new Set(selected.map(courseProgramFamily))
    const candidateFamily = courseProgramFamily(candidate)
    const repeatsSelectedFamily = candidateFamily && selectedFamilies.has(candidateFamily)

    let choice = candidate
    if (repeatsSelectedFamily) {
      const distinctAlternative = rawRanking.find((course) => (
        !selectedIds.has(course.course_id)
        && !skippedIds.has(course.course_id)
        && course.course_id !== candidate.course_id
        && !selectedFamilies.has(courseProgramFamily(course))
      ))
      if (
        distinctAlternative
        && candidate.finalScore - distinctAlternative.finalScore <= scoreGapLimit + 1e-12
      ) {
        choice = distinctAlternative
        skippedIds.add(candidate.course_id)
      }
    }

    selected.push({ ...choice })
    selectedIds.add(choice.course_id)
  }

  return selected
    .sort((left, right) => left.rankPosition - right.rankPosition)
    .map((course, index) => ({
      ...course,
      rawRankPosition: course.rankPosition,
      rankPosition: index + 1,
    }))
}
