import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { once } from 'node:events'
import mysql from 'mysql2/promise'
import { getAdminDashboard } from '../services/adminDashboardService.js'
import { PERSONAL_FACTOR_KEYS, personalFactorResponses } from '../shared/personalFactors.js'

// Never uses application connection settings or an existing database/server.
const mysqld = process.env.MYSQL_TEST_SERVER
  || (process.platform === 'win32' ? 'C:/Program Files/MySQL/MySQL Server 8.0/bin/mysqld.exe' : '')

async function runInitialization(args) {
  const child = spawn(mysqld, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
  let output = ''
  child.stdout.on('data', chunk => { output += chunk })
  child.stderr.on('data', chunk => { output += chunk })
  const [code] = await once(child, 'exit')
  assert.equal(code, 0, `Disposable MySQL initialization failed: ${output}`)
}

test('actual MySQL aggregate counts current disclosures with shared semantics and one count per completed student', {
  skip: !mysqld || !existsSync(mysqld) ? 'Disposable MySQL binary unavailable; set MYSQL_TEST_SERVER to enable.' : false,
  timeout: 120000,
}, async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'learnmatch-synthetic-mysql-'))
  let child
  let connection
  t.after(async () => {
    const stopped = child && child.exitCode === null ? once(child, 'exit') : null
    // Killing the Windows launcher can leave its server child alive.
    // Shut down only this test's fresh server before removing its files.
    if (connection) {
      await connection.query('SHUTDOWN').catch(() => {})
      await connection.end().catch(() => {})
    }
    if (child && child.exitCode === null) {
      if (!connection) child.kill()
      await stopped
    }
    // Only the new, isolated directory owned by this test may be removed.
    assert.equal(path.dirname(directory), path.resolve(tmpdir()))
    assert.ok(path.basename(directory).startsWith('learnmatch-synthetic-mysql-'))
    await rm(directory, { recursive: true, force: true })
  })
  await runInitialization(['--no-defaults', '--initialize-insecure', `--datadir=${directory}`, '--console'])
  const reservation = createServer()
  reservation.listen(0, '127.0.0.1')
  await once(reservation, 'listening')
  const port = reservation.address().port
  await new Promise(resolve => reservation.close(resolve))
  child = spawn(mysqld, ['--no-defaults', `--datadir=${directory}`, '--bind-address=127.0.0.1',
    `--port=${port}`, '--mysqlx=OFF', '--skip-log-bin', '--innodb-buffer-pool-size=32M', '--console'],
  { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
  let output = ''
  child.stdout.on('data', chunk => { output += chunk })
  child.stderr.on('data', chunk => { output += chunk })
  for (let attempt = 0; attempt < 300 && !connection; attempt += 1) {
    assert.equal(child.exitCode, null, `Disposable MySQL stopped: ${output}`)
    try {
      connection = await mysql.createConnection({ host: '127.0.0.1', port, user: 'root', connectTimeout: 500 })
    } catch {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }
  assert.ok(connection, `Disposable MySQL did not start: ${output}`)
  await connection.query('CREATE DATABASE synthetic_privacy')
  await connection.query('USE synthetic_privacy')
  for (const ddl of [
    'CREATE TABLE USER_ACCOUNT (user_id INT PRIMARY KEY, username VARCHAR(50), created_at DATETIME)',
    `CREATE TABLE PROFILE (profile_id INT AUTO_INCREMENT PRIMARY KEY, user_id INT,
      personal_factor_answers JSON, ${PERSONAL_FACTOR_KEYS.map(f => `factor_${f}_impact DECIMAL(5,2)`).join(', ')},
      factor_health TINYINT, factor_others VARCHAR(100), factor_others_classification_status VARCHAR(16), factor_others_classification JSON)`,
    'CREATE TABLE INTEREST_RESPONSE (user_id INT)',
    'CREATE TABLE SKILL_RESPONSE (user_id INT)',
    'CREATE TABLE PERSONALITY_ASSESSMENT (user_id INT)',
    'CREATE TABLE ASSESSMENT_ATTEMPT (user_id INT, status VARCHAR(20))',
    'CREATE TABLE RECOMMENDATION (recommendation_id INT, user_id INT, generated_at DATETIME)',
    'CREATE TABLE RECOMMENDATION_ITEM (recommendation_id INT, course_id INT, rank_position INT)',
    'CREATE TABLE COURSE (course_id INT, course_code VARCHAR(20), course_name VARCHAR(100))',
  ]) await connection.query(ddl)

  const answers = value => Object.fromEntries(PERSONAL_FACTOR_KEYS.map(f => [f, value]))
  const cases = [
    { name: 'new Yes/slight', rows: [{ personal_factor_answers: { health: 'yes' }, factor_health_impact: 1 }], expected: 1 },
    { name: 'all explicit No', rows: [{ personal_factor_answers: answers('no') }], expected: 1 },
    { name: 'declined after legacy Yes', rows: [{ personal_factor_answers: { health: 'unknown' }, factor_health: 1 }], expected: 0 },
    { name: 'retired Others only', rows: [{ factor_others: 'SYNTHETIC', factor_others_classification_status: 'MATCHED', factor_others_classification: ['factor_health'] }], expected: 0 },
    { name: 'historical impact 3', rows: [{ factor_health_impact: 3 }], expected: 1 },
    { name: 'ambiguous historical impact', rows: [{ factor_health: 1, factor_health_impact: 1 }], expected: 0 },
    { name: 'all unknown', rows: [{ personal_factor_answers: answers('unknown') }], expected: 0 },
    { name: 'incomplete Yes', completed: false, rows: [{ personal_factor_answers: { health: 'yes' }, factor_health_impact: 4 }], expected: 0 },
    { name: 'legacy_unknown overrides stale impact', rows: [{ personal_factor_answers: { health: 'legacy_unknown' }, factor_health_impact: 3 }], expected: 0 },
    { name: 'unknown overrides stale impact', rows: [{ personal_factor_answers: { health: 'unknown' }, factor_health_impact: 3 }], expected: 0 },
    { name: 'malformed Yes impact', rows: [{ personal_factor_answers: { health: 'yes' }, factor_health_impact: 2.5 }], expected: 0 },
    { name: 'missing Yes impact', rows: [{ personal_factor_answers: { health: 'yes' } }], expected: 0 },
    { name: 'out of range Yes impact', rows: [{ personal_factor_answers: { health: 'yes' }, factor_health_impact: 5 }], expected: 0 },
    { name: 'malformed state alone', rows: [{ personal_factor_answers: { health: true } }], expected: 0 },
    { name: 'invalid state historical fallback', rows: [{ personal_factor_answers: { health: 'invalid' }, factor_health_impact: 3 }], expected: 1 },
    { name: 'case sensitive state', rows: [{ personal_factor_answers: { health: 'YES' }, factor_health_impact: 1 }], expected: 0 },
    { name: 'partial metadata fallback', rows: [{ personal_factor_answers: { health: 'unknown' }, factor_family_impact: 2 }], expected: 1 },
    { name: 'array metadata fallback', rows: [{ personal_factor_answers: ['yes'], factor_health_impact: 2 }], expected: 1 },
    { name: 'scalar metadata fallback', rows: [{ personal_factor_answers: 'invalid JSON text', factor_health_impact: 2 }], expected: 1 },
    { name: 'JSON string metadata No', rows: [{ personal_factor_answers: JSON.stringify({ health: 'no' }) }], expected: 1 },
    { name: 'nested JSON string metadata unknown', rows: [{ personal_factor_answers: JSON.stringify(JSON.stringify({ health: 'unknown' })), factor_health_impact: 3 }], expected: 0 },
    { name: 'JSON scalar null fallback', rows: [{ personal_factor_answers: 'null', factor_health_impact: 3 }], expected: 1 },
    { name: 'multiple disclosed profile rows', rows: [{ personal_factor_answers: { health: 'no' } }, { personal_factor_answers: { work: 'yes' }, factor_work_impact: 4 }], expected: 1 },
    { name: 'mixed multiple profile rows', rows: [{ personal_factor_answers: answers('unknown') }, { personal_factor_answers: { work: 'no' } }], expected: 1 },
    { name: 'multiple undisclosed profile rows', rows: [{ factor_health_impact: 1 }, { personal_factor_answers: answers('unknown') }], expected: 0 },
    { name: 'no profile', rows: [], expected: 0 },
    { name: 'completed attempt replaces interest minimum', noInterests: true, rows: [{ personal_factor_answers: { health: 'no' } }], expected: 1 },
  ]
  for (const factor of PERSONAL_FACTOR_KEYS) {
    for (const impact of [1, 2, 3, 4]) cases.push({ name: `${factor} Yes/${impact}`, rows: [{ personal_factor_answers: { [factor]: 'yes' }, [`factor_${factor}_impact`]: impact }], expected: 1 })
  }
  for (const [index, fixture] of cases.entries()) {
    const id = index + 1
    await connection.execute('INSERT INTO USER_ACCOUNT VALUES (?, ?, ?)', [id, `synthetic_${id}`, '2026-10-01 00:00:00'])
    for (const row of fixture.rows) {
      const columns = ['user_id', ...Object.keys(row)]
      await connection.execute(`INSERT INTO PROFILE (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
        [id, ...Object.entries(row).map(([key, value]) => key === 'personal_factor_answers' || key === 'factor_others_classification' ? JSON.stringify(value) : value)])
    }
    if (fixture.completed !== false && fixture.rows.length) {
      for (const [table, count] of [['INTEREST_RESPONSE', fixture.noInterests ? 0 : 3], ['SKILL_RESPONSE', 30], ['PERSONALITY_ASSESSMENT', 1]]) {
        for (let i = 0; i < count; i += 1) await connection.execute(`INSERT INTO ${table} VALUES (?)`, [id])
      }
      if (fixture.noInterests) await connection.execute("INSERT INTO ASSESSMENT_ATTEMPT VALUES (?, 'COMPLETED')", [id])
    }
  }
  let summarySql
  const database = { query(sql, params) {
    if (sql.includes('AS registered_students')) summarySql = sql
    return connection.query(sql, params)
  } }
  const result = await getAdminDashboard(database, { now: new Date('2026-10-20T00:00:00Z') })
  assert.equal(result.summary.registeredStudents, cases.length)
  assert.equal(result.summary.consideredPersonalFactors, cases.reduce((sum, fixture) => sum + fixture.expected, 0))
  assert.equal(result.summary.completedAssessments, cases.filter(f => f.completed !== false && f.rows.length).length)
  assert.equal(result.summary.assessmentCompletionRate, Math.round(result.summary.completedAssessments / cases.length * 1000) / 10)
  assert.deepEqual(result.coursePopularity, [])
  assert.equal(result.registrationTrend.at(-1).count, cases.length)
  for (const [index, fixture] of cases.entries()) {
    const [[summary]] = await connection.query(`${summarySql} WHERE state.user_id = ?`, [index + 1])
    assert.equal(Number(summary.completed_with_personal_factors), fixture.expected, fixture.name)
    const sharedCount = fixture.completed !== false && fixture.rows.some(row => Object.values(personalFactorResponses(row)).some(value => value !== null)) ? 1 : 0
    assert.equal(Number(summary.completed_with_personal_factors), sharedCount, `Shared interpretation: ${fixture.name}`)
  }
  t.diagnostic(`Executed production aggregate SQL against isolated MySQL with ${cases.length} synthetic student fixtures.`)
})
