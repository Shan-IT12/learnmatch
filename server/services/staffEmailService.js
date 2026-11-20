const productionOrigin = 'https://www.learnmatch.online'
const loopbackHosts = ['localhost', '127.0.0.1', '::1', '[::1]']

const templates = {
  admin_setup: {
    path: '/admin/account/setup',
    subject: 'Set up your LearnMatch Administrator account',
    heading: 'Set up Administrator access',
    message: 'An operator started setup for your Administrator account. Link this email address and choose a password to finish.',
    action: 'Set up account',
    minutes: 60,
  },
  admin_reset: {
    path: '/admin/account/reset',
    subject: 'Reset your LearnMatch Administrator password',
    heading: 'Reset your Administrator password',
    message: 'Use this link to choose a new password for your LearnMatch Administrator account.',
    action: 'Reset password',
    minutes: 30,
  },
  validator_invite: {
    path: '/validator/account/invite',
    subject: 'Your LearnMatch Course Validator invitation',
    heading: 'You’re invited to be a Course Validator',
    message: 'A LearnMatch Administrator invited you to review courses. Open your application to share your expertise and submit one supporting credential.',
    action: 'Open Validator application',
    minutes: 7 * 24 * 60,
  },
  validator_verify: {
    path: '/validator/account/verify',
    subject: 'Verify your LearnMatch Course Validator email',
    heading: 'Verify your Validator email',
    message: 'Confirm your email so a LearnMatch Administrator can review your application. You can sign in after approval.',
    action: 'Verify email address',
    minutes: 60,
  },
  validator_reset: {
    path: '/validator/account/reset',
    subject: 'Reset your LearnMatch Course Validator password',
    heading: 'Reset your Validator password',
    message: 'Use this link to choose a new password for your LearnMatch Course Validator account.',
    action: 'Reset password',
    minutes: 30,
  },
}

export const staffTokenLifetime = purpose => templates[purpose].minutes

function staffEmailOrigin(env) {
  const nonProduction = ['development', 'test'].includes(env.NODE_ENV)
  if (!nonProduction || /^prod(?:uction)?$/i.test(env.RAILWAY_ENVIRONMENT_NAME || '')) return productionOrigin

  const url = new URL(env.FRONTEND_URL)
  const isLoopback = loopbackHosts.includes(url.hostname)
  const localRuntime = !env.RAILWAY_ENVIRONMENT_ID && loopbackHosts.includes(env.DB_HOST)
  if (url.username || url.password || (isLoopback && !localRuntime) ||
    (url.protocol !== 'https:' && !(url.protocol === 'http:' && isLoopback && localRuntime))) {
    throw new Error('Invalid staff email frontend origin')
  }
  return url.origin
}

const escapeHtml = value => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])

function duration(minutes) {
  const [size, unit] = minutes % 1440 === 0 ? [1440, 'day'] : minutes % 60 === 0 ? [60, 'hour'] : [1, 'minute']
  const count = minutes / size
  return `${count} ${unit}${count === 1 ? '' : 's'}`
}

export function buildStaffEmail(purpose, to, token, env = process.env) {
  if (typeof token !== 'string' || !/^[a-zA-Z0-9_-]{43}$/.test(token)) throw new Error('Invalid staff email token')
  const { path, subject, heading, message, action, minutes } = templates[purpose]
  const link = new URL(path, staffEmailOrigin(env))
  link.hash = token
  const url = link.href
  const expiry = duration(minutes)
  const help = 'If you weren’t expecting this email, you can ignore it.'
  return {
    to,
    subject,
    text: `${heading}\n\n${message}\n\n${action}\n${url}\n\nThis link is valid for ${expiry} and can be used once. ${help}`,
    html: `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;background:#faf6f0;color:#1c1917;font-family:Arial,sans-serif">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#faf6f0"><tr><td align="center" style="padding:32px 16px">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;border:1px solid #eadbd0;border-radius:16px;background:#ffffff">
    <tr><td style="padding:20px 24px;background:#7c2d12;border-radius:15px 15px 0 0;color:#ffffff;font-size:20px;font-weight:bold">LearnMatch</td></tr>
    <tr><td style="padding:28px 24px">
      <h1 style="margin:0 0 14px;font-size:26px;line-height:1.25;color:#1c1917">${escapeHtml(heading)}</h1>
      <p style="margin:0 0 22px;font-size:16px;line-height:1.6;color:#44403c">${escapeHtml(message)}</p>
      <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 22px"><tr><td bgcolor="#9a3412" style="border-radius:8px">
        <a href="${escapeHtml(url)}" style="display:inline-block;border:1px solid #9a3412;border-radius:8px;padding:13px 20px;background:#9a3412;color:#ffffff;font-size:16px;font-weight:bold;text-decoration:none">${escapeHtml(action)}</a>
      </td></tr></table>
      <p style="margin:0 0 20px;padding:12px 14px;border-radius:8px;background:#fff3e6;font-size:14px;line-height:1.5;color:#7c2d12">This link is valid for <strong>${escapeHtml(expiry)}</strong> and can be used once.</p>
      <p style="margin:0 0 6px;font-size:13px;line-height:1.5;color:#57534e">If the button doesn’t open, copy this link into your browser.</p>
      <p style="margin:0;word-break:break-all;font-size:13px;line-height:1.5"><a href="${escapeHtml(url)}" style="color:#9a3412">${escapeHtml(url)}</a></p>
    </td></tr>
    <tr><td style="padding:18px 24px;border-top:1px solid #eadbd0;font-size:13px;line-height:1.5;color:#57534e">${escapeHtml(help)}</td></tr>
  </table>
</td></tr></table></body></html>`,
  }
}
