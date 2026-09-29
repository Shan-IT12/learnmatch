import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import {
  evaluateRecommendationReadiness,
  getAdminCourses,
  getCourseRecommendationReadiness,
  setCourseActiveStatus,
} from '../services/adminCourseService.js'

const validSkills = [{ skill_domain: 'Verbal', weight: 2 }]
const validRiasec = ['R', 'I', 'A', 'S', 'E', 'C'].map((riasec_type) => ({ riasec_type, weight: 2 }))

test('admin listing retains active and inactive courses', async () => {
  const expected = [
    { course_id: 1, course_code: 'CRS001', course_name: 'Active course', course_abbreviation: 'AC', cluster_category: 'BUSINESS CLUSTER', is_active: 1 },
    { course_id: 2, course_code: null, course_name: 'Inactive course', course_abbreviation: null, cluster_category: 'BUSINESS CLUSTER', is_active: 0 },
  ]
  const database = {
    query: async (sql) => {
      if (sql.includes('FROM COURSE_SKILL_PROFILE')) return [[{ course_id: 1, ...validSkills[0] }]]
      if (sql.includes('FROM COURSE_RIASEC_PROFILE')) return [validRiasec.map((row) => ({ course_id: 1, ...row }))]
      assert.match(sql, /FROM COURSE/)
      assert.doesNotMatch(sql, /WHERE\s+is_active/i)
      return [expected]
    },
  }

  const result = await getAdminCourses(database)
  assert.equal(result[0].recommendation_readiness.ready, true)
  assert.equal(result[1].recommendation_readiness.ready, false)
  assert.ok(result[1].recommendation_readiness.reasons.some(({ code }) => code === 'MISSING_COURSE_CODE'))
  assert.equal(result[0].is_active, 1)
  assert.equal(result[1].is_active, 0)
})

test('recommendation readiness reports missing code, skills, and incomplete RIASEC independently of active status', () => {
  const readiness = evaluateRecommendationReadiness(
    { course_code: null, cluster_category: 'BUSINESS CLUSTER', is_active: 1 },
    [],
    validRiasec.slice(0, 5)
  )
  assert.equal(readiness.ready, false)
  assert.deepEqual(readiness.reasons.map(({ code }) => code), [
    'MISSING_COURSE_CODE',
    'MISSING_SKILL_PROFILE',
    'INCOMPLETE_RIASEC_PROFILE',
  ])
})

test('valid canonical course matching data is recommendation-ready', () => {
  assert.deepEqual(
    evaluateRecommendationReadiness(
      { course_code: 'CRS001', cluster_category: 'BUSINESS CLUSTER', is_active: 0 },
      validSkills,
      validRiasec
    ),
    { ready: true, reasons: [] }
  )
})

test('invalid clusters and invalid or duplicate profile values block readiness', () => {
  const readiness = evaluateRecommendationReadiness(
    { course_code: 'CRS001', cluster_category: 'Custom Cluster' },
    [{ skill_domain: 'Unknown', weight: 9 }],
    [...validRiasec.slice(0, 5), { riasec_type: 'R', weight: 4 }]
  )
  assert.equal(readiness.ready, false)
  assert.ok(readiness.reasons.some(({ code }) => code === 'INVALID_CLUSTER'))
  assert.ok(readiness.reasons.some(({ code }) => code === 'INVALID_SKILL_PROFILE'))
  assert.ok(readiness.reasons.some(({ code }) => code === 'INVALID_RIASEC_PROFILE'))
  assert.ok(readiness.reasons.some(({ code }) => code === 'INCOMPLETE_RIASEC_PROFILE'))
})

test('database-derived readiness uses course and both matching profile tables', async () => {
  const database = {
    query: async (sql) => {
      if (sql.includes('FROM COURSE WHERE')) return [[{ course_id: 1, course_code: 'CRS001', cluster_category: 'BUSINESS CLUSTER' }]]
      if (sql.includes('COURSE_SKILL_PROFILE')) return [validSkills]
      if (sql.includes('COURSE_RIASEC_PROFILE')) return [validRiasec]
      throw new Error(`Unexpected SQL: ${sql}`)
    },
  }
  assert.deepEqual(await getCourseRecommendationReadiness(database, 1), { ready: true, reasons: [] })
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
  assert.match(serverSource, /VALUES \(\?, \?, \?, \?, \?, \?, 0\)/)
  assert.match(serverSource, /Course is not recommendation-ready and cannot be activated/)
  assert.match(serverSource, /res\.status\(422\)/)
  assert.match(serverSource, /Object\.hasOwn\(req\.body, 'program_type'\)/)
  assert.match(serverSource, /program_type = CASE WHEN \? THEN \? ELSE program_type END/)
  assert.match(serverSource, /Object\.hasOwn\(req\.body, 'psced_group'\)/)
  assert.match(serverSource, /psced_group = CASE WHEN \? THEN \? ELSE psced_group END/)
})
