import dotenv from 'dotenv'
import mysql from 'mysql2/promise'
import { createHash } from 'node:crypto'

dotenv.config({ quiet: true })
const apply = process.argv.includes('--apply')
let database

try {
  database = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    connectTimeout: 10000,
  })
  // Inspect schema metadata only. Never read or backfill student records.
  const inspect = async () => {
    const [rows] = await database.execute(`
      SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND (
        (TABLE_NAME = 'PROFILE' AND COLUMN_NAME IN ('user_id', 'personal_factor_answers'))
        OR (TABLE_NAME = 'RECOMMENDATION_ITEM' AND COLUMN_NAME = 'personal_factor_match')
      ) ORDER BY TABLE_NAME, COLUMN_NAME`)
    return rows
  }
  const targetFingerprint = createHash('sha256').update([
    process.env.DB_HOST, process.env.DB_PORT || '3306', process.env.DB_NAME,
  ].join(':')).digest('hex').slice(0, 12)
  const before = await inspect()
  console.log(JSON.stringify({ targetFingerprint, schema: before }, null, 2))
  const answers = before.find(row => row.COLUMN_NAME === 'personal_factor_answers')
  const score = before.find(row => row.COLUMN_NAME === 'personal_factor_match')
  if (!before.some(row => row.TABLE_NAME.toUpperCase() === 'PROFILE' && row.COLUMN_NAME === 'user_id') || !score) {
    throw Object.assign(new Error(), { code: 'UNEXPECTED_SCHEMA' })
  }
  if (answers && (answers.DATA_TYPE !== 'json' || answers.IS_NULLABLE !== 'YES')) {
    throw Object.assign(new Error(), { code: 'UNEXPECTED_ANSWER_COLUMN' })
  }
  if (score.COLUMN_TYPE !== 'decimal(5,4)') {
    throw Object.assign(new Error(), { code: 'UNEXPECTED_SCORE_COLUMN' })
  }
  const changes = []
  if (!answers) changes.push('ALTER TABLE PROFILE ADD COLUMN personal_factor_answers JSON DEFAULT NULL')
  if (score.IS_NULLABLE !== 'YES') changes.push('ALTER TABLE RECOMMENDATION_ITEM MODIFY COLUMN personal_factor_match DECIMAL(5,4) NULL')
  console.log(JSON.stringify({ mode: apply ? 'apply' : 'inspect', targetFingerprint, before, plannedChanges: changes }, null, 2))
  if (apply) {
    if (!process.argv.includes(`--target=${targetFingerprint}`)) {
      throw Object.assign(new Error(), { code: 'TARGET_CONFIRMATION_REQUIRED' })
    }
    // MySQL DDL commits independently; this runner safely resumes a partial migration.
    for (const sql of changes) await database.query(sql)
    const after = await inspect()
    if (!after.some(row => row.COLUMN_NAME === 'personal_factor_answers' && row.DATA_TYPE === 'json' && row.IS_NULLABLE === 'YES')
      || !after.some(row => row.COLUMN_NAME === 'personal_factor_match' && row.IS_NULLABLE === 'YES')) {
      throw Object.assign(new Error(), { code: 'SCHEMA_VERIFICATION_FAILED' })
    }
    console.log(JSON.stringify({ verified: true, after, appliedChanges: changes.length }, null, 2))
  }
} catch (error) {
  // Connection errors may contain account details; emit only a safe error code.
  console.error(JSON.stringify({ failed: true, code: error.code || 'MIGRATION_FAILED' }))
  process.exitCode = 1
} finally {
  await database?.end()
}
