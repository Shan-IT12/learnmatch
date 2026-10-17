import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import jwt from 'jsonwebtoken'
import pool from '../config/db.js'
import authenticateAdmin from '../middleware/authenticateAdmin.js'
import { jwtSignOptions, ADMIN_JWT_AUDIENCE } from '../config/security.js'
import { createSourceCheckRouter } from '../routes/sourceCheckRoutes.js'
import { checkUnsavedSource } from '../services/sourceCheckService.js'
import { htmlBlocks } from '../services/sourceTextReading.js'
import { createSourceAnalyzer, sourceAiConfiguration } from '../services/sourceAiAnalysisService.js'

test('pre-save HTTP check/confirmation use real admin auth, no course ID and bounded requests', async (t) => {
  const priorHosts = process.env.SOURCE_APPROVED_PUBLISHER_HOSTS
  process.env.SOURCE_APPROVED_PUBLISHER_HOSTS = 'example.edu'
  const priorSecret = process.env.JWT_SECRET
  const priorQuery = pool.query
  process.env.JWT_SECRET = 'pre-save-route-unit-test-secret'
  pool.query = async (sql, args) => { assert.match(sql, /^SELECT admin_id FROM ADMIN/); return [[{ admin_id: args[0] }]] }
  let checks = 0
  const checker = async (url, adminId, options) => {
    checks++
    return checkUnsavedSource(url, adminId, { ...options, analyze: args => createSourceAnalyzer()({ ...args, config: sourceAiConfiguration({}) }), fetch: async () => ({ bytes: Buffer.from('<h1>Bachelor of Science in Biology</h1><p>Description: Students study laboratory methods and biological sciences.</p>'), type: 'text/html', final_url: url }), parse: async (bytes) => htmlBlocks(bytes.toString()) })
  }
  const app = express()
  app.use(express.json())
  app.use('/api/admin/course-sources', createSourceCheckRouter(authenticateAdmin, checker))
  const server = app.listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  t.after(async () => { if (priorHosts === undefined) delete process.env.SOURCE_APPROVED_PUBLISHER_HOSTS; else process.env.SOURCE_APPROVED_PUBLISHER_HOSTS = priorHosts; await new Promise((resolve) => server.close(resolve)); pool.query = priorQuery; if (priorSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = priorSecret; await pool.end() })
  const token = (adminId = 7, role = 'admin') => jwt.sign({ adminId, role }, process.env.JWT_SECRET, jwtSignOptions(ADMIN_JWT_AUDIENCE, '5m'))
  const request = async (action, body, bearer = token()) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/admin/course-sources/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}) }, body: JSON.stringify({ course_name: 'Bachelor of Science in Biology', ...body }) })
    return { status: response.status, body: await response.json() }
  }
  assert.equal((await request('check', { urls: ['https://example.edu'] }, null)).status, 401)
  assert.equal((await request('check', { urls: ['https://example.edu'] }, token(7, 'student'))).status, 403)
  assert.equal(checks, 0)
  const statusUrl = `http://127.0.0.1:${server.address().port}/api/admin/course-sources/status`
  assert.equal((await fetch(statusUrl)).status, 401)
  assert.equal((await fetch(statusUrl, { headers: { Authorization: `Bearer ${token(7, 'student')}` } })).status, 403)
  const runtime = await fetch(statusUrl, { headers: { Authorization: `Bearer ${token()}` } })
  assert.equal(runtime.status, 200)
  const runtimeBody = await runtime.json()
  assert.equal(runtimeBody.source_ai.pdf_input_cap, 65000)
  assert.equal(runtimeBody.source_ai.pdf_timeout_ms, 60000)
  assert.equal(runtimeBody.source_ai.pdf_model, 'gpt-6-luna')
  assert.equal(runtimeBody.source_ai.pdf_detail, 'high')
  assert.equal(runtimeBody.source_ai.fetch_timeout_ms, 10000)
  assert.equal(runtimeBody.source_ai.parser_timeout_ms, 6000)
  assert.equal(runtimeBody.source_ai.token_count_timeout_ms, 15000)
  assert.doesNotMatch(JSON.stringify(runtimeBody), /apiKey|OPENAI_API_KEY|Bearer/)
  assert.equal(checks, 0)
  assert.equal((await request('check', { urls: Array(4).fill('https://example.edu') })).status, 400)
  const checked = await request('check', { urls: ['https://example.edu'], course: { course_name: 'Bachelor of Science in Biology' }, sources: [{ title: 'Reference', url: 'https://example.edu', supported_fields: ['course_name'], notes: '' }] })
  assert.equal(checked.status, 200)
  const result = checked.body.results[0]
  assert.ok(result.report.context_sha256)
  assert.equal(result.report.status, 'Potential Match')
  assert.ok(result.report.excerpts.length)
  assert.equal(Object.hasOwn(result.report,'suggestions'),false)
  const source = { title: 'Reference', url: 'https://example.edu', supported_fields: ['course_name'], notes: '' }
  assert.equal((await request('check', { urls: ['https://example.edu'], course_name: '' })).status, 400)
  const three = await request('check', { urls: ['https://example.edu/a','https://example.edu/b','https://example.edu/c'] })
  assert.equal(three.status, 200)
  assert.equal(three.body.results.length, 3)
  const confirmed = await request('confirm', { source, course: { course_name: 'Bachelor of Science in Biology' }, confirmed: true, check_receipt: result.check_receipt, reviewer_id: 999 })
  assert.equal(confirmed.status, 200)
  assert.ok(confirmed.body.confirmation_receipt)
  assert.equal((await request('confirm', { source, course: { course_name: 'Bachelor of Arts in History' }, confirmed: true, check_receipt: result.check_receipt })).status, 409)
  let limited = false
  for (let i = 0; i < 11; i++) if ((await request('check', { urls: ['https://example.edu'] })).status === 429) { limited = true; break }
  assert.ok(limited)
})


test('overlapping checks are rejected and disconnect cancels reading', async (t) => {
  const priorHosts = process.env.SOURCE_APPROVED_PUBLISHER_HOSTS
  process.env.SOURCE_APPROVED_PUBLISHER_HOSTS = 'example.edu'
  t.after(() => { if (priorHosts === undefined) delete process.env.SOURCE_APPROVED_PUBLISHER_HOSTS; else process.env.SOURCE_APPROVED_PUBLISHER_HOSTS = priorHosts })
  const options = []
  let ready, cancelled
  const started = new Promise(resolve => { ready = resolve })
  const stopped = new Promise(resolve => { cancelled = resolve })
  const app = express()
  app.use(express.json())
  app.use('/sources', createSourceCheckRouter((req, _res, next) => {req.admin={role:'admin',adminId:7};next()}, async (url, _id, opts) => {
    options.push(opts.courseName)
    if (url.endsWith('/slow')) { ready(); await new Promise((_,reject) => opts.signal.addEventListener('abort',()=>{cancelled();reject(new Error('Cancelled'))},{once:true})) }
    return {report:{status:'Needs Review'}}
  }))
  const server = app.listen(0,'127.0.0.1')
  await new Promise(resolve=>server.once('listening',resolve))
  t.after(()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve)}))
  const request = (body, signal) => fetch(`http://127.0.0.1:${server.address().port}/sources/check`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({course_name:"Bachelor of Science in Biology",...body}),signal})
  assert.equal((await request({urls:['https://example.edu']})).status,200)
  assert.deepEqual(options,['Bachelor of Science in Biology'])
  assert.equal((await request({urls:['https://example.edu','https://example.edu']})).status,400)
  const abort = new AbortController()
  const first = request({urls:['https://example.edu/slow']},abort.signal).catch(()=>null)
  await started
  assert.equal((await request({urls:['https://example.edu/other']})).status,409)
  abort.abort()
  await first; await stopped
})
