import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'
import { setImmediate } from 'node:timers'
import { courseListLocation, readCourseListLocation, matchesCourseStatus } from './courseListNavigation.js'

test('saved drafts include only draft records, not inactive legacy or published records', () => {
  const rows = [{ course_id: 1, is_draft: 1, is_active: 0 }, { course_id: 2, is_draft: '1', is_active: 0 }, { course_id: 3, is_draft: 0, is_active: 0 }, { course_id: 4, is_draft: 0, is_active: 1 }]
  assert.deepEqual(rows.filter(row => matchesCourseStatus(row, 'draft')).map(row => row.course_id), [1, 2])
  assert.equal(rows.filter(row => matchesCourseStatus(row, 'all')).length, 4)
  assert.equal(rows.filter(row => matchesCourseStatus(row, 'inactive')).length, 3)
  assert.equal(rows.filter(row => matchesCourseStatus(row, 'active')).length, 1)
})

test('draft list, saved view, Add and Back preserve encoded list filters across refresh/history', () => {
  const filters = { search: 'Accountancy & Tax', cluster: 'BUSINESS CLUSTER', status: 'draft', sort: 'code-desc', scope: 'all' }
  const list = courseListLocation(filters)
  const saved = courseListLocation(filters, { courseId: 428 })
  const add = courseListLocation(filters, { add: true })
  for (const url of [list, saved, add]) {
    const route = readCourseListLocation(new URL(url, 'http://localhost').search)
    for (const key of Object.keys(filters)) assert.equal(route[key], filters[key])
    assert.equal(courseListLocation(route), list)
  }
  const history = [list, saved, add]
  assert.equal(readCourseListLocation(history[1].split('?')[1]).courseId, 428)
  assert.equal(readCourseListLocation(history[0].split('?')[1]).status, 'draft')
  assert.equal(readCourseListLocation(history[2].split('?')[1]).add, true)
  assert.deepEqual(readCourseListLocation('?status=unknown&sort=unknown&course=-1'), { search: '', cluster: 'all', status: 'all', sort: 'name-asc', scope: 'current', courseId: null, add: false })
})

test('draft entry controls and both Back links reuse navigation without writing course data', async () => {
  const page = await readFile(new URL('../pages/admin/ManageCourses.jsx', import.meta.url), 'utf8')
  assert.match(page, /View Drafts \(\$\{draftCount\}\)/)
  assert.match(page, /draftsView \? 'Saved Drafts' : archivedView \? 'Archived Course Identities' : 'Manage Courses'/)
  assert.match(page, /<option value="draft">Drafts only/)
  assert.equal((page.match(/onClick=\{backToList\}/g) || []).length, 1)
  assert.match(page, /onClick=\{editingCourseId \? backToSavedCourse : backToList\}/)
  assert.equal((page.match(/draftsView \? 'Back to Drafts' : 'Back to Courses'/g) || []).length, 2)
  assert.match(page, /useEffect\(\(\) => \{ syncCourseLocation\(\) \}, \[location.key, location.search\]\)/)
  assert.match(page, /requestSequence !== courseLoadSequence.current/)
  assert.match(page, /navigate\(courseListLocation\(listFilters, \{ courseId: data.courseId \|\| editingCourseId \}\), \{ replace: true \}\)/)
  const navigation = page.slice(page.indexOf('  const backToList'), page.indexOf('  useEffect', page.indexOf('  const backToList')))
  assert.doesNotMatch(navigation, /fetch\(|POST|PUT|DELETE|confirmed: true/)
})

test('typing and clearing search do not reload the course list when router navigation changes', async () => {
  const page = await readFile(new URL('../pages/admin/ManageCourses.jsx', import.meta.url), 'utf8')
  const loader = page.slice(page.indexOf('  const loadCourseList ='), page.indexOf('  const openNewCourseForm'))
  assert.ok(loader.includes('loadCourseList()'))
  let latestEvent, previousDependencies
  let requests = 0
  const loading = []
  const pending = []
  const stableEvent = (...args) => latestEvent(...args)
  const context = {
    adminToken: 'mock-admin', navigate: () => {},
    useEffectEvent: callback => { latestEvent = callback; return stableEvent },
    useEffect: (callback, dependencies) => {
      if (!previousDependencies || dependencies.some((value, index) => value !== previousDependencies[index])) callback()
      previousDependencies = dependencies
    },
    setLoading: value => loading.push(value),
    fetch: () => {
      requests++
      const result = Promise.resolve({ json: async () => ({ courses: [], draftOptions: {} }) })
      pending.push(result)
      return result
    },
    handleUnauthorized: () => false, setCourses: () => {}, setDraftOptions: () => {},
    setError: message => assert.fail(message),
  }
  const code = loader.replaceAll('import.meta.env.VITE_API_URL', "'http://mock.invalid'")
  for (const search of ['', 'a', 'ac', 'acc', '']) {
    context.navigate = () => courseListLocation({ search })
    vm.runInNewContext(`(() => { ${code} })()`, context)
    await Promise.all(pending)
    await new Promise(resolve => setImmediate(resolve))
  }
  assert.equal(requests, 1)
  assert.deepEqual(loading, [true, false])
  context.adminToken = 'different-mock-admin'
  vm.runInNewContext(`(() => { ${code} })()`, context)
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(requests, 2, 'a changed login must still reload the list')

  const input = page.slice(page.indexOf('                    <input', page.indexOf('<IconSearch')), page.indexOf('                  <div className="grid', page.indexOf('<IconSearch')))
  assert.match(input, /type="text"/)
  assert.match(input, /role="searchbox"/)
  assert.equal((input.match(/aria-label="Clear course search"/g) || []).length, 1)
  assert.match(input, /onChange=\{\(event\) => updateListFilters\(\{ search: event.target.value \}\)\}/)
})
