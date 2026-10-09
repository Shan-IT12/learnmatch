const SPECIALIZATION_MARKER = /\s+(Major\s+in|Specialization\s+in|Specialization:|Track\s+in|Track:|Concentration\s+in|Option\s+in|Option:)\s+/i
const SPECIALIZATION_MARKER_LABELS = new Map([
  ['major in', 'Major in'],
  ['specialization in', 'Specialization in'],
  ['specialization:', 'Specialization:'],
  ['track in', 'Track in'],
  ['track:', 'Track:'],
  ['concentration in', 'Concentration in'],
  ['option in', 'Option in'],
  ['option:', 'Option:'],
])
const CONNECTOR_WORDS = new Set(['in', 'of', 'and', 'the'])

export function parseCourseName(courseName) {
  if (typeof courseName !== 'string') {
    return { baseName: courseName ?? '', specialization: '' }
  }

  const match = SPECIALIZATION_MARKER.exec(courseName)
  if (!match) return { baseName: courseName, specialization: '' }

  const baseName = courseName.slice(0, match.index).trimEnd()
  const specializationValue = courseName.slice(match.index + match[0].length).trimStart()

  if (!baseName || !specializationValue) {
    return { baseName: courseName, specialization: '' }
  }

  return {
    baseName,
    specialization: `${SPECIALIZATION_MARKER_LABELS.get(match[1].toLowerCase())} ${specializationValue}`,
  }
}

export function getDisplayCourseAbbreviation(courseName, abbreviation = '') {
  const baseAbbreviation = typeof abbreviation === 'string' ? abbreviation.trim() : ''
  if (!baseAbbreviation) return ''

  const { specialization } = parseCourseName(courseName)
  if (!specialization) return baseAbbreviation

  const markerMatch = /^(?:Major\s+in|Specialization\s+in|Specialization:|Track\s+in|Track:|Concentration\s+in|Option\s+in|Option:)\s+(.+)$/i.exec(specialization)
  if (!markerMatch) return baseAbbreviation

  const specializationName = markerMatch[1].trim()
  const parenthesizedAcronym = /\(([A-Z][A-Z0-9]{1,7})\)\s*$/.exec(specializationName)
  if (parenthesizedAcronym) return `${baseAbbreviation}-${parenthesizedAcronym[1]}`
  if (!/^[A-Za-z]+(?:[ '-][A-Za-z]+)*$/.test(specializationName)) return baseAbbreviation

  const significantWords = specializationName
    .split(/[ '-]+/)
    .filter((word) => word && !CONNECTOR_WORDS.has(word.toLowerCase()))
  if (significantWords.length < 2) {
    const [onlyWord] = significantWords
    return onlyWord && /^[A-Z]{2,8}$/.test(onlyWord) ? `${baseAbbreviation}-${onlyWord}` : baseAbbreviation
  }

  const suffix = significantWords
    .map((word) => (/^[A-Z]{2,8}$/.test(word) ? word : word[0].toUpperCase()))
    .join('')
  return suffix.length <= 8 ? `${baseAbbreviation}-${suffix}` : baseAbbreviation
}

export function formatCourseNameSingleLine(courseName, abbreviation = '') {
  const displayAbbreviation = getDisplayCourseAbbreviation(courseName, abbreviation)
  const suffix = displayAbbreviation ? ` (${displayAbbreviation})` : ''
  return `${courseName ?? ''}${suffix}`
}
