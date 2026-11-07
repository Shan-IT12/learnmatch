import express from 'express'
import { verifyInactivityDelivery, recordInactivityDelivery } from '../services/inactivityDeliveryService.js'

export function createInactivityWebhookRouter(pool, env = process.env) {
  const router = express.Router()
  router.post('/', express.raw({ type: 'application/json', limit: '64kb' }), async (req, res) => {
    if (!env.RESEND_INACTIVITY_WEBHOOK_SECRET) return res.sendStatus(503)
    let event
    try { event = verifyInactivityDelivery(req.body, req.headers, env.RESEND_INACTIVITY_WEBHOOK_SECRET) }
    catch { return res.sendStatus(400) }
    if (!event) return res.sendStatus(204)
    try {
      const result = await recordInactivityDelivery(pool, event)
      return res.sendStatus(result.retry ? 503 : 204)
    } catch {
      console.error(JSON.stringify({ job: 'inactivity-delivery', failed: true }))
      return res.sendStatus(503)
    }
  })
  router.use((_error, _req, res, _next) => res.sendStatus(400))
  return router
}
