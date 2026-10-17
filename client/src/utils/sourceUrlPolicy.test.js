import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { parseApprovedSourceHosts, sourceUrlError, validateApprovedCourseSource, hasInvalidSourceUrls, EMPTY_SOURCE_HOSTS } from '../../../shared/sourceUrlPolicy.js'

const policy = { hosts: parseApprovedSourceHosts('official.example.edu,legacy.official.example.edu') }
test('CHED-looking text never approves a different actual hostname', () => {
  const official = { hosts: ['ched.gov.ph'] }
  assert.equal(sourceUrlError('https://ched.gov.ph/program.pdf', official), '')
  for (const url of ['https://ched.com.nz', 'https://ched.gov.ph.fake-site.com', 'https://fake-site.com/ched.gov.ph']) {
    assert.ok(sourceUrlError(url, official), url)
    assert.equal(sourceUrlError(url, { hosts: [new URL(url).hostname] }), '', 'Only explicit actual-host approval can permit it')
  }
})
test('only parsed exact approved hostnames pass; no TLD, path, suffix or subdomain inference', () => {
  for (const url of ['https://official.example.edu/program.pdf', 'http://OFFICIAL.EXAMPLE.EDU/course', 'https://legacy.official.example.edu/course', 'https://official.example.edu:443/course']) assert.equal(sourceUrlError(url, policy), '')
  for (const url of ['https://youtube.com/watch?v=x', 'https://youtu.be/x', 'https://facebook.com/x', 'https://bit.ly/x', 'https://adult.example/x', 'https://other.gov.ph/course', 'https://other.edu.ph/course', 'https://official.example.edu.evil.com/x', 'https://sub.official.example.edu/x', 'https://evil.com/official.example.edu', 'https://official-example.edu/x', 'https://оfficial.example.edu/x', 'https://user:password@official.example.edu/x', 'https://official.example.edu@evil.com/x', 'https://@official.example.edu/x', 'https://official.example.edu:8443/x', 'javascript:alert(1)', 'data:text/html,x', 'file:///C:/reference.pdf', 'https://evil.com\\@official.example.edu/x', 'http://127.0.0.1:8765/reference.html', 'http://localhost:8765/reference.html']) assert.ok(sourceUrlError(url, policy), url)
})
test('empty, unavailable and malformed configuration fail closed without making blank optional slots required', () => {
  assert.equal(sourceUrlError('https://official.example.edu', { hosts: [] }), EMPTY_SOURCE_HOSTS)
  assert.match(sourceUrlError('https://official.example.edu', undefined), /configuration could not be loaded/)
  for (const value of ['*.edu.ph', 'https://official.example.edu', 'official.example.edu:443', 'official..example.edu', `${'a'.repeat(64)}.edu`, '127.0.0.1']) assert.throws(() => parseApprovedSourceHosts(value))
  assert.equal(hasInvalidSourceUrls([{ url: '' }, { url: '   ' }], { hosts: [] }), false)
  assert.equal(hasInvalidSourceUrls([{ url: 'https://youtube.com/x' }], policy), true)
  assert.equal(hasInvalidSourceUrls([{ url: 'https://official.example.edu' }, { url: '' }], policy), false)
  assert.ok(validateApprovedCourseSource({ title: 'Source', url: 'https://evil.com/official.example.edu', supported_fields: ['description'] }, policy).errors.url)
})
test('Add form validates paste/blur, links inline URL errors, and blocks checks, confirmation and saves', async () => {
  const editor = await readFile(new URL('../components/admin/SourceFirstDraftSources.jsx', import.meta.url), 'utf8')
  const page = await readFile(new URL('../pages/admin/ManageCourses.jsx', import.meta.url), 'utf8')
  assert.match(editor, /onPaste=/); assert.match(editor, /onBlur=/)
  assert.match(editor, /aria-describedby=.*source-\$\{source.client_id\}-\$\{key\}-error/)
  assert.match(editor, /<FieldError id=.*errorsFor\(source\)\[key\]/)
  assert.match(editor, /disabled=\{busy \|\| invalidUrls/)
  assert.match(editor, /Boolean\(sourceUrlError\(source.url, sourceUrlPolicy\)\)/)
  assert.match(page, /hasInvalidSourceUrls\(pendingSources, draftOptions\?\.source_url_policy\)/)
  assert.match(page, /validateApprovedCourseSource\(source, draftOptions\?\.source_url_policy\)/)
  // Native paste/caret behavior is preserved; validation does not replace field contents.
  const paste = editor.slice(editor.indexOf('onPaste='), editor.indexOf('}} /><FieldError'))
  assert.doesNotMatch(paste, /fetch\(|preventDefault\(/)
})
