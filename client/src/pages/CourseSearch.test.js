import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { getCourseCatalogUrl } from '../utils/courseCatalog.js'

const source = await readFile(new URL('./CourseSearch.jsx', import.meta.url), 'utf8')

test('Course Explorer supports searching, sorting, and pagination without browse controls', async () => {
  assert.match(source, /<form onSubmit=\{submit\}/)
  assert.match(source, />Search<\/button>/)
  assert.doesNotMatch(source, /Browse Courses/)
  assert.doesNotMatch(source, /browseCourses/)
  assert.match(source, /<option value="asc">A–Z<\/option>/)
  assert.match(source, /<option value="desc">Z–A<\/option>/)
  assert.match(source, /fetch\(getCourseCatalogUrl\(apiUrl, query\)/)
  assert.match(source, /const COURSES_PER_PAGE = 18/)
  assert.match(source, /visibleCourses\.map/)
  assert.match(source, /course\.cluster_category/)
  assert.match(source, /View course details/)
  assert.match(source, /Page \{page\} of \{pageCount\}/)
})

test('query searches keep using the course-search endpoint', () => {
  assert.equal(getCourseCatalogUrl('https://example.test', ''), 'https://example.test/api/public/courses')
  assert.equal(getCourseCatalogUrl('', '   '), '/api/public/courses')
  assert.equal(
    getCourseCatalogUrl('', 'information technology'),
    '/api/public/courses/search?q=information%20technology'
  )
  assert.match(source, /if \(!query\) \{\s*return/)
  assert.match(source, /fetch\(getCourseCatalogUrl\(apiUrl, query\)/)
})

test('landing Course Explorer keeps search without a browse control', async () => {
  const landing = await readFile(new URL('./Landing.jsx', import.meta.url), 'utf8')
  const explorer = landing.slice(landing.indexOf('Explore the course catalog'), landing.indexOf('<dl className="mt-6'))
  assert.match(explorer, /<form onSubmit=\{handleSearch\}/)
  assert.match(explorer, /type="submit"[\s\S]*Search/)
  assert.doesNotMatch(explorer, /Browse Courses/)
})
