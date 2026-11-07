import { Webhook } from 'svix'

export const DELIVERY_EVENTS = new Set(['email.delivered', 'email.bounced', 'email.failed',
  'email.complained', 'email.suppressed', 'email.delivery_delayed'])

export function verifyInactivityDelivery(rawBody, headers, secret) {
  if (!secret) throw new Error('Webhook verification unavailable')
  if (!Buffer.isBuffer(rawBody)) throw new Error('Raw webhook body required')
  const id = headers['svix-id']
  if (typeof id !== 'string' || !/^[\w-]{1,255}$/.test(id)) throw new Error('Invalid event identity')
  new Webhook(secret).verify(rawBody, headers)
  const event = JSON.parse(rawBody.toString('utf8'))
  if (!DELIVERY_EVENTS.has(event.type)) return null
  if (typeof event.data?.email_id !== 'string' || !/^[\w-]{1,255}$/.test(event.data.email_id)
    || !Array.isArray(event.data.to) || event.data.to.length !== 1 || typeof event.data.to[0] !== 'string'
    || typeof event.created_at !== 'string' || !/Z$/.test(event.created_at)
    || !Number.isFinite(Date.parse(event.created_at)) || Date.parse(event.created_at) > Date.now()) {
    throw new Error('Invalid delivery event')
  }
  return { id, providerId: event.data.email_id, type: event.type,
    recipient: event.data.to[0], occurredAt: new Date(event.created_at) }
}

// Only signed, recipient-matched evidence enters this table. Acceptance, manual
// dashboard checks and arbitrary application callers cannot confer delivery.
export async function recordInactivityDelivery(pool, event) {
  const db = await pool.getConnection()
  let committing=false, destroyed=false
  try {
    let [matches] = await db.execute('SELECT email_id, user_id FROM ACCOUNT_INACTIVITY_EMAIL WHERE provider_id = ?', [event.providerId])
    if (matches.length > 1) throw new Error('Ambiguous receipt')
    if (!matches.length) {
      // A callback can beat persistence of an accepted receipt. Ask Resend to
      // retry while that recipient has ambiguous work; ignore unrelated/deleted mail.
      const [pending] = await db.execute(`SELECT email_id FROM ACCOUNT_INACTIVITY_EMAIL
        WHERE email_status = 'sending' AND provider_id IS NULL
        AND JSON_UNQUOTE(JSON_EXTRACT(payload, '$.to[0]')) = ? LIMIT 1`, [event.recipient])
      if (pending.length) return { retry:true }
      // Acceptance can commit between the first lookup and the pending lookup.
      ;[matches] = await db.execute('SELECT email_id, user_id FROM ACCOUNT_INACTIVITY_EMAIL WHERE provider_id = ?', [event.providerId])
      if (!matches.length) return { ignored:true }
      if (matches.length > 1) throw new Error('Ambiguous receipt')
    }
    await db.beginTransaction()
    const [accounts] = await db.execute('SELECT user_id FROM USER_ACCOUNT WHERE user_id = ? FOR UPDATE', [matches[0].user_id])
    if (!accounts.length) { await db.rollback(); return { ignored: true } }
    const [[email]] = await db.execute('SELECT * FROM ACCOUNT_INACTIVITY_EMAIL WHERE email_id = ? FOR UPDATE', [matches[0].email_id])
    if (!email || email.provider_id !== event.providerId) { await db.rollback(); return { retry: true } }
    const payload = typeof email.payload === 'string' ? JSON.parse(email.payload) : email.payload
    if (payload?.to?.length !== 1 || payload.to[0] !== event.recipient) throw new Error('Recipient mismatch')
    await db.execute(`INSERT INTO ACCOUNT_INACTIVITY_DELIVERY (event_id,email_id,event_type,occurred_at,received_at)
      VALUES (?,?,?,?,UTC_TIMESTAMP(3)) ON DUPLICATE KEY UPDATE event_id=event_id`, [event.id,email.email_id,event.type,
      event.occurredAt.toISOString().slice(0,-1).replace('T',' ')])
    const [[stored]] = await db.query({sql:'SELECT email_id,event_type,occurred_at FROM ACCOUNT_INACTIVITY_DELIVERY WHERE event_id=?',dateStrings:true}, [event.id])
    if (String(stored.email_id) !== String(email.email_id) || stored.event_type !== event.type
      || Date.parse(`${stored.occurred_at.replace(' ','T')}Z`) !== event.occurredAt.getTime()) throw new Error('Conflicting event identity')
    committing=true
    await db.commit()
    return { recorded: true }
  } catch (error) {
    if (committing) {db.destroy();destroyed=true}
    else await db.rollback()
    throw error
  } finally { if(!destroyed) db.release() }
}
