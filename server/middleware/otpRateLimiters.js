import { rateLimit } from 'express-rate-limit'

export const OTP_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000
export const OTP_IP_RATE_LIMIT_MAX = 30
export const OTP_IDENTITY_RATE_LIMIT_MAX = 10

const rateLimitResponse = {
  message: 'Too many verification attempts. Please wait and try again.',
}

export function createOtpIpRateLimiter({
  windowMs = OTP_RATE_LIMIT_WINDOW_MS,
  max = OTP_IP_RATE_LIMIT_MAX,
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

export function createOtpIdentityRateLimiter(identityFromRequest, {
  windowMs = OTP_RATE_LIMIT_WINDOW_MS,
  max = OTP_IDENTITY_RATE_LIMIT_MAX,
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

const registrationIdentity = (req) => {
  const userId = Number(req.body?.userId)
  return Number.isInteger(userId) && userId > 0 ? `registration:${userId}` : null
}

const passwordResetIdentity = (req) => {
  const email = typeof req.body?.email === 'string'
    ? req.body.email.trim().toLowerCase()
    : ''
  return email ? `password-reset:${email}` : null
}

export const otpIpRateLimiter = createOtpIpRateLimiter()
export const registrationOtpIdentityRateLimiter = createOtpIdentityRateLimiter(registrationIdentity)
export const passwordResetOtpIdentityRateLimiter = createOtpIdentityRateLimiter(passwordResetIdentity)
