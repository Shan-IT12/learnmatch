import mysql from 'mysql2/promise'
import { readFile } from 'node:fs/promises'

// Deliberate operator command, never run by server startup. Additive and re-runnable.
// In Railway production context (MYSQL_PUBLIC_URL), defaults to read-only inspection unless --apply is passed.
const useRailwayUrl = Boolean(process.env.MYSQL_PUBLIC_URL)
if (useRailwayUrl) {
  const expectedProject = '2f68950e-b267-4ace-8f96-ef0dd23f848c'
  const expectedEnvironment = '8083807d-f8ec-4d96-b6ba-d68ff269544c'
  if (
    process.env.RAILWAY_PROJECT_ID !== expectedProject ||
    process.env.RAILWAY_ENVIRONMENT_ID !== expectedEnvironment ||
    process.env.RAILWAY_SERVICE_NAME !== 'MySQL'
  ) {
    throw new Error('Unexpected Railway database context')
  }
}

const db = useRailwayUrl
  ? await mysql.createConnection(process.env.MYSQL_PUBLIC_URL)
  : (await import('../config/db.js')).default
const shouldApply = useRailwayUrl ? process.argv.includes('--apply') : !process.argv.includes('--inspect')

try {
  const [[identity]] = await db.query('SELECT DATABASE() AS database_name, @@read_only AS read_only')
  const [[before]] = await db.query(
    'SELECT (SELECT COUNT(*) FROM USER_ACCOUNT) AS accounts, (SELECT COUNT(*) FROM ASSESSMENT_ATTEMPT) AS attempts, (SELECT COUNT(*) FROM RECOMMENDATION) AS recommendations'
  )
  const [columnsBefore] = await db.query(
    "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ASSESSMENT_ATTEMPT' AND COLUMN_NAME = 'camera_enabled'"
  )

  if (shouldApply) {
    if (Number(identity.read_only) !== 0) throw new Error('Database is read-only')
    const sql = await readFile(new URL('../migrations/20261121_add_assessment_monitoring.sql', import.meta.url), 'utf8')
    const statements = sql.replace(/^--.*$/gm, '').split(';').map(statement => statement.trim()).filter(Boolean)
    for (const statement of statements) {
      if (/ADD COLUMN camera_enabled/.test(statement) && columnsBefore.length) continue
      await db.query(statement)
    }
  }

  const [tables] = await db.query(
    "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'assessment_monitoring_logs'"
  )
  const [columnsAfter] = await db.query(
    "SELECT COLUMN_NAME, COLUMN_TYPE, COLUMN_DEFAULT FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ASSESSMENT_ATTEMPT' AND COLUMN_NAME = 'camera_enabled'"
  )
  const [[after]] = await db.query(
    'SELECT (SELECT COUNT(*) FROM USER_ACCOUNT) AS accounts, (SELECT COUNT(*) FROM ASSESSMENT_ATTEMPT) AS attempts, (SELECT COUNT(*) FROM RECOMMENDATION) AS recommendations'
  )
  console.log(JSON.stringify({
    action: shouldApply ? 'apply' : 'inspect',
    identity,
    before,
    after,
    monitoringLogsTable: tables.length === 1,
    cameraEnabledColumn: columnsAfter[0] || null,
  }))
} catch (error) {
  console.error('Assessment monitoring migration failed:', error.code || error.message)
  process.exitCode = 1
} finally {
  await db.end()
}
