import { createHash } from 'node:crypto'
import { rateLimit } from 'express-rate-limit'

export const LOGIN_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000
export const USER_LOGIN_IP_RATE_LIMIT_MAX = 30
export const USER_LOGIN_IDENTITY_RATE_LIMIT_MAX = 10
export const ADMIN_LOGIN_IP_RATE_LIMIT_MAX = 10
export const ADMIN_LOGIN_IDENTITY_RATE_LIMIT_MAX = 5

const rateLimitResponse = {
  message: 'Too many failed login attempts. Please wait and try again.',
}

export function normalizeLoginIdentity(value) {
  if (typeof value !== 'string') return null
  const normalized = value.normalize('NFKC').trim().toLowerCase().slice(0, 254)
  return normalized || null
}

export function loginIdentityKey(prefix, value) {
  const normalized = normalizeLoginIdentity(value)
  if (!normalized) return null
  const digest = createHash('sha256').update(normalized).digest('hex')
  return `${prefix}:${digest}`
}

export function createLoginIpRateLimiter({
  windowMs = LOGIN_RATE_LIMIT_WINDOW_MS,
  max,
} = {}) {
  return rateLimit({
    windowMs,
    limit: max,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    message: rateLimitResponse,
  })
}

export function createLoginIdentityRateLimiter(identityFromRequest, {
  windowMs = LOGIN_RATE_LIMIT_WINDOW_MS,
  max,
} = {}) {
  return rateLimit({
    windowMs,
    limit: max,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    skip: (req) => !identityFromRequest(req),
    keyGenerator: (req) => identityFromRequest(req),
    message: rateLimitResponse,
  })
}

const userIdentity = (req) => loginIdentityKey('user-login', req.body?.identifier)
const adminIdentity = (req) => loginIdentityKey('admin-login', req.body?.username)

export const userLoginIpRateLimiter = createLoginIpRateLimiter({
  max: USER_LOGIN_IP_RATE_LIMIT_MAX,
})
export const userLoginIdentityRateLimiter = createLoginIdentityRateLimiter(userIdentity, {
  max: USER_LOGIN_IDENTITY_RATE_LIMIT_MAX,
})
export const adminLoginIpRateLimiter = createLoginIpRateLimiter({
  max: ADMIN_LOGIN_IP_RATE_LIMIT_MAX,
})
export const adminLoginIdentityRateLimiter = createLoginIdentityRateLimiter(adminIdentity, {
  max: ADMIN_LOGIN_IDENTITY_RATE_LIMIT_MAX,
})
