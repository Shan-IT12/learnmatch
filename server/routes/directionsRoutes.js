import express from 'express'
import { DirectionsError, getDrivingDirections } from '../services/directionsService.js'
import { rateLimit, ipKeyGenerator } from 'express-rate-limit'

export function createDirectionsRouter({
  getDirections = getDrivingDirections,
  windowMs = 60 * 1000,
  clientLimit = 30,
  serviceLimit = 120,
} = {}) {
  const router = express.Router()
  const options = {
    windowMs,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, res) => {
      res.setHeader('Cache-Control', 'no-store')
      res.status(429).json({ code: 'DIRECTIONS_RATE_LIMITED', message: 'Too many directions requests. Please wait a minute and try again.' })
    },
  }
  // req.ip uses the existing explicit trusted-proxy policy; never trust raw XFF.
  const clientLimiter = rateLimit({ ...options, limit: clientLimit,
    identifier: 'directions-client', keyGenerator: req => ipKeyGenerator(req.ip) })
  // Per-process cap bounds provider usage even across many client addresses.
  const serviceLimiter = rateLimit({ ...options, limit: serviceLimit,
    identifier: 'directions-service', keyGenerator: () => 'directions-service' })

  router.post('/', clientLimiter, serviceLimiter, async (req, res) => {
    try {
      res.json(await getDirections(req.body))
    } catch (error) {
      if (error instanceof DirectionsError) {
        return res.status(error.status).json({ message: error.message, code: error.code })
      }
      console.error('Directions request error:', error)
      res.status(503).json({
        message: 'Directions are temporarily unavailable.',
        code: 'DIRECTIONS_UNAVAILABLE',
      })
    }
  })
  return router
}

export default createDirectionsRouter()
