import { createHash } from 'node:crypto'
import { rateLimit } from 'express-rate-limit'

export const EMAIL_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000
export const EMAIL_IP_RATE_LIMIT_MAX = 20
export const EMAIL_IDENTITY_RATE_LIMIT_MAX = 5

const message = {
  message: 'Too many email requests. Please wait before trying again.',
}

const normalize = (value) => {
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const normalized = String(value).normalize('NFKC').trim().toLowerCase().slice(0, 254)
  return normalized || null
}

export function emailIdentityKey(prefix, value) {
  const normalized = normalize(value)
  if (!normalized) return null
  return `${prefix}:${createHash('sha256').update(normalized).digest('hex')}`
}

export function createEmailIpRateLimiter({
  windowMs = EMAIL_RATE_LIMIT_WINDOW_MS,
  max = EMAIL_IP_RATE_LIMIT_MAX,
} = {}) {
  return rateLimit({
    windowMs,
    limit: max,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message,
  })
}

export function createEmailIdentityRateLimiter(identityFromRequest, {
  windowMs = EMAIL_RATE_LIMIT_WINDOW_MS,
  max = EMAIL_IDENTITY_RATE_LIMIT_MAX,
} = {}) {
  return rateLimit({
    windowMs,
    limit: max,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: (req) => !identityFromRequest(req),
    keyGenerator: identityFromRequest,
    message,
  })
}

const registrationIdentity = (req) => emailIdentityKey('register', req.body?.email)
const resendIdentity = (req) => emailIdentityKey('resend', req.body?.userId)
const forgotPasswordIdentity = (req) => emailIdentityKey('forgot-password', req.body?.email)

export const registrationEmailIpRateLimiter = createEmailIpRateLimiter()
export const registrationEmailIdentityRateLimiter = createEmailIdentityRateLimiter(registrationIdentity)
export const resendEmailIpRateLimiter = createEmailIpRateLimiter()
export const resendEmailIdentityRateLimiter = createEmailIdentityRateLimiter(resendIdentity)
export const forgotPasswordEmailIpRateLimiter = createEmailIpRateLimiter()
export const forgotPasswordEmailIdentityRateLimiter = createEmailIdentityRateLimiter(forgotPasswordIdentity)
