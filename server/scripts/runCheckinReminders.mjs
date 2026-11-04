import pool from '../config/db.js'
import { runReminders } from '../services/checkinReminderService.js'
import { reminderEmailConfig, buildReminderEmail, sendReminderEmail } from '../services/reminderEmailService.js'

try {
  const { mode } = reminderEmailConfig()
  const result = await runReminders(pool, { mode, send: sendReminderEmail, buildPayload: buildReminderEmail })
  console.log(JSON.stringify({ job: 'checkin-reminders', mode, ...result }))
  if (result.failed || result.review) process.exitCode = 1
} catch {
  console.error('Check-in reminder job failed. Verify database migration and reminder configuration.')
  process.exitCode = 1
} finally {
  await pool.end()
}
