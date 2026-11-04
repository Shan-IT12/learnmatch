import mysql from 'mysql2/promise'
import { readFile } from 'node:fs/promises'

// Deliberate operator command, never invoked by server/worker startup.
const expectedProject = '2f68950e-b267-4ace-8f96-ef0dd23f848c'
const expectedEnvironment = '8083807d-f8ec-4d96-b6ba-d68ff269544c'
if (process.env.RAILWAY_PROJECT_ID !== expectedProject || process.env.RAILWAY_ENVIRONMENT_ID !== expectedEnvironment || process.env.RAILWAY_SERVICE_NAME !== 'MySQL') {
  throw new Error('Unexpected Railway database context')
}
if (!process.env.MYSQL_PUBLIC_URL) throw new Error('Missing Railway MySQL connection')
const db = await mysql.createConnection(process.env.MYSQL_PUBLIC_URL)
try {
  const [[identity]] = await db.query('SELECT DATABASE() AS database_name, @@read_only AS read_only')
  if (identity.database_name !== 'railway' || Number(identity.read_only) !== 0) throw new Error('Unexpected database identity')
  const [parents] = await db.query("SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND ((TABLE_NAME='USER_ACCOUNT' AND COLUMN_NAME='user_id') OR (TABLE_NAME='COLLEGE_TERM' AND COLUMN_NAME='term_id'))")
  if (parents.length !== 2 || parents.some(row => row.COLUMN_TYPE !== 'int')) throw new Error('Parent schema does not match migration')
  const [[before]] = await db.query('SELECT (SELECT COUNT(*) FROM USER_ACCOUNT) AS accounts, (SELECT COUNT(*) FROM COLLEGE_TERM) AS terms, (SELECT COUNT(*) FROM SEMESTER_CHECKIN) AS checkins')
  if (process.argv.includes('--apply')) {
    const sql = await readFile(new URL('../migrations/20261104_add_checkin_reminders.sql', import.meta.url), 'utf8')
    for (const statement of sql.split(';').map(s => s.trim()).filter(Boolean)) await db.query(statement)
  }
  const [tables] = await db.query("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('CHECKIN_REMINDER','CHECKIN_REMINDER_PREFERENCE')")
  const [[after]] = await db.query('SELECT (SELECT COUNT(*) FROM USER_ACCOUNT) AS accounts, (SELECT COUNT(*) FROM COLLEGE_TERM) AS terms, (SELECT COUNT(*) FROM SEMESTER_CHECKIN) AS checkins')
  const [deliverySummary] = tables.some(row => row.TABLE_NAME === 'CHECKIN_REMINDER')
    ? await db.query('SELECT email_status, COUNT(*) AS reminders, SUM(attempts) AS attempts FROM CHECKIN_REMINDER GROUP BY email_status')
    : [[]]
  console.log(JSON.stringify({ action: process.argv.includes('--apply') ? 'apply' : 'inspect', identity, before, after, tables: tables.map(row => row.TABLE_NAME), deliverySummary }))
} finally { await db.end() }
