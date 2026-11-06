import pool from '../config/db.js'
import { runInactivityChecks } from '../services/accountInactivityService.js'
import { inactivityEmailConfig, sendInactivityEmail, buildInactivityEmail } from '../services/inactivityEmailService.js'

try {
  const { mode } = inactivityEmailConfig()
  const result = await runInactivityChecks(pool, { mode, send: sendInactivityEmail, buildPayload: buildInactivityEmail })
  console.log(JSON.stringify({ job: 'account-inactivity', mode, ...result }))
  if (result.failed || result.review) process.exitCode = 1
} catch {
  console.error('Account inactivity job failed. Verify migration, database, and email configuration.')
  process.exitCode = 1
} finally {
  await pool.end()
}
