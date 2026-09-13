import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { getAdminCourses, setCourseActiveStatus } from '../services/adminCourseService.js'

test('admin listing retains active and inactive courses', async () => {
  const expected = [
    { course_id: 1, course_name: 'Active course', is_active: 1 },
    { course_id: 2, course_name: 'Inactive course', is_active: 0 },
  ]
  const database = {
    query: async (sql) => {
      assert.match(sql, /FROM COURSE/)
      assert.doesNotMatch(sql, /WHERE\s+is_active/i)
      return [expected]
    },
  }

  assert.deepEqual(await getAdminCourses(database), expected)
})

test('deactivate and reactivate update only is_active without deleting a row', async () => {
  const calls = []
  const database = {
    query: async (sql, values) => {
      calls.push({ sql, values })
      return [{ affectedRows: 1 }]
    },
  }

  assert.equal(await setCourseActiveStatus(database, 17, false), true)
  assert.equal(await setCourseActiveStatus(database, 17, true), true)
  assert.deepEqual(calls, [
    { sql: 'UPDATE COURSE SET is_active = ? WHERE course_id = ?', values: [0, 17] },
    { sql: 'UPDATE COURSE SET is_active = ? WHERE course_id = ?', values: [1, 17] },
  ])
  assert.ok(calls.every(({ sql }) => !/DELETE/i.test(sql)))
})

test('status update requires a strict boolean and reports a missing course', async () => {
  const database = { query: async () => [{ affectedRows: 0 }] }

  await assert.rejects(
    setCourseActiveStatus(database, 17, 1),
    { code: 'INVALID_COURSE_STATUS' }
  )
  assert.equal(await setCourseActiveStatus(database, 999, false), false)
})

test('admin hard-delete route is disabled and status route requires admin authentication', () => {
  const testsDirectory = path.dirname(fileURLToPath(import.meta.url))
  const serverSource = fs.readFileSync(path.join(testsDirectory, '../server.js'), 'utf8')

  assert.match(
    serverSource,
    /app\.delete\('\/api\/admin\/courses\/:id', authenticateAdmin, \(req, res\) => \{\s+res\.status\(405\)/
  )
  assert.doesNotMatch(serverSource, /DELETE FROM COURSE/i)
  assert.match(
    serverSource,
    /app\.patch\('\/api\/admin\/courses\/:id\/status', authenticateAdmin/
  )
})
