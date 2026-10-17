import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { emptyDraftFields } from './courseDraftForm.js'
import { newCourseDraftSessionKey, readNewCourseDraftSession, writeNewCourseDraftSession, clearNewCourseDraftSession } from './newCourseDraftSession.js'

const defaults = { ...emptyDraftFields, course_name: '', cluster_category: '', description: '', obtainable_skills: '' }
const token = id => `header.${btoa(JSON.stringify({ adminId: id }))}.not-a-real-signature`
const storage = () => {
  const entries = new Map()
  return { getItem: key => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value), removeItem: key => entries.delete(key) }
}

test('refresh restores the Add Draft view, all entered fields and sources without fetching', () => {
  const tab = storage(), key = newCourseDraftSessionKey(token(7))
  const form = { ...defaults, course_name: 'Synthetic local course', course_abbreviation: 'TEST', description: 'Entered description', cluster_category: 'CRIMINOLOGY CLUSTER', obtainable_skills: 'Manual skills', program_duration_years: 1, year_levels: [{ year: 1, label: 'First year', overview: 'Entered overview' }], skill_profile: [{ skill_domain: 'Test domain', weight: 2, evidence: 'Entered reference' }], riasec_profile: defaults.riasec_profile.map(row => ({ ...row, weight: 0, evidence: 'Synthetic evidence' })) }
  const sources = [{ client_id: 'source-1', title: 'Entered title', url: 'https://ched.gov.ph/test.pdf', notes: 'Page 2', supported_fields: ['course_name'], check_binding: 'existing-binding', report: { method: 'AI', excerpts: [{ pdf_page: 2, text: 'Synthetic passage' }], usage: { reported: { input_tokens: 123 } } } }]
  assert.equal(writeNewCourseDraftSession(tab, key, form, sources, true), true)
  // A fresh read models initialization after a reload, not a server save.
  assert.deepEqual(readNewCourseDraftSession(tab, key, defaults), { form, sources, active: true })
  assert.equal(readNewCourseDraftSession(tab, newCourseDraftSessionKey(token(8)), defaults), null)
  assert.doesNotMatch(tab.getItem(key), /not-a-real-signature/)
})

test('returning to the list retains inputs without reopening, and successful save clears recovery', () => {
  const tab = storage(), key = newCourseDraftSessionKey(token(7))
  writeNewCourseDraftSession(tab, key, defaults, [], false)
  assert.equal(readNewCourseDraftSession(tab, key, defaults).active, false)
  clearNewCourseDraftSession(tab, key)
  assert.equal(readNewCourseDraftSession(tab, key, defaults), null)
})

test('corrupt, incompatible or unavailable storage does not crash or restore invalid structure', () => {
  const tab = storage(), key = newCourseDraftSessionKey(token(7))
  for (const value of ['not json', '{}', JSON.stringify({ version: 1, form: { ...defaults, year_levels: null }, sources: [] }), JSON.stringify({ version: 1, form: { ...defaults, riasec_profile: [null] }, sources: [] }), JSON.stringify({ version: 1, form: defaults, sources: Array(4).fill({}) })]) {
    tab.setItem(key, value)
    assert.equal(readNewCourseDraftSession(tab, key, defaults), null)
  }
  const blocked = { getItem() { throw Error('blocked') }, setItem() { throw Error('quota') }, removeItem() { throw Error('blocked') } }
  assert.equal(readNewCourseDraftSession(blocked, key, defaults), null)
  assert.equal(writeNewCourseDraftSession(blocked, key, defaults, [], true), false)
  assert.doesNotThrow(() => clearNewCourseDraftSession(blocked, key))
  for (const value of [null, '', 'invalid', token('7')]) assert.equal(newCourseDraftSessionKey(value), null)
})

test('recovery is limited to new drafts and never automatically saves or confirms', async () => {
  const page = await readFile(new URL('../pages/admin/ManageCourses.jsx', import.meta.url), 'utf8')
  assert.match(page, /view !== 'form' \|\| editingCourseId \|\| !editingDraft/)
  assert.match(page, /restoredDraft\?\.active \? 'form' : 'list'/)
  assert.match(page, /clearNewCourseDraftSession\(sessionStorage, draftSessionKey\)/)
  const recovery = await readFile(new URL('./newCourseDraftSession.js', import.meta.url), 'utf8')
  assert.doesNotMatch(recovery, /fetch\(|localStorage|confirmUnsaved|publish|setTimeout/)
})
