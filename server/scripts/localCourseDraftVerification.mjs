import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import assert from 'node:assert/strict'
import mysql from 'mysql2/promise'
import dotenv from 'dotenv'

dotenv.config({ quiet: true })
const host = process.env.DB_HOST
if (!['localhost', '127.0.0.1', '::1'].includes(host)) {
  throw new Error('STOP: configured database is not local loopback. No connection attempted.')
}
const config = { host, port: Number(process.env.DB_PORT) || 3306, user: process.env.DB_USER,
  password: process.env.DB_PASSWORD, database: process.env.DB_NAME, connectTimeout: 5000,
  dateStrings: true, supportBigNumbers: true, bigNumberStrings: true }
const db = await mysql.createConnection(config)
const quote = (name) => `\`${name.replaceAll('`', '``')}\``
const query = async (sql, args = []) => (await db.query(sql, args))[0]
const mode = process.argv[2] || 'inspect'
const backupRoot = path.resolve('../.local-backups')
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex')
const rowHash = (rows) => hash(JSON.stringify(rows.map((row) => JSON.stringify(row)).sort()))
const migrationPath = path.resolve('migrations/20261016_add_course_drafts.sql')
const publicationMigration = '20261017_add_course_publication.sql'
async function publicationMigrationState() {
  const [tables] = await db.query("SELECT LOWER(TABLE_NAME) name FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND UPPER(TABLE_NAME) IN ('COURSE_MATCHING_REVIEW','COURSE_PUBLICATION')")
  if (!tables.length) return 'pending'
  assert.equal(tables.length, 2, 'STOP: publication migration partially applied; manual review required')
  const specs = {
    course_matching_review: ['matching_review_id course_id context_token review_snapshot reviewer_id reviewer_label reviewed_at', 2, 'matching_review_id', 'reviewed_at'],
    course_publication: ['course_id matching_review_id context_token publication_snapshot published_by publisher_label published_at', 3, 'course_id', 'published_at'],
  }
  for (const [table, [names, fkCount, primary, timestamp]] of Object.entries(specs)) {
    const columns = await query('SELECT COLUMN_NAME name, COLUMN_TYPE type, IS_NULLABLE nullable, COLUMN_DEFAULT def FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND LOWER(TABLE_NAME)=? ORDER BY ORDINAL_POSITION', [table])
    assert.deepEqual(columns.map(c => c.name), names.split(' '), `STOP: incomplete publication columns: ${table}`)
    assert.ok(columns.every(c => c.nullable === 'NO'), `STOP: unexpected nullable column: ${table}`)
    assert.ok(columns.filter(c => /_id$/.test(c.name) || c.name === 'published_by').every(c => c.type === 'int'), 'STOP: publication ID types differ')
    assert.equal(columns.find(c => c.name === 'context_token').type, 'char(64)')
    assert.equal(columns.find(c => c.name.endsWith('_snapshot')).type, 'json')
    assert.equal(columns.find(c => c.name.endsWith('_label')).type, 'varchar(255)')
    assert.equal(columns.find(c => c.name === timestamp).type, 'datetime(6)')
    assert.equal(String(columns.find(c => c.name === timestamp).def).toLowerCase(), 'current_timestamp(6)')
    const keys = await query('SELECT CONSTRAINT_TYPE kind FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND LOWER(TABLE_NAME)=?', [table])
    assert.equal(keys.filter(k => k.kind === 'PRIMARY KEY').length, 1)
    assert.equal(keys.filter(k => k.kind === 'FOREIGN KEY').length, fkCount)
    const pk = await query("SELECT COLUMN_NAME name FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE() AND LOWER(TABLE_NAME)=? AND CONSTRAINT_NAME='PRIMARY' ORDER BY ORDINAL_POSITION", [table])
    assert.deepEqual(pk.map(c => c.name), [primary])
    const ddl = (await query(`SHOW CREATE TABLE ${quote(table)}`))[0]['Create Table']
    assert.match(ddl, /ENGINE=InnoDB/)
    if (table === 'course_matching_review') assert.match(ddl, /`matching_review_id` int NOT NULL AUTO_INCREMENT/)
    const fks = await query('SELECT COLUMN_NAME c, LOWER(REFERENCED_TABLE_NAME) t, REFERENCED_COLUMN_NAME rc FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE() AND LOWER(TABLE_NAME)=? AND REFERENCED_TABLE_NAME IS NOT NULL ORDER BY COLUMN_NAME', [table])
    const expected = table === 'course_matching_review'
      ? [{c:'course_id',t:'course',rc:'course_id'},{c:'reviewer_id',t:'admin',rc:'admin_id'}]
      : [{c:'course_id',t:'course',rc:'course_id'},{c:'matching_review_id',t:'course_matching_review',rc:'matching_review_id'},{c:'published_by',t:'admin',rc:'admin_id'}]
    assert.deepEqual(fks, expected, 'STOP: publication foreign keys differ')
  }
  return 'applied'
}
async function migrationState() {
  const columns = await query("SELECT COLUMN_NAME name FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='COURSE'")
  const added = ['is_draft', 'program_duration_years', 'year_levels'].filter((name) => columns.some((column) => column.name === name))
  const allocator = await query("SELECT TABLE_NAME name FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='COURSE_CODE_ALLOCATOR'")
  const check = await query("SELECT CONSTRAINT_NAME name FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='COURSE' AND CONSTRAINT_NAME='chk_course_draft_inactive'")
  if (added.length === 0 && allocator.length === 0 && check.length === 0) return 'pending'
  if (added.length === 3 && allocator.length === 1 && check.length === 1) return 'applied'
  throw new Error('Partial migration detected. Stop for manual review.')
}
const sourceMigrations = ['20261016_add_draft_source_reviews.sql', '20261016_add_source_check_evidence.sql']
async function sourceMigrationStates() {
  const columns = await query("SELECT LOWER(TABLE_NAME) t, COLUMN_NAME c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE()")
  const specs = {
    course_draft_field_revision: 'course_id field_key revision',
    course_draft_source: 'source_id course_id source_revision title url supported_fields notes is_removed created_at updated_at',
    course_draft_source_review: 'review_id source_id source_revision context_token field_revisions source_snapshot claim_snapshot reviewer_id reviewer_label reviewed_at',
    course_draft_source_check: 'check_id source_id source_revision report checked_by checked_at',
  }
  const present = (t) => columns.filter(row => row.t === t).map(row => row.c)
  const complete = async (t, fkCount) => {
    assert.ok(specs[t].split(' ').every(c => present(t).includes(c)), `STOP: partially applied schema: ${t}`)
    const keys = await query('SELECT CONSTRAINT_TYPE kind FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND LOWER(TABLE_NAME)=?', [t])
    assert.equal(keys.filter(k => k.kind === 'PRIMARY KEY').length, 1, `STOP: missing primary key: ${t}`)
    assert.equal(keys.filter(k => k.kind === 'FOREIGN KEY').length, fkCount, `STOP: incomplete foreign keys: ${t}`)
  }
  const phaseA = Object.keys(specs).slice(0, 3)
  const n = phaseA.filter(t => present(t).length).length
  assert.ok(n === 0 || n === 3, 'STOP: Phase 2A partially applied; manual review required')
  if (n === 3) for (const [i, t] of phaseA.entries()) await complete(t, [1, 1, 2][i])
  const digest = present('course_draft_source').includes('check_digest')
  const checks = present('course_draft_source_check').length > 0
  assert.equal(digest, checks, 'STOP: Phase 2B partially applied; manual review required')
  if (checks) { assert.equal(n, 3); await complete('course_draft_source_check', 2) }
  return [n === 3 ? 'applied' : 'pending', checks ? 'applied' : 'pending']
}
async function readBackup(directory) {
  const snapshotBytes = await fs.readFile(path.join(directory, 'snapshot.json'))
  const sql = await fs.readFile(path.join(directory, 'restore.sql'))
  const manifest = JSON.parse(await fs.readFile(path.join(directory, 'manifest.json'), 'utf8'))
  assert.equal(hash(snapshotBytes), manifest.snapshot_sha256, 'Backup snapshot checksum mismatch')
  assert.equal(hash(sql), manifest.sql_sha256, 'Backup SQL checksum mismatch')
  const snapshot = JSON.parse(snapshotBytes)
  assert.equal(snapshot.database, config.database)
  for (const table of snapshot.tables) {
    assert.equal(rowHash(table.rows), manifest.tables[table.name].sha256)
    assert.equal(table.rows.length, manifest.tables[table.name].rows)
  }
  return { snapshot, manifest }
}
async function compareOriginalRows(snapshot, reader = query, preserveAllocator = false) {
  const summary = {}
  for (const table of snapshot.tables) {
    const rows = await reader(`SELECT ${table.columns.map(quote).join(',')} FROM ${quote(table.name)}`)
    if (preserveAllocator && table.name.toLowerCase() === 'course_code_allocator') {
      assert.equal(rows.length, table.rows.length)
      assert.equal(rows[0].allocator_id, table.rows[0].allocator_id)
      assert.ok(Number(rows[0].next_number) >= Number(table.rows[0].next_number), 'Allocator must never move backwards')
    } else assert.equal(rowHash(rows), rowHash(table.rows), `Original data changed in ${table.name}`)
    summary[table.name] = rows.length
  }
  return summary
}
try {
  const identity = await query('SELECT DATABASE() database_name, @@hostname server_hostname, @@port server_port, @@version version, @@read_only read_only')
  assert.ok(identity[0].database_name && !/railway/i.test(identity[0].database_name), 'Refuse Railway database')
  const state = await migrationState()
  const sourceStates = await sourceMigrationStates()
  const publicationState = await publicationMigrationState()
  const tables = await query('SELECT TABLE_NAME name, TABLE_TYPE type, ENGINE engine FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME')
  if (mode === 'backup') {
    assert.ok(tables.every((table) => table.type === 'BASE TABLE' && table.engine === 'InnoDB'), 'Backup requires only InnoDB base tables')
    for (const sql of ['SHOW TRIGGERS', 'SELECT ROUTINE_NAME FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA=DATABASE()', 'SELECT EVENT_NAME FROM information_schema.EVENTS WHERE EVENT_SCHEMA=DATABASE()']) assert.equal((await query(sql)).length, 0, 'Unsupported additional schema objects; stop backup')
    const directory = path.join(backupRoot, `course-drafts-${new Date().toISOString().replaceAll(/[:.]/g, '-')}`)
    await fs.mkdir(directory, { recursive: true })
    const snapshot = { database: config.database, captured_at: new Date().toISOString(), migration_state: state, tables: [] }
    const sql = ['-- Full local LearnMatch backup. Restore ONLY into an empty, explicitly selected local database.', 'SET NAMES utf8mb4;', "SET SESSION sql_mode='NO_AUTO_VALUE_ON_ZERO';", 'SET FOREIGN_KEY_CHECKS=0;', "SET SESSION time_zone='+00:00';"]
    await query("SET SESSION time_zone='+00:00'")
    await query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ')
    await query('START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY')
    for (const { name } of tables) {
      const ddl = (await query(`SHOW CREATE TABLE ${quote(name)}`))[0]['Create Table']
      const metadata = await query(`SHOW FULL COLUMNS FROM ${quote(name)}`)
      const columns = metadata.map((column) => column.Field)
      // DEFAULT_GENERATED is a default expression, not a computed column.
      const generatedColumns = metadata.filter((column) => /(?:STORED|VIRTUAL) GENERATED/i.test(column.Extra)).map((column) => column.Field)
      const insertColumns = columns.filter((column) => !generatedColumns.includes(column))
      const rows = await query(`SELECT ${columns.map(quote).join(',')} FROM ${quote(name)}`)
      snapshot.tables.push({ name, ddl, columns, insertColumns, generatedColumns, rows })
      sql.push(`${ddl};`)
      for (const row of rows) {
        const values = insertColumns.map((column) => {
          const value = row[column]
          return value && typeof value === 'object' && !Buffer.isBuffer(value) ? JSON.stringify(value) : value
        })
        sql.push(mysql.format(`INSERT INTO ${quote(name)} (${insertColumns.map(quote).join(',')}) VALUES (${insertColumns.map(() => '?').join(',')});`, values))
      }
    }
    await db.commit()
    sql.push('SET FOREIGN_KEY_CHECKS=1;')
    const snapshotBytes = JSON.stringify(snapshot)
    const sqlBytes = sql.join('\n') + '\n'
    await fs.writeFile(path.join(directory, 'snapshot.json'), snapshotBytes, { flag: 'wx' })
    await fs.writeFile(path.join(directory, 'restore.sql'), sqlBytes, { flag: 'wx' })
    const manifest = { database: config.database, host, captured_at: snapshot.captured_at, migration_state: state,
      publication_migration: { name: publicationMigration, state: publicationState, sha256: hash(await fs.readFile(path.resolve('migrations', publicationMigration))) },
      source_migrations: Object.fromEntries(await Promise.all(sourceMigrations.map(async (name, i) => [name, { state: sourceStates[i], sha256: hash(await fs.readFile(path.resolve('migrations', name))) }]))),
      migration_sha256: hash(await fs.readFile(migrationPath)), snapshot_sha256: hash(snapshotBytes), sql_sha256: hash(sqlBytes),
      tables: Object.fromEntries(snapshot.tables.map((table) => [table.name, { rows: table.rows.length, sha256: rowHash(table.rows) }])) }
    await fs.writeFile(path.join(directory, 'manifest.json'), JSON.stringify(manifest, null, 2), { flag: 'wx' })
    const checked = await readBackup(directory)
    const counts = await compareOriginalRows(checked.snapshot)
    console.log(JSON.stringify({ local_host: host, database: config.database, migration_state: state, backup_directory: directory, verified: true, bytes: Buffer.byteLength(sqlBytes), row_counts: counts }, null, 2))
  } else if (mode === 'verify-original') {
    const directory = path.resolve(process.argv[3] || '')
    assert.ok(directory.startsWith(backupRoot + path.sep))
    const backup = await readBackup(directory)
    await query("SET SESSION time_zone='+00:00'")
    const counts = await compareOriginalRows(backup.snapshot, query, true)
    const scratch = await query("SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME LIKE 'learnmatch_phase1_restore_%'")
    const sourceCounts = {}
    if (sourceStates.every(s => s === 'applied')) for (const table of ['COURSE_DRAFT_FIELD_REVISION', 'COURSE_DRAFT_SOURCE', 'COURSE_DRAFT_SOURCE_REVIEW', 'COURSE_DRAFT_SOURCE_CHECK']) sourceCounts[table] = (await query(`SELECT COUNT(*) n FROM ${quote(table)}`))[0].n
    console.log(JSON.stringify({ migration_state: state, source_migrations: sourceStates, original_rows_unchanged_except_preserved_allocator: true, tables_verified: Object.keys(counts).length, restore_databases_remaining: scratch.length, source_table_counts: sourceCounts, allocator: await query('SELECT * FROM COURSE_CODE_ALLOCATOR') }))
  } else if (mode === 'restore-check') {
    const directory = path.resolve(process.argv[3] || '')
    assert.ok(directory.startsWith(backupRoot + path.sep))
    const backup = await readBackup(directory)
    const scratch = `learnmatch_phase1_restore_${crypto.randomBytes(6).toString('hex')}`
    let created = false
    let restore
    try {
      await query(`CREATE DATABASE ${quote(scratch)} CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`)
      created = true
      restore = await mysql.createConnection({ ...config, database: scratch, multipleStatements: true })
      await restore.query("SET SESSION sql_mode='NO_AUTO_VALUE_ON_ZERO'")
      await restore.query(await fs.readFile(path.join(directory, 'restore.sql'), 'utf8'))
      const restoredQuery = async (sql, args = []) => (await restore.query(sql, args))[0]
      const counts = await compareOriginalRows(backup.snapshot, restoredQuery)
      for (const table of backup.snapshot.tables) {
        const ddl = (await restoredQuery(`SHOW CREATE TABLE ${quote(table.name)}`))[0]['Create Table']
        assert.equal(hash(ddl), hash(table.ddl), `Restored schema differs for ${table.name}`)
        for (const column of table.generatedColumns) assert.ok(!table.insertColumns.includes(column))
      }
      const fks = await restoredQuery('SELECT TABLE_NAME t, COLUMN_NAME c, REFERENCED_TABLE_NAME rt, REFERENCED_COLUMN_NAME rc FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL')
      for (const fk of fks) {
        const [result] = await restoredQuery(`SELECT COUNT(*) n FROM ${quote(fk.t)} child LEFT JOIN ${quote(fk.rt)} parent ON child.${quote(fk.c)}=parent.${quote(fk.rc)} WHERE child.${quote(fk.c)} IS NOT NULL AND parent.${quote(fk.rc)} IS NULL`)
        assert.equal(Number(result.n), 0, `Restored orphan rows in ${fk.t}.${fk.c}`)
      }
      await restore.beginTransaction()
      try {
        const [term] = await restoredQuery('SELECT term_id, user_id, tracking_cycle_id FROM college_term WHERE tracking_cycle_id IS NOT NULL LIMIT 1')
        assert.ok(term, 'Need an existing linked term for generated-column behavior test')
        // Isolate its unique-key fields while exercising both computed branches.
        await restoredQuery("UPDATE college_term SET academic_year='9998-99', tracking_cycle_id=NULL WHERE term_id=?", [term.term_id])
        assert.equal((await restoredQuery('SELECT legacy_user_id FROM college_term WHERE term_id=?', [term.term_id]))[0].legacy_user_id, term.user_id)
        await restoredQuery('UPDATE college_term SET tracking_cycle_id=? WHERE term_id=?', [term.tracking_cycle_id, term.term_id])
        assert.equal((await restoredQuery('SELECT legacy_user_id FROM college_term WHERE term_id=?', [term.term_id]))[0].legacy_user_id, null)
        const [cycle] = await restoredQuery("SELECT tracking_cycle_id, user_id FROM college_tracking_cycle WHERE status='active' LIMIT 1")
        assert.ok(cycle, 'Need an active cycle for generated-column behavior test')
        await restoredQuery("UPDATE college_tracking_cycle SET status='paused' WHERE tracking_cycle_id=?", [cycle.tracking_cycle_id])
        assert.equal((await restoredQuery('SELECT active_user_id FROM college_tracking_cycle WHERE tracking_cycle_id=?', [cycle.tracking_cycle_id]))[0].active_user_id, null)
        await restoredQuery("UPDATE college_tracking_cycle SET status='active' WHERE tracking_cycle_id=?", [cycle.tracking_cycle_id])
        assert.equal((await restoredQuery('SELECT active_user_id FROM college_tracking_cycle WHERE tracking_cycle_id=?', [cycle.tracking_cycle_id]))[0].active_user_id, cycle.user_id)
      } finally { await restore.rollback() }
      await compareOriginalRows(backup.snapshot, restoredQuery)
      const result = { verified_at: new Date().toISOString(), sql_sha256: backup.manifest.sql_sha256, row_counts: counts,
        all_row_hashes_match: true, all_schema_hashes_match: true, foreign_keys_checked: fks.length,
        generated_columns: backup.snapshot.tables.flatMap((table) => table.generatedColumns.map((column) => `${table.name}.${column}`)), generated_behavior_passed: true }
      await fs.writeFile(path.join(directory, 'restore-check.json'), JSON.stringify(result, null, 2))
      console.log(JSON.stringify({ restore_verified: true, tables: Object.keys(counts).length, rows: Object.values(counts).reduce((sum, count) => sum + count, 0), ...result, row_counts: undefined }))
    } catch (error) {
      await fs.writeFile(path.join(directory, 'restore-failed.json'), JSON.stringify({ failed_at: new Date().toISOString(), code: error.code || 'VERIFICATION_FAILED', message: error.sqlMessage || error.message }, null, 2))
      throw error
    } finally {
      if (restore) await restore.end()
      if (created) {
        assert.match(scratch, /^learnmatch_phase1_restore_[a-f0-9]{12}$/)
        await query(`DROP DATABASE ${quote(scratch)}`)
        console.log('Verification-only restore database removed.')
      }
    }
  } else if (mode === 'migrate-publication') {
    assert.equal(state, 'applied', 'Phase 1 must already be applied; it will not be rerun')
    assert.ok(sourceStates.every(s => s === 'applied'), 'Source migrations must already be applied; they will not be rerun')
    const directory = path.resolve(process.argv[3] || '')
    assert.ok(directory.startsWith(backupRoot + path.sep))
    const backup = await readBackup(directory)
    const certificate = JSON.parse(await fs.readFile(path.join(directory, 'restore-check.json'), 'utf8'))
    assert.equal(certificate.sql_sha256, backup.manifest.sql_sha256)
    assert.ok(certificate.all_row_hashes_match && certificate.all_schema_hashes_match && certificate.generated_behavior_passed)
    await query("SET SESSION time_zone='+00:00'")
    await compareOriginalRows(backup.snapshot)
    const sql = await fs.readFile(path.resolve('migrations', publicationMigration), 'utf8')
    assert.equal(hash(sql), backup.manifest.publication_migration?.sha256, 'Migration changed since fresh backup')
    if (await publicationMigrationState() === 'applied') console.log('Publication migration already applied; no DDL executed.')
    else {
      const statements = sql.replace(/^--.*$/gm, '').split(';').map(s => s.trim()).filter(Boolean)
      assert.equal(statements.length, 2)
      assert.match(statements[0], /^CREATE TABLE COURSE_MATCHING_REVIEW \(/)
      assert.match(statements[1], /^CREATE TABLE COURSE_PUBLICATION \(/)
      for (const statement of statements) await query(statement)
      assert.equal(await publicationMigrationState(), 'applied')
      await compareOriginalRows(backup.snapshot)
      console.log(JSON.stringify({ publication_migration: publicationMigration, status: 'applied', earlier_migrations_rerun: false, original_rows_unchanged: true }))
    }
  } else if (mode === 'migrate-sources') {
    assert.equal(state, 'applied', 'Phase 1 must already be applied; it will never be executed here')
    const directory = path.resolve(process.argv[3] || '')
    assert.ok(directory.startsWith(backupRoot + path.sep))
    const backup = await readBackup(directory)
    const certificate = JSON.parse(await fs.readFile(path.join(directory, 'restore-check.json'), 'utf8'))
    assert.equal(certificate.sql_sha256, backup.manifest.sql_sha256)
    assert.ok(certificate.all_row_hashes_match && certificate.all_schema_hashes_match && certificate.generated_behavior_passed)
    await query("SET SESSION time_zone='+00:00'")
    await compareOriginalRows(backup.snapshot)
    // Inspect both phases before any DDL. A partial second phase also stops the first.
    await sourceMigrationStates()
    for (const [i, name] of sourceMigrations.entries()) {
      const sql = await fs.readFile(path.resolve('migrations', name), 'utf8')
      assert.equal(hash(sql), backup.manifest.source_migrations[name].sha256, 'Migration changed since fresh backup')
      const states = await sourceMigrationStates()
      if (states[i] === 'applied') { console.log(`${name}: already applied; skipped`); continue }
      if (i === 1) assert.equal(states[0], 'applied')
      const statements = sql.replace(/^--.*$/gm, '').split(';').map(s => s.trim()).filter(Boolean)
      assert.equal(statements.length, [3, 2][i])
      for (const statement of statements) await query(statement)
      assert.equal((await sourceMigrationStates())[i], 'applied')
      console.log(`${name}: applied`)
    }
    await compareOriginalRows(backup.snapshot)
    console.log(JSON.stringify({ source_migrations: await sourceMigrationStates(), phase1: await migrationState(), original_rows_unchanged: true }))
  } else if (mode === 'migrate') {
    const directory = path.resolve(process.argv[3] || '')
    assert.ok(directory.startsWith(backupRoot + path.sep), 'Backup must be inside the local backup root')
    const backup = await readBackup(directory)
    const restoreCheck = JSON.parse(await fs.readFile(path.join(directory, 'restore-check.json'), 'utf8'))
    assert.equal(restoreCheck.sql_sha256, backup.manifest.sql_sha256, 'Successful restore check required before migration')
    assert.ok(restoreCheck.all_row_hashes_match && restoreCheck.all_schema_hashes_match && restoreCheck.generated_behavior_passed)
    await query("SET SESSION time_zone='+00:00'")
    await compareOriginalRows(backup.snapshot)
    const migration = await fs.readFile(migrationPath, 'utf8')
    assert.equal(hash(migration), backup.manifest.migration_sha256, 'Migration changed after backup')
    if (state === 'applied') console.log('Migration already applied; no SQL executed.')
    else {
      assert.equal(state, 'pending')
      const statements = migration.replace(/^--.*$/gm, '').split(';').map((statement) => statement.trim()).filter(Boolean)
      assert.equal(statements.length, 3)
      for (const statement of statements) await query(statement)
      assert.equal(await migrationState(), 'applied')
      await compareOriginalRows(backup.snapshot)
      console.log(JSON.stringify({ migration: 'applied', original_rows_unchanged: true, allocator: await query('SELECT * FROM COURSE_CODE_ALLOCATOR') }))
    }
  } else if (mode === 'inspect') {
  const columns = await query("SELECT COLUMN_NAME name, COLUMN_TYPE type FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'COURSE' ORDER BY ORDINAL_POSITION")
  const definitions = []
  for (const table of ['COURSE', 'COURSE_SKILL_PROFILE', 'COURSE_RIASEC_PROFILE']) definitions.push(await query(`SHOW CREATE TABLE ${quote(table)}`))
  const activity = (await query('SHOW PROCESSLIST')).map(({ Id, Command, db }) => ({ id: Id, command: Command, database: db }))
  const objects = {}
  for (const [kind, sql] of Object.entries({ triggers: 'SHOW TRIGGERS', routines: 'SELECT ROUTINE_NAME name FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA = DATABASE()', events: 'SELECT EVENT_NAME name FROM information_schema.EVENTS WHERE EVENT_SCHEMA = DATABASE()' })) objects[kind] = (await query(sql)).length
  const generated = await query("SELECT TABLE_NAME table_name, COLUMN_NAME column_name, COLUMN_TYPE column_type, EXTRA extra, GENERATION_EXPRESSION expression FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND GENERATION_EXPRESSION <> '' ORDER BY TABLE_NAME, ORDINAL_POSITION")
  const collegeTermDefinition = (await query('SHOW CREATE TABLE college_term'))[0]['Create Table']
  console.log(JSON.stringify({ local_host: host, identity, migration_state: state, publication_migration: publicationState, source_migrations: Object.fromEntries(sourceMigrations.map((name, i) => [name, sourceStates[i]])), tables, course_columns: columns, definitions, generated, college_term_definition: collegeTermDefinition, objects, activity }, null, 2))
  } else throw new Error('Unknown verification mode')
} catch (error) {
  // Never print driver error objects: they can include SQL containing private rows.
  console.error(JSON.stringify({ stopped: true, code: error.code || 'VERIFICATION_FAILED', message: error.sqlMessage || error.message }))
  process.exitCode = 1
} finally { await db.end() }
