import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'

const page = fs.readFileSync(new URL('../pages/admin/ManageCourses.jsx', import.meta.url), 'utf8')
const handler = page.slice(page.indexOf('const handleSaveCourse ='), page.indexOf('const handleStatusChange =')).replaceAll('import.meta.env.VITE_API_URL', "'http://localhost:5000'")

async function run({ editing = false, draft = true, ok = true, invalid = false } = {}) {
  const events = []
  const noop = () => {}
  const context = {
    publication: null, saving: false, sourceWorking: false, sourceEditorOpen: false,
    courseForm: { course_name: invalid ? '' : 'Example course', cluster_category: 'BUSINESS CLUSTER' },
    editingCourseId: editing ? 7 : null, editingDraft: draft, initialCourseForm: null,
    draftOptions: {}, pendingSources: [], adminToken: 'mock', sessionStorage: {}, draftSessionKey: 'mock', listFilters: {},
    buildDraftPayload: () => ({ errors: {}, payload: {} }), enteredDraftSources: () => [],
    setFieldErrors: noop, scrollToFirstInvalidField: noop, setError: message => events.push(['error', message]),
    setSaving: noop, setSaveSuccess: message => events.push(['success', message]),
    fetch: async (_url, options) => { events.push(['request', options.method]); return { ok, json: async () => ({ courseId: 7, course_code: 'CRS007', message: 'Save rejected' }) } },
    handleUnauthorized: () => false, waitForSuccessConfirmation: async () => events.push(['animate']),
    clearNewCourseDraftSession: noop, setEditingCourseId: noop, setDraftSourceCheckAllowed: noop,
    setEditingCourseCode: noop, setInitialCourseForm: noop, setPendingSources: noop, setSourceRefreshKey: noop,
    openEditCourseForm: async () => events.push(['reload']), navigate: noop, courseListLocation: () => '/admin/courses', fetchCourses: async () => {},
    window: { confirm: () => { throw Error('Unexpected pre-save confirmation') } },
  }
  await vm.runInNewContext(`${handler}\nhandleSaveCourse({ preventDefault() {} })`, context)
  return events
}

test('successful Add Draft, Edit Draft and Edit Course show the shared checkmark after saving, then reload', async () => {
  for (const [options, message, method] of [
    [{}, 'Draft saved successfully', 'POST'],
    [{ editing: true }, 'Draft changes saved successfully', 'PUT'],
    [{ editing: true, draft: false }, 'Course updated successfully', 'PUT'],
  ]) {
    const events = await run(options)
    assert.deepEqual(events.filter(([type]) => type !== 'error'), [['request', method], ['success', message], ['animate'], ['reload'], ['success', '']])
  }
  assert.match(page, /<SuccessConfirmation message=\{saveSuccess\}/)
})

test('rejected save or invalid fields never display success; invalid fields do not submit', async () => {
  const rejected = await run({ ok: false })
  assert.equal(rejected.filter(([type]) => type === 'request').length, 1)
  assert.ok(!rejected.some(([type, message]) => type === 'success' && message))
  assert.ok(!rejected.some(([type]) => type === 'reload' || type === 'animate'))
  const invalid = await run({ invalid: true })
  assert.ok(!invalid.some(([type]) => ['request', 'success', 'reload', 'animate'].includes(type)))
})
