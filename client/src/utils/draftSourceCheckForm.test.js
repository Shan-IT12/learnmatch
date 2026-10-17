import test from 'node:test'
import assert from 'node:assert/strict'
import { MAX_DRAFT_SOURCES, createDraftSource, enteredDraftSources, invalidatePendingReviews, sourceReportHeading, updatePendingSource, applyCurrentSourceResults, visibleSourceReport } from './draftSourceCheckForm.js'
import { pendingSourceBinding, pendingSourceAnalysisBinding } from '../../../shared/pendingSourceReview.js'
import { readFile } from 'node:fs/promises'

test('relationship headings distinguish explicit mismatch from missing evidence', () => {
  assert.equal(sourceReportHeading({ status: 'Needs Review', relationship: { kind: 'Unrelated program' } }), 'Needs Review — Course mismatch')
  assert.equal(sourceReportHeading({ status: 'Needs Review', relationship: { kind: 'Insufficient evidence' } }), 'Needs Review — Target course not established')
  assert.equal(sourceReportHeading({ status: 'Needs Review', relationship: { kind: 'Related program only' } }), 'Needs Review')
  assert.equal(sourceReportHeading({ status: 'Needs Review', fetch_status: 'failed', parse_status: 'not_attempted', relationship: { kind: 'Insufficient evidence' } }), 'Needs Review — Analysis not completed')
})

test('supported-information selection retains old analysis but invalidates its receipt and confirmation', () => {
  const form = { course_name: 'Synthetic local course', description: 'Original description' }
  const source = { ...createDraftSource(), title: 'Reference', url: 'https://ched.gov.ph/reference.pdf', notes: 'Page 2', supported_fields: [] }
  const report = { original_url: source.url, target_course_name: form.course_name, method: 'AI', reasons: ['Synthetic evidence'], excerpts: [{ text: 'Supporting text', pdf_page: 2 }], usage: { reported: { input_tokens: 57184 } } }
  const checked = { ...source, report, check_binding: pendingSourceAnalysisBinding(source, form), check_receipt: 'old-check', confirmation_receipt: 'old-confirmation', confirmation_binding: pendingSourceBinding(source, form) }
  const selected = invalidatePendingReviews([updatePendingSource(checked, { supported_fields: ['obtainable_skills'] })], form)[0]
  assert.equal(selected.report, null)
  assert.equal(visibleSourceReport(selected), report)
  assert.equal(selected.check_receipt, null)
  assert.equal(selected.confirmation_receipt, null)
  assert.equal(selected.confirmation_invalidated, true)
  assert.deepEqual(selected.supported_fields, ['obtainable_skills'])
  const again = invalidatePendingReviews([updatePendingSource(selected, { supported_fields: ['obtainable_skills', 'duration'] })], form)[0]
  assert.equal(visibleSourceReport(again), report)
  assert.equal(visibleSourceReport(invalidatePendingReviews([again], { ...form, description: 'Changed course' })[0]), undefined)
  assert.equal(visibleSourceReport(updatePendingSource(again, { url: 'https://ched.gov.ph/other.pdf' })), undefined)
  const snapshot = [{ id: selected.client_id, binding: pendingSourceAnalysisBinding(checked, form) }]
  assert.equal(applyCurrentSourceResults([selected], form, snapshot, [{ report, check_receipt: 'late-response' }])[0], selected)
  const fresh = applyCurrentSourceResults([selected], form, [{ id: selected.client_id, binding: pendingSourceAnalysisBinding(selected, form) }], [{ report, check_receipt: 'new-check' }])[0]
  assert.equal(fresh.previous_analysis, null)
  assert.equal(fresh.check_receipt, 'new-check')
})

test('late asynchronous results cannot restore checks or confirmations after relevant edits', () => {
  const form = { course_name: 'Synthetic manual course', description: 'Original description', obtainable_skills: 'Keep skills' }
  const source = { ...createDraftSource(), title: 'Keep title', url: 'https://ched.gov.ph/test', notes: 'Keep notes', supported_fields: ['description'] }
  const snapshot = [{ id: source.client_id, binding: pendingSourceAnalysisBinding(source, form) }]
  const result = [{ report: { original_url: source.url, target_course_name: form.course_name, method: 'AI' }, check_receipt: 'signed-result' }]
  const changed = { ...form, description: 'Changed manually' }
  assert.equal(applyCurrentSourceResults([source], changed, snapshot, result)[0], source)
  assert.equal(applyCurrentSourceResults([{ ...source, url: 'https://ched.gov.ph/changed' }], form, snapshot, result)[0].report, undefined)
  const current = applyCurrentSourceResults([source], form, snapshot, result)[0]
  assert.equal(current.check_receipt, 'signed-result'); assert.equal(current.confirmation_receipt, null)
  assert.equal(invalidatePendingReviews([current], changed)[0].report, null)
  assert.equal(invalidatePendingReviews([current], { ...form, obtainable_skills: 'Changed core information' })[0].report, null)
  assert.equal(invalidatePendingReviews([current], { ...form, ui_only: 'Unrelated edit' })[0].report, current.report)
  for (const key of ['title', 'url', 'notes', 'supported_fields']) assert.deepEqual(current[key], source[key])
  assert.equal(applyCurrentSourceResults([], form, snapshot, result).length, 0)
})

test('AI UI remains explicit and text-only, with manual review separate and no autofill', async () => {
  const editor = await readFile(new URL('../components/admin/SourceFirstDraftSources.jsx', import.meta.url), 'utf8')
  const details = await readFile(new URL('../components/admin/SourceAnalysisDetails.jsx', import.meta.url), 'utf8')
  assert.match(editor, /Check Sources with AI/)
  assert.match(editor, /onClick=\{check\}/)
  assert.match(details, /<strong>Analysis method:<\/strong>/)
  assert.doesNotMatch(details, /dangerouslySetInnerHTML|innerHTML|marked|markdown/i)
  assert.match(editor, /Basic is used when AI is disabled or unavailable and readable text exists/)
  assert.match(editor, /Scanned PDFs may not be readable/)
  assert.match(editor, /inFlight.current\) return/)
  assert.match(editor, /applyCurrentSourceResults\(current, latestForm.current/)
  assert.doesNotMatch(editor, /dangerouslySetInnerHTML|setCourseForm|Apply Selected Details|candidate|OCR|onChange=\{check\}/)
})

test('three-link policy and target/relevant edit invalidation preserve manual confirmations',()=>{
  assert.equal(MAX_DRAFT_SOURCES,3)
  const form={course_name:'Bachelor of Science in Biology',description:'Manual description',obtainable_skills:'Manual skills',cluster_category:'BUSINESS CLUSTER'}
  const source={title:'Source',url:'https://example.edu',notes:'',supported_fields:['description'],report:{target_course_name:form.course_name,original_url:'https://example.edu'},check_receipt:'signed-check',confirmation_receipt:'signed-confirmation'}
  source.confirmation_binding=pendingSourceBinding(source,form)
  assert.equal(invalidatePendingReviews([source],form)[0].confirmation_receipt,'signed-confirmation')
  assert.equal(invalidatePendingReviews([source],{...form,obtainable_skills:'Unrelated'})[0].confirmation_receipt,'signed-confirmation')
  assert.equal(invalidatePendingReviews([source],{...form,description:'Changed'})[0].confirmation_receipt,null)
  const changed=invalidatePendingReviews([source],{...form,course_name:'Another course'})[0]
  assert.equal(changed.report,null);assert.equal(changed.check_receipt,null);assert.equal(changed.confirmation_receipt,null)
  assert.equal(invalidatePendingReviews([changed],form)[0].check_receipt,null)
})

test('URL changes immediately discard check and confirmation, including change/revert, without clearing draft inputs', () => {
  const form = { course_name: 'Synthetic draft', description: 'Retain description', skill_profile: [{ skill_domain: 'Verbal', weight: 2, evidence: 'Retain evidence' }] }
  const original = { client_id: 'fixture', title: 'Retain title', url: 'https://example.edu/old', notes: 'Retain notes', supported_fields: ['description'], report: { target_course_name: form.course_name, original_url: 'https://example.edu/old' }, check_receipt: 'old-check', confirmation_receipt: 'old-confirmation' }
  original.confirmation_binding = pendingSourceBinding(original, form)
  const snapshot = structuredClone({ original, form })
  for (const url of ['https://example.edu/new', 'https://ched.com.nz', 'https://ched.gov.ph.fake-site.com', 'https://fake-site.com/ched.gov.ph']) {
    const changed = updatePendingSource(original, { url })
    for (const key of ['report', 'check_receipt', 'confirmation_receipt', 'confirmation_binding']) assert.equal(changed[key], null)
    assert.equal(changed.confirmation_invalidated, true)
    assert.equal(changed.title, original.title); assert.equal(changed.notes, original.notes)
    assert.deepEqual(changed.supported_fields, original.supported_fields)
    const reverted = updatePendingSource(changed, { url: original.url })
    assert.equal(reverted.check_receipt, null); assert.equal(reverted.confirmation_receipt, null)
    const indirect = invalidatePendingReviews([{ ...original, url }], form)[0]
    assert.equal(indirect.report, null); assert.equal(indirect.check_receipt, null); assert.equal(indirect.confirmation_receipt, null)
  }
  assert.deepEqual({ original, form }, snapshot)
  assert.equal(updatePendingSource(original, { url: original.url }).check_receipt, 'old-check')
})
test('results show only detection status and relevant failure wording',()=>{
  assert.equal(sourceReportHeading({status:'Potential Match'}),'Potential Match')
  assert.equal(sourceReportHeading({status:'Needs Review',parse_status:'succeeded',publisher_origin:{verified:false}}),'Needs Review \u2014 Source origin not verified')
  assert.equal(sourceReportHeading({status:'Needs Review',error_code:'SIZE_LIMIT'}),'Needs Review \u2014 Source exceeds the download limit.')
})


test('blank optional slots are ignored while entered values and review receipts are preserved',()=>{
  const first=createDraftSource(),second=createDraftSource(),third=createDraftSource()
  assert.notEqual(first.client_id,second.client_id)
  assert.deepEqual(enteredDraftSources([first,second,third]),[])
  const used={...first,title:'Manual title',url:'https://example.edu',supported_fields:['course_name'],check_receipt:'check',confirmation_receipt:'confirmation'}
  assert.deepEqual(enteredDraftSources([used,second,third]),[used])
  assert.equal(enteredDraftSources([{...second,url:'  '}]).length,0)
  assert.equal(enteredDraftSources([{...second,notes:'Started but incomplete'}]).length,1)
  assert.equal(enteredDraftSources([{...second,supported_fields:['duration']}]).length,1)
  const removed=[used,second,third].filter(source=>source.client_id!==second.client_id)
  assert.equal(removed[0],used)
  assert.equal(removed.length,2)
})
