export async function sendResendMail({ to, subject, html, text }) {
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) throw new Error('Resend configuration is incomplete')
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    signal: AbortSignal.timeout(15000),
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: `LearnMatch <${process.env.RESEND_FROM_EMAIL}>`, to: [to], subject, html, text }),
  })
  if (!response.ok) {
    const error = new Error(`Email provider request failed with status ${response.status}`)
    error.code = 'EMAIL_PROVIDER_ERROR'
    error.status = response.status
    throw error
  }
  return response.json()
}
