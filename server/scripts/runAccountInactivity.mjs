import pool from '../config/db.js'
import { runInactivityChecks } from '../services/accountInactivityService.js'
import { inactivityEmailConfig, sendInactivityEmail, buildInactivityEmail } from '../services/inactivityEmailService.js'
import { inactivityDeletionConfig, runInactivityDeletions } from '../services/inactivityDeletionService.js'

try {
  const { mode } = inactivityEmailConfig()
  inactivityDeletionConfig() // Validate the kill switch before doing any work.
  const result = await runInactivityChecks(pool, { mode, send: sendInactivityEmail, buildPayload: buildInactivityEmail })
  console.log(JSON.stringify({ job: 'account-inactivity', mode, ...result }))
  if (result.failed || result.review) process.exitCode = 1
  const deletion = await runInactivityDeletions(pool)
  console.log(JSON.stringify({ job: 'inactivity-deletion', ...deletion }))
  if (deletion.failed || deletion.policyBlocked) process.exitCode = 1
} catch {
  console.error('Account inactivity job failed. Verify migration, database, and email configuration.')
  process.exitCode = 1
} finally {
  await pool.end()
}
