import express from 'express'
import { rateLimit } from 'express-rate-limit'
import { allowedCorsOrigins } from '../config/security.js'
import { AccountDeletionError, deleteStudentAccount } from '../services/accountDeletionService.js'

export function createAccountRouter(pool, authenticateToken) {
  const router = express.Router()
  const options = { windowMs: 15 * 60 * 1000, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { code: 'RATE_LIMITED', message: 'Too many deletion attempts. Please wait 15 minutes before trying again.' } }
  // A fixed, bounded service budget protects JWT verification/account lookups.
  // This is an availability circuit breaker, not an asserted end-user IP quota.
  // Neither public nor private callers can rotate it with forwarding headers.
  const serviceLimit = rateLimit({ ...options, windowMs: 60 * 1000, limit: 300,
    identifier: 'account-deletion-service', keyGenerator: () => 'deletion-service',
    message: { code: 'RATE_LIMITED', message: 'Account deletion is temporarily busy. Please wait one minute before trying again.' } })
  const requireStudent = (req, res, next) => {
    if (req.user.role === 'admin' || req.user.adminId !== undefined) return res.status(403).json({ message: 'Student access only.' })
    if (!Number.isSafeInteger(req.user.userId) || req.user.userId <= 0) return res.status(401).json({ message: 'Please sign in again.' })
    next()
  }
  router.get('/', (_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next() }, authenticateToken, requireStudent, async (req, res) => {
    try {
      const [rows] = await pool.query(
        'SELECT username, email FROM USER_ACCOUNT WHERE user_id = ? AND is_active = 1 LIMIT 1',
        [req.user.userId]
      )
      if (rows.length !== 1) return res.status(401).json({ message: 'Please sign in again.' })
      return res.json({ username: rows[0].username, email: rows[0].email })
    } catch {
      return res.status(503).json({ message: 'Account information is temporarily unavailable. Please try again.' })
    }
  })
  const accountLimit = rateLimit({ ...options, limit: 5, identifier: 'account-deletion-account', keyGenerator: req => `delete:${req.user.userId}` })
  router.delete('/', (_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next() }, serviceLimit, authenticateToken, requireStudent, accountLimit, express.json({ limit: '8kb' }), async (req, res) => {
    const origin = req.get('origin')
    if ((origin && !allowedCorsOrigins().has(origin)) || (!origin && req.get('sec-fetch-site') === 'cross-site')) {
      return res.status(403).json({ message: 'This request origin is not allowed.' })
    }
    const body = req.body
    if (!req.is('application/json') || !body || Array.isArray(body) || Object.keys(req.query).length !== 0
      || Object.keys(body).length !== 2 || !Object.hasOwn(body, 'currentPassword') || !Object.hasOwn(body, 'confirmation')
      || typeof body.currentPassword !== 'string' || !body.currentPassword.length || body.currentPassword.length > 1024
      || body.confirmation !== 'DELETE') {
      return res.status(400).json({ code: 'INVALID_REQUEST', message: 'Enter your current password and confirm permanent account deletion.' })
    }
    try {
      return res.json(await deleteStudentAccount(pool, req.user.userId, body.currentPassword))
    } catch (error) {
      // Do not log database errors, request bodies, identities, or credentials.
      return res.status(error instanceof AccountDeletionError ? error.status : 503).json({
        code: error instanceof AccountDeletionError ? error.code : 'DELETION_FAILED',
        message: error instanceof AccountDeletionError ? error.message : 'Account deletion was not completed. Please try again later.',
      })
    } finally {
      delete body.currentPassword
    }
  })
  // Consume JSON parser errors here: Express's default error logger can include
  // submitted text in its syntax error message. Never expose/log that text.
  router.use((error, _req, res, _next) => {
    res.status(error.type === 'entity.too.large' ? 413 : 400).json({ code: 'INVALID_REQUEST', message: 'Invalid account deletion request.' })
  })
  return router
}
