import pool from '../../config/db.js'
import { runReminders } from '../../services/checkinReminderService.js'
import { buildReminderEmail } from '../../services/reminderEmailService.js'

if (!/^learnmatch_reminder_qa_[a-f0-9]{12}$/.test(process.env.DB_NAME || '') || !['localhost', '127.0.0.1'].includes(process.env.DB_HOST)) throw new Error('Isolated local QA database required')
const endpoint = new URL(process.env.REMINDER_QA_PROVIDER_URL)
if (endpoint.hostname !== '127.0.0.1' || endpoint.protocol !== 'http:') throw new Error('Only a loopback mock provider is allowed')
try {
  const result = await runReminders(pool, {
    mode: 'live', // Injected loopback sender only; never uses Resend.
    buildPayload: (user, target, id) => buildReminderEmail(user, target, id, {
      LEARNMATCH_PUBLIC_URL: 'https://staging.example.test', RESEND_FROM_EMAIL: 'qa@example.test',
    }),
    send: async (payload, key) => {
      const response = await fetch(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
        body: JSON.stringify(payload), signal: AbortSignal.timeout(5000),
      })
      if (!response.ok) throw new Error('Mock provider rejected request')
      const receipt = await response.json()
      // Simulate sudden process loss after acceptance, before saving receipt.
      if (process.env.REMINDER_QA_CRASH === 'after-acceptance') process.exit(86)
      return receipt
    },
  })
  console.log(JSON.stringify(result))
} finally { await pool.end() }
