const STOP_WORDS = new Set(['in', 'of', 'the', 'and', 'for', 'with', 'on', 'to', 'a', 'an'])

const DEGREE_PREFIX_RULES = [
  [/^b\.?\s*s\.?\s*c\.?\s+(?:in\s+)?/u, 'bachelor of science in '],
  [/^b\.?\s*s\.?\s+(?:in\s+)?/u, 'bachelor of science in '],
  [/^b\.?\s*a\.?\s+(?:in\s+)?/u, 'bachelor of arts in '],
  [/^a\.?\s*b\.?\s+(?:in\s+)?/u, 'bachelor of arts in '],
  [/^b\.?\s*s\.?\s*e\.?\s*d\.?\s*(?:in\s+)?/u, 'bachelor of secondary education '],
  [/^b\.?\s*e\.?\s*e\.?\s*d\.?\s*(?:in\s+)?/u, 'bachelor of elementary education '],
  [/^b\.?\s*t\.?\s*v\.?\s*t\.?\s*e\.?\s*d\.?\s*(?:in\s+)?/u, 'bachelor of technical vocational teacher education '],
  [/^bachelor\s+of\s+science\s+(?!in\b)/u, 'bachelor of science in '],
  [/^bachelor\s+of\s+arts\s+(?!in\b)/u, 'bachelor of arts in '],
]

export function normalizeTextKey(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/&/gu, ' and ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim()
}

export function normalizeCourseCodeKey(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .trim()
}

export function canonicalizeCourseName(name) {
  let normalized = normalizeTextKey(name)
  if (!normalized) return ''
  // Strip trailing parenthetical abbreviation if it was included inside the name, e.g. "(BSIT)"
  const parenMatch = String(name ?? '').match(/\(([A-Za-z0-9-]{2,14})\)\s*$/u)
  if (parenMatch) {
    const abbrToken = normalizeTextKey(parenMatch[1])
    if (abbrToken && normalized.endsWith(` ${abbrToken}`)) {
      normalized = normalized.slice(0, -(abbrToken.length + 1)).trim()
    }
  }
  for (const [pattern, replacement] of DEGREE_PREFIX_RULES) {
    if (pattern.test(normalized)) {
      normalized = normalized.replace(pattern, replacement).replace(/\s+/gu, ' ').trim()
      break
    }
  }
  return normalized
}

export function extractCourseAcronym(name) {
  const raw = String(name ?? '').trim()
  if (!raw) return ''
  const parenMatch = raw.match(/\(([A-Za-z]{2,12})\)\s*$/u)
  if (parenMatch) return normalizeCourseCodeKey(parenMatch[1])

  const canonical = canonicalizeCourseName(raw)
  if (!canonical) return ''

  // Map degree prefix + significant discipline words (e.g. "bachelor of science in information technology" -> "BSIT")
  let prefix = ''
  let rest = canonical
  if (rest.startsWith('bachelor of science in ')) {
    prefix = 'BS'
    rest = rest.slice('bachelor of science in '.length)
  } else if (rest.startsWith('bachelor of arts in ')) {
    prefix = 'BA'
    rest = rest.slice('bachelor of arts in '.length)
  } else if (rest.startsWith('bachelor of ')) {
    prefix = 'B'
    rest = rest.slice('bachelor of '.length)
  }

  // Stop before "major in" / "specialization in" so base acronym stays clean unless distinct
  const majorSplit = rest.split(/\b(?:major|specialization|track)\b/u)[0].trim()
  const words = (majorSplit || rest)
    .split(/\s+/u)
    .filter((word) => word && !STOP_WORDS.has(word))

  if (!prefix && words.length === 1 && words[0].length >= 2 && words[0].length <= 10) {
    return words[0].toUpperCase()
  }
  const letters = words.map((word) => word[0]?.toUpperCase() || '').join('')
  return `${prefix}${letters}`
}

function significantTokens(canonicalName) {
  return new Set(
    canonicalName
      .split(/\s+/u)
      .filter((token) => token.length > 1 && !STOP_WORDS.has(token) && token !== 'bachelor' && token !== 'science' && token !== 'arts')
  )
}

export function describeCourseStatus(row) {
  if (Number(row.is_draft) === 1) return 'Draft'
  if (Number(row.is_active) === 1 || row.is_active === true) return 'Active'
  return 'Inactive'
}

export function detectDuplicateCourses(candidates, { courseName = '', courseAbbreviation = '', excludeCourseId = null, excludeReplacementFor = null } = {}) {
  const inputCanonical = canonicalizeCourseName(courseName)
  const inputAcronym = normalizeCourseCodeKey(courseAbbreviation) || extractCourseAcronym(courseName)
  const inputAbbrExplicit = normalizeCourseCodeKey(courseAbbreviation)
  const inputTokens = significantTokens(inputCanonical)
  const hasMajor = /\b(?:major|specialization|track)\b/u.test(inputCanonical)

  const exactMatches = []
  const similarMatches = []

  for (const row of candidates || []) {
    const id = Number(row.course_id)
    if (excludeCourseId !== null && id === Number(excludeCourseId)) continue
    if (excludeReplacementFor !== null && id === Number(excludeReplacementFor)) continue

    const rowCanonical = canonicalizeCourseName(row.course_name)
    const rowCode = normalizeCourseCodeKey(row.course_code)
    const rowAbbr = normalizeCourseCodeKey(row.course_abbreviation)
    const rowDerivedAcronym = extractCourseAcronym(row.course_name)
    const rowHasMajor = /\b(?:major|specialization|track)\b/u.test(rowCanonical)

    let matchType = null
    let reason = ''

    if (inputCanonical && rowCanonical && inputCanonical === rowCanonical) {
      matchType = 'exact'
      reason = 'Matches existing course name'
    } else if (inputAbbrExplicit && (inputAbbrExplicit === rowAbbr || inputAbbrExplicit === rowCode)) {
      matchType = 'exact'
      reason = `Matches existing abbreviation/code (${row.course_abbreviation || row.course_code})`
    } else if (
      inputCanonical &&
      inputAcronym &&
      inputAcronym.length >= 3 &&
      !hasMajor &&
      !rowHasMajor &&
      (inputAcronym === rowAbbr || inputAcronym === rowCode || (inputAcronym === rowDerivedAcronym && inputCanonical.split(' ').length <= 3))
    ) {
      matchType = 'exact'
      reason = `Equivalent to existing program (${row.course_abbreviation || rowDerivedAcronym})`
    } else if (inputTokens.size >= 2) {
      const rowTokens = significantTokens(rowCanonical)
      if (rowTokens.size >= 2) {
        let overlap = 0
        for (const token of inputTokens) {
          if (rowTokens.has(token)) overlap += 1
        }
        const union = new Set([...inputTokens, ...rowTokens]).size
        const jaccard = union > 0 ? overlap / union : 0
        if (jaccard >= 0.72) {
          matchType = 'similar'
          reason = 'Very similar program name'
        }
      }
    }

    if (matchType) {
      const shaped = {
        course_id: id,
        course_code: row.course_code || null,
        course_name: row.course_name,
        course_abbreviation: row.course_abbreviation || null,
        status: describeCourseStatus(row),
        matchType,
        reason,
      }
      if (matchType === 'exact') exactMatches.push(shaped)
      else similarMatches.push(shaped)
    }
  }

  return {
    hasExactDuplicate: exactMatches.length > 0,
    hasSimilarMatch: similarMatches.length > 0,
    exactMatches,
    similarMatches: similarMatches.slice(0, 5),
  }
}

export async function checkCourseDuplicates(database, { courseName = '', courseAbbreviation = '', excludeCourseId = null, excludeReplacementFor = null } = {}) {
  const [rows] = await database.query(
    `SELECT c.course_id, c.course_code, c.course_name, c.course_abbreviation, c.is_active, c.is_draft
     FROM COURSE c
     LEFT JOIN COURSE_REPLACEMENT_DRAFT r ON r.draft_id = c.course_id
     WHERE r.published_at IS NULL`
  )
  return detectDuplicateCourses(rows, {
    courseName,
    courseAbbreviation,
    excludeCourseId,
    excludeReplacementFor,
  })
}
