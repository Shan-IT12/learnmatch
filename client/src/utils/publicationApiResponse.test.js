import test from 'node:test'
import assert from 'node:assert/strict'
import { readPublicationJson } from './publicationApiResponse.js'

const context = { url: 'http://localhost:5000/api/admin/courses/123/publication', method: 'GET' }
test('publication JSON retains readiness and field-level blocker responses', async () => {
  for (const [status, body] of [[200, { ready: false, fieldErrors: { matching_review: 'Separate review required.' } }], [422, { message: 'Publication blocked.', fieldErrors: { sources: 'Confirm sources.' } }], [409, { message: 'Saved revision changed.' }]]) {
    assert.deepEqual(await readPublicationJson(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } }), context), body)
  }
})
test('backend HTML 404 and Vite HTML 200 produce actionable errors without rendering HTML', async () => {
  for (const [status, url] of [[404, context.url], [200, context.url.replace(':5000', ':5173')]]) {
    await assert.rejects(readPublicationJson(new Response('<!DOCTYPE html><p>private response body</p>', { status, headers: { 'Content-Type': 'text/html' } }), { ...context, url }), error => {
      assert.ok(error.message.includes(`GET ${url}; HTTP ${status}`))
      assert.match(error.message, /instead of JSON.*Check the API URL/s)
      assert.doesNotMatch(error.message, /private response body|<!DOCTYPE|Unexpected token/)
      return true
    })
  }
})
test('non-JSON POST failures and redirects include safe request diagnostics', async () => {
  const response = { status: 502, redirected: true, url: 'http://localhost:5173/login?token=secret', headers: new Headers({ 'Content-Type': 'text/plain' }) }
  await assert.rejects(readPublicationJson(response, { url: 'http://user:password@localhost:5000/api/admin/courses/123/publication/publish?token=secret', method: 'POST' }), error => {
    assert.match(error.message, /POST http:\/\/localhost:5000\/api\/admin\/courses\/123\/publication\/publish; HTTP 502; redirected to http:\/\/localhost:5173\/login/)
    assert.doesNotMatch(error.message, /secret|password|user:/)
    return true
  })
})
test('malformed JSON with JSON Content-Type produces a useful error', async () => {
  await assert.rejects(readPublicationJson(new Response('<html>not JSON</html>', { headers: { 'Content-Type': 'application/json' } }), context), /Publication API returned invalid JSON.*HTTP 200/)
})
