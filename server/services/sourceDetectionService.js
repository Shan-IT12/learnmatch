import { mentionsProgram } from './sourceProgramRelationship.js'
export { courseNameKey } from './sourceProgramRelationship.js'
export const DETECTION_VERSION = 'target-course-support-v1'
const supporting = text => text.length >= 30 && /\b(description|curriculum|skills|duration|years?|program outcomes|course overview|graduates|students|study|learning)\b/i.test(text)

// Detect evidence near the manually supplied name. Never propose course fields.
export function detectCourseSupport(parsed, courseName, url) {
  const excerpts = []
  let nameFound = false, supported = false
  const excerpt = block => {
    if (excerpts.length < 3 && !excerpts.some(item => item.location === block.location)) excerpts.push({ text: block.text.slice(0, 650), location: block.location, url })
  }
  for (let i = 0; i < parsed.blocks.length; i++) {
    const block = parsed.blocks[i]
    if (!mentionsProgram(block.text, courseName)) continue
    nameFound = true; excerpt(block)
    const multiplePrograms = (block.text.match(/\b(?:Bachelor(?:'s)?\s+(?:of|in)|BS|BA|BSc)\b/gi) || []).length > 1
    if (!multiplePrograms && !/\b(?:available programs|programs offered)\s*:/i.test(block.text) && supporting(block.text) && block.text.length > courseName.length + 30) supported = true
    for (const next of parsed.blocks.slice(i + 1, i + 3)) {
      if (/\b(?:Bachelor(?:'s)?\s+(?:of|in)|BS|BA|BSc)\b/i.test(next.text) && !mentionsProgram(next.text, courseName)) break
      if (next.heading && !/description|curriculum|skills|duration|overview/i.test(next.text)) break
      if (supporting(next.text)) { supported = true; excerpt(next) }
    }
    if (supported) break
  }
  return { status: supported ? 'Potential Match' : 'Needs Review', excerpts,
    relationship: { kind: nameFound ? 'Same/equivalent program' : 'Insufficient evidence', source_programs: nameFound ? [courseName] : [],
      explanation: nameFound ? 'The entered program name or a supported degree abbreviation appears in the cited passages.' : 'The readable passages do not establish the entered program. Missing evidence does not prove a mismatch.', excerpts },
    reasons: [supported ? 'The source names the target course and includes supporting course information.' : nameFound ? 'Course name found, but supporting course information could not be identified. Review manually.' : 'Supporting information for the target course was not found. Review manually.'] }
}
