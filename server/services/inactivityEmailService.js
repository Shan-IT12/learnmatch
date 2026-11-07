import { reminderEmailConfig, sendReminderEmail } from './reminderEmailService.js'

// Reuse the existing Resend transport and configuration validation independently
// of optional semester reminder preferences and their delivery mode.
const emailEnv = env => ({ ...env, CHECKIN_REMINDER_EMAIL_MODE: env.INACTIVITY_EMAIL_MODE || 'dry-run' })
export const inactivityEmailConfig = (env = process.env) => reminderEmailConfig(emailEnv(env))
export const sendInactivityEmail = (payload, key, options = {}) => sendReminderEmail(payload, key, {
  ...options, env: emailEnv(options.env || process.env),
})

export function buildInactivityEmail(user, stage, env = process.env) {
  const login = `${new URL(env.LEARNMATCH_PUBLIC_URL).origin}/login`
  const final = stage === 'final'
  const subject = final ? 'Final reminder: keep your LearnMatch account' : 'Keep your LearnMatch account active'
  const text = `${subject}\n\nYour account has had no successful login for at least 365 days. ${final
    ? 'Your account will become eligible for inactivity deletion in 7 days or later.'
    : 'You have a 30-day grace period from this warning before your account can become eligible for inactivity deletion.'}
\nSign in successfully to cancel pending inactivity deletion and keep your account: ${login}
\nInactivity deletion would remove your account and linked student records from the active LearnMatch database. ${env.INACTIVITY_DELETION_MODE === 'enabled'
    ? 'After the notice periods, an eligible account may be automatically deleted only when the required delivery, retention, and account-clearance safeguards are satisfied.'
    : 'Automatic inactivity deletion is currently disabled while retention, deletion scope, and production safeguards are verified.'} Eligibility does not mean your account has been deleted. See ${new URL(env.LEARNMATCH_PUBLIC_URL).origin}/privacy for details.`
  const tags = [{ name: 'learnmatch_flow', value: 'account_inactivity' }]
  if (/^[A-Za-z0-9_-]{1,100}$/.test(env.INACTIVITY_NOTICE_POLICY_VERSION || '')
    && /^[A-Za-z0-9_-]{1,100}$/.test(env.INACTIVITY_NOTICE_SCOPE_VERSION || '')) {
    tags.push({ name: 'inactivity_policy', value: env.INACTIVITY_NOTICE_POLICY_VERSION },
      { name: 'inactivity_scope', value: env.INACTIVITY_NOTICE_SCOPE_VERSION })
  }
  return { from: `LearnMatch <${env.RESEND_FROM_EMAIL}>`, to: [user.email], subject, text,
    tags }
}
