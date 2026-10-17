import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { createSourceAnalyzer, sourceAiConfiguration, validateSourceAnalysis, validateScannedSourceAnalysis } from '../services/sourceAiAnalysisService.js'
import { mentionsProgram, equivalentProgram } from '../services/sourceProgramRelationship.js'
import { detectCourseSupport } from '../services/sourceDetectionService.js'
import { SOURCE_PROMPT_VERSION, SOURCE_SCHEMA_VERSION } from '../services/sourceAnalysisPrompt.js'

const target = 'Bachelor of Science in Criminology'
const fields = ['course_name', 'description', 'duration', 'obtainable_skills']
const source = { url: 'https://ched.gov.ph/test', title: 'Synthetic reference', notes: '', supported_fields: [] }
const config = sourceAiConfiguration({ SOURCE_AI_ENABLED: 'true', OPENAI_API_KEY: 'mock-only' })
const passage = 'BS Criminology. Students study criminal investigation and forensic methods in a four-year program.'
const block = (text, location = 'Webpage block 1') => ({ text, location })
const value = (kind = 'Same/equivalent program', name = 'BS Criminology', text = passage) => ({
  status: 'Potential Match', reason: 'The cited passage supplies program information.',
  relationship: { kind, source_programs: name ? [name] : [], explanation: 'Compare the identified program and cited topics with the entered course.', excerpts: text ? [block(text)] : [] },
  claims: fields.map(field => ({ field, support: text ? 'direct' : 'unresolved', explanation: 'The source describes investigation and forensic methods.', excerpts: text ? [block(text)] : [] })),
  manual_review: ['Synthetic test only; no academic validation.'],
})
const response = result => new Response(JSON.stringify({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(result) }] }] }), { headers: { 'content-type': 'application/json' } })

test('documented degree abbreviations/equivalent names are accepted without guessing subject equivalence', () => {
  for (const name of ['BS Criminology', 'B.S. Criminology', 'BSc in Criminology', target]) {
    assert.equal(equivalentProgram(target, name), true)
    assert.equal(mentionsProgram(`${name}. Students study forensic science.`, target), true)
  }
  assert.equal(equivalentProgram(target, 'BS Forensic Science'), false)
  assert.equal(equivalentProgram(target, 'BS Criminology Major in Cybercrime'), false)
  assert.equal(equivalentProgram(target, 'BS Crim', [{ text: `${target} (BS Crim) teaches investigation.` }]), true)
  assert.equal(equivalentProgram(target, 'BS Crim'), false)
  const renamed = 'Bachelor of Science in Example Studies'
  assert.equal(equivalentProgram(target, renamed, [{ text: `${target} is also known as ${renamed}.` }]), true)
  assert.equal(equivalentProgram(target, renamed, [{ text: `${target} and ${renamed} share generic topics.` }]), false)
  assert.equal(validateSourceAnalysis(value(), [block(passage)], fields, target).status, 'Potential Match')
})

test('related, unrelated and missing evidence remain distinct AI findings, without basic fallback or imported target facts', async () => {
  const related = 'Bachelor of Science in Forensic Science. Students study forensic analysis, laboratory evidence and investigation techniques.'
  const unrelated = 'Bachelor of Science in Hospitality Management. Students study hotel operations and restaurant service.'
  for (const [kind, name, text] of [
    ['Related program only', 'Bachelor of Science in Forensic Science', related],
    ['Unrelated program', 'Bachelor of Science in Hospitality Management', unrelated],
    ['Insufficient evidence', '', ''],
  ]) {
    let calls = 0
    const analyze = createSourceAnalyzer({ fetchImpl: async () => { calls++; return response(value(kind, name, text)) } })
    const input = { parsed: { blocks: [block(text || 'An official document without any identified course details.')] }, courseName: target, url: source.url, source, contentHash: `fixture-${kind}`, contextHash: 'exact-claims', config }
    const result = await analyze(input)
    assert.equal(result.method, 'AI'); assert.equal(result.status, 'Needs Review')
    assert.equal(result.relationship.kind, kind)
    assert.equal(result.target_course_name, target)
    assert.equal(result.schema_version, SOURCE_SCHEMA_VERSION)
    assert.equal(result.prompt_version, SOURCE_PROMPT_VERSION)
    assert.equal(result.analysis_failure, undefined)
    for (const field of ['course_name', 'description', 'duration']) assert.equal(result.claims.find(c => c.field === field).support, 'unresolved')
    if (kind === 'Related program only') assert.equal(result.claims.find(c => c.field === 'obtainable_skills').support, 'inference')
    if (kind === 'Unrelated program') assert.match(result.reasons[0], /^Course mismatch/)
    if (kind === 'Insufficient evidence') assert.match(result.reasons[0], /^Target course not established/)
    const cached = await analyze(input)
    assert.equal(cached.cache_reused, true); assert.equal(calls, 1)
  }
})

test('unsupported identity or generic keyword relationship becomes insufficient, never a fabricated mismatch', () => {
  const text = 'Bachelor of Science in Example Studies. A university program is offered to students.'
  const unsupported = value('Same/equivalent program', 'Bachelor of Science in Example Studies', text)
  const result = validateSourceAnalysis(unsupported, [block(text)], fields, target)
  assert.equal(result.relationship.kind, 'Insufficient evidence'); assert.equal(result.status, 'Needs Review')
  const generic = value('Related program only', 'Bachelor of Science in Example Studies', text)
  generic.claims = generic.claims.map(c => ({ ...c, support: 'unresolved', excerpts: [] }))
  assert.equal(validateSourceAnalysis(generic, [block(text)], fields, target).relationship.kind, 'Insufficient evidence')
})

test('multi-program passages use the target section and do not borrow adjacent program details', () => {
  const other = block('Bachelor of Arts in History. Students study historical archives in a three-year program.', 'Webpage block 2')
  const targetBlock = block(passage, 'Webpage block 3')
  const result = value(); result.relationship.excerpts = [targetBlock]; result.claims = result.claims.map(c => ({ ...c, excerpts: [targetBlock] }))
  assert.equal(validateSourceAnalysis(result, [other, targetBlock], fields, target).status, 'Potential Match')
  assert.equal(detectCourseSupport({ blocks: [other, targetBlock] }, target, source.url).status, 'Potential Match')
  const listing = `Available programs: ${target}; Bachelor of Arts in History. Students study historical archives for three years.`
  assert.equal(detectCourseSupport({ blocks: [block(listing)] }, target, source.url).status, 'Needs Review')
  assert.equal(detectCourseSupport({ blocks: [block(target), { ...other, heading: true }] }, target, source.url).status, 'Needs Review')
})

test('relationship excerpts must be grounded and scanned page references bounded', () => {
  const bad = value(); bad.relationship.excerpts[0].text = 'Fabricated relationship evidence with no source support.'
  assert.throws(() => validateSourceAnalysis(bad, [block(passage)], fields, target), /Relationship evidence/)
  const scan = value()
  scan.relationship.excerpts = [{ text: passage, pdf_page: 20 }]
  scan.claims = scan.claims.map(c => ({ ...c, excerpts: [{ text: passage, pdf_page: 2 }] }))
  assert.throws(() => validateScannedSourceAnalysis(scan, 19, fields, target), /outside this 19-page/)
})

test('scanned relationship findings keep AI-read evidence and never fall back for a valid non-match', async () => {
  const bytes = Buffer.from('%PDF-synthetic-local-test-only')
  for (const [kind, name, text] of [
    ['Same/equivalent program', 'BS Criminology', passage],
    ['Related program only', 'BS Forensic Science', 'BS Forensic Science. Students study forensic analysis and evidence investigation methods.'],
    ['Unrelated program', 'BS Hospitality Management', 'BS Hospitality Management. Students study hotel operations and restaurant service.'],
  ]) {
    const result = value(kind, name, text)
    result.relationship.excerpts = [{ text, pdf_page: 2 }]
    result.claims = result.claims.map(c => ({ ...c, excerpts: [{ text, pdf_page: 2 }] }))
    let calls = 0
    const analyze = createSourceAnalyzer({ fetchImpl: async url => {
      calls++
      return url.endsWith('/input_tokens') ? new Response(JSON.stringify({ object: 'response.input_tokens', input_tokens: 57184 }), { headers: { 'content-type': 'application/json' } }) : response(result)
    } })
    const report = await analyze({ parsed: { blocks: [], pdf: { confirmed: true, pages: 19, readable_text: false } }, pdfBytes: bytes, courseName: target, url: source.url, source, contentHash: crypto.createHash('sha256').update(bytes).digest('hex'), contextHash: 'scan-test', config })
    assert.equal(calls, 2); assert.equal(report.method, 'AI')
    assert.equal(report.relationship.kind, kind)
    assert.equal(report.status, kind === 'Same/equivalent program' ? 'Potential Match' : 'Needs Review')
    assert.ok(report.relationship.excerpts.every(e => e.grounding === 'ai_read' && e.pdf_page === 2 && e.location === 'PDF page 2'))
  }
})

test('cache and in-flight identity remain bound to target, claims, content and prompt settings', async () => {
  let finish, calls = 0
  const analyze = createSourceAnalyzer({ fetchImpl: async () => { calls++; await new Promise(resolve => { finish = resolve }); return response(value()) } })
  const input = { parsed: { blocks: [block(passage)] }, courseName: target, url: source.url, source, contentHash: 'content-one', contextHash: 'context-one', config }
  const first = analyze(input)
  assert.match((await analyze(input)).analysis_notice, /duplicate/)
  finish(); await first
  assert.equal((await analyze(input)).cache_reused, true)
  for (const patch of [{ courseName: 'BS Forensic Science' }, { contextHash: 'changed-details' }, { contentHash: 'changed-source' }, { source: { ...source, supported_fields: ['duration'] } }, { config: { ...config, model: 'other-configured-model' } }, { config: { ...config, promptVersion: 'test-version' } }]) {
    const pending = analyze({ ...input, ...patch, config: { ...config, ...patch.config, requestsPerMinute: 20 } }); finish(); assert.notEqual((await pending).cache_reused, true)
  }
  assert.equal(calls, 7)
})
