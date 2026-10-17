export const courseNameKey = value => value.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()

// Degree abbreviations only. Subject/specialization names are never guessed.
export function programIdentityKey(name) {
  return courseNameKey(name)
    .replace(/^(?:b s c|b sc|bsc|b s|bs|bachelor of science)\s+(?:in\s+)?/, 'bachelor of science in ')
    .replace(/^(?:b a|ba|a b|ab|bachelor of arts)\s+(?:in\s+)?/, 'bachelor of arts in ')
}
export function mentionsProgram(text, name) {
  const key = programIdentityKey(name)
  // Normalize degree abbreviations anywhere in a supporting passage.
  const normalized = courseNameKey(text)
    .replace(/\b(?:b s c|b sc|bsc|b s|bs|bachelor of science)\s+(?:in\s+)?/g, 'bachelor of science in ')
    .replace(/\b(?:b a|ba|a b|ab|bachelor of arts)\s+(?:in\s+)?/g, 'bachelor of arts in ')
  return Boolean(key) && (` ${normalized} `).includes(` ${key} `)
}
export function equivalentProgram(target, name, excerpts = []) {
  if (programIdentityKey(target) === programIdentityKey(name)) return true
  const escaped = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')
  const definedAlias = new RegExp(`(?:${escaped(target)}\\s*\\(\\s*${escaped(name)}\\s*\\)|${escaped(name)}\\s*\\(\\s*${escaped(target)}\\s*\\))`, 'iu')
  return excerpts.some(({ text }) => definedAlias.test(text) || /\b(?:also known as|also called|abbreviated as|formerly known as|equivalent to)\b/i.test(text) && mentionsProgram(text, target) && mentionsProgram(text, name))
}

export function enforceProgramRelationship(value, courseName, adequate) {
  let relationship = value.relationship
  const evidence = relationship.excerpts
  const names = relationship.source_programs.filter(name => name.trim() && evidence.some(e => mentionsProgram(e.text, name)))
  const identity = names.some(name => equivalentProgram(courseName, name, evidence))
  const insufficient = explanation => ({ kind: 'Insufficient evidence', source_programs: names, explanation, excerpts: evidence })
  if (!relationship.explanation.trim() || relationship.kind !== 'Insufficient evidence' && (!names.length || !evidence.length)) relationship = insufficient('The current source does not establish the target program or a supported program relationship.')
  else if (relationship.kind === 'Same/equivalent program' && !identity) relationship = insufficient('The cited names do not establish the entered program or an explicitly supported equivalent name.')
  else if (['Related program only', 'Unrelated program'].includes(relationship.kind) && identity) relationship = insufficient('The relationship conflicts with the cited target program identity. Review target-specific passages.')
  else if (relationship.kind === 'Related program only' && !value.claims.some(claim => ['obtainable_skills', 'matching_profile_evidence', 'description'].includes(claim.field) && claim.support !== 'unresolved' && claim.excerpts.some(e => e.text.trim().length >= 30))) relationship = insufficient('Specific related skills or topics were not supported by the cited evidence. Shared generic keywords are insufficient.')
  else relationship = { ...relationship, source_programs: names }
  const same = relationship.kind === 'Same/equivalent program'
  const related = relationship.kind === 'Related program only'
  const claims = same ? value.claims : value.claims.map(claim => ({ ...claim,
    support: related && ['obtainable_skills', 'matching_profile_evidence'].includes(claim.field) && claim.excerpts.length ? 'inference' : 'unresolved',
    explanation: related && ['obtainable_skills', 'matching_profile_evidence'].includes(claim.field) && claim.excerpts.length
      ? `Related-program evidence only; target relevance requires review. ${claim.explanation}`
      : 'Not established for the entered course. Do not use another program’s name, duration or curriculum as target-course facts.',
  }))
  const reason = relationship.kind === 'Unrelated program' ? 'Course mismatch. ' + relationship.explanation
    : relationship.kind === 'Insufficient evidence' ? 'Target course not established. ' + relationship.explanation
      : related ? 'Related program only. ' + relationship.explanation
        : !adequate ? 'Target program identified, but adequate target-specific supporting information was not established.' : value.reason
  return { ...value, relationship, claims, reason,
    status: same && adequate && value.status === 'Potential Match' ? 'Potential Match' : 'Needs Review' }
}
