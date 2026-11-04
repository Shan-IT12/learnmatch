const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])

// MySQL JSON storage may reorder object keys. Keep the wire representation
// identical on the first send and a retry loaded after a process restart.
export function canonicalReminderPayload(value) {
  if (Array.isArray(value)) return value.map(canonicalReminderPayload)
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalReminderPayload(value[key])]))
  return value
}

export function reminderEmailConfig(env = process.env) {
  const mode = env.CHECKIN_REMINDER_EMAIL_MODE || 'dry-run'
  if (!['dry-run', 'live'].includes(mode)) throw new Error('Invalid reminder email mode')
  if (mode === 'live') {
    const url = new URL(env.LEARNMATCH_PUBLIC_URL)
    if (url.protocol !== 'https:' || url.username || url.password || !env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL) throw new Error('Reminder email configuration incomplete')
  }
  return { mode }
}

export function buildReminderEmail(user, target, id, env = process.env) {
  const origin = new URL(env.LEARNMATCH_PUBLIC_URL).origin
  const link = `${origin}/college/checkin?reminder=${id}`
  const preferences = `${origin}/college?notifications=1`
  const name = user.full_name || user.username || 'Student'
  const description = `${target.semester} · ${target.phase} check-in · Target date: ${target.dueDate} (Asia/Manila)`
  return {
    from: `LearnMatch <${env.RESEND_FROM_EMAIL}>`, to: [user.email], subject: target.title,
    text: `Hi ${name},\n\n${target.message}\n${description}\n\nComplete Check-in: ${link}\n\nYou can turn off reminder emails in the notification panel: ${preferences}`,
    html: `<html><body style="margin:0;background:#f8fafc;font-family:Arial,sans-serif;color:#334155"><div style="max-width:560px;margin:auto;padding:28px 20px"><h1 style="color:#ea580c;font-size:24px">LearnMatch</h1><div style="background:white;padding:24px;border-radius:16px"><h2 style="font-size:21px">${escapeHtml(target.title)}</h2><p>Hi ${escapeHtml(name)},</p><p style="line-height:1.7">${escapeHtml(target.message)}</p><p style="line-height:1.7">${escapeHtml(description)}</p><a href="${escapeHtml(link)}" style="display:inline-block;padding:14px 20px;background:#c2410c;color:white;border-radius:8px;text-decoration:none">Complete Check-in</a></div><p style="font-size:13px;line-height:1.6">You control your reminders. <a href="${escapeHtml(preferences)}">Sign in to turn off reminder emails</a> in the notification panel.</p></div></body></html>`,
  }
}

export async function sendReminderEmail(payload, key, { env = process.env, fetchImpl = fetch } = {}) {
  if (reminderEmailConfig(env).mode !== 'live') throw new Error('Live reminders disabled')
  const response = await fetchImpl('https://api.resend.com/emails', {
    method: 'POST', signal: AbortSignal.timeout(15000),
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': key },
    body: JSON.stringify(canonicalReminderPayload(payload)),
  })
  if (!response.ok) throw new Error(`Reminder provider status ${response.status}`)
  const result = await response.json()
  if (!result.id) throw new Error('Missing delivery receipt')
  return result
}
