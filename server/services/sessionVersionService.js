import { createHmac, timingSafeEqual } from 'node:crypto'

// Bind sessions to the current password without publishing the stored hash.
export function passwordSessionVersion(passwordHash, secret = process.env.JWT_SECRET) {
  if (typeof passwordHash !== 'string' || !passwordHash || !secret) throw new Error('Session credentials unavailable')
  return createHmac('sha256', secret).update('learnmatch-session-v1:').update(passwordHash).digest('hex')
}

export function matchesPasswordSession(version, passwordHash, secret = process.env.JWT_SECRET) {
  if (typeof version !== 'string' || !/^[a-f0-9]{64}$/.test(version)) return false
  return timingSafeEqual(Buffer.from(version, 'hex'), Buffer.from(passwordSessionVersion(passwordHash, secret), 'hex'))
}
