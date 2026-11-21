import { Router } from 'express'
import {
  enableAttemptCamera,
  getAttemptMonitoring,
  latestCompletedAttemptId,
  parseAttemptParam,
  recordMonitoringEvent,
  validateCameraToggle,
  validateMonitoringEvent,
} from '../services/assessmentMonitoringService.js'

export function createAssessmentMonitoringRouter(pool, authenticateToken, authenticateAdmin) {
  const router = Router()
  const noStore = (_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next() }
  const handle = fn => async (req, res) => {
    const attemptId = parseAttemptParam(req.params.attemptId)
    if (!attemptId) return res.status(400).json({ message: 'Invalid assessment attempt.' })
    try { await fn(req, res, attemptId) } catch (error) {
      console.error('Assessment monitoring error:', error.code || error.message)
      res.status(500).json({ message: 'Assessment monitoring is temporarily unavailable.' })
    }
  }
  const missing = res => res.status(404).json({ message: 'Assessment attempt not found.' })
  const inactive = res => res.status(409).json({ message: 'This assessment attempt is no longer active.' })

  router.post('/api/assessment-attempts/:attemptId/monitoring/events', noStore, authenticateToken, handle(async (req, res, attemptId) => {
    const event = validateMonitoringEvent(req.body)
    if (event.error) return res.status(400).json({ message: event.error })
    const outcome = await recordMonitoringEvent(pool, req.user.userId, attemptId, event)
    if (outcome === 'not_found') return missing(res)
    if (outcome === 'not_active') return inactive(res)
    if (outcome === 'limit_reached') return res.status(429).json({ message: 'Monitoring event limit reached for this attempt.' })
    res.status(201).json({ recorded: true })
  }))

  router.put('/api/assessment-attempts/:attemptId/monitoring/camera', noStore, authenticateToken, handle(async (req, res, attemptId) => {
    const toggle = validateCameraToggle(req.body)
    if (toggle.error) return res.status(400).json({ message: toggle.error })
    const outcome = await enableAttemptCamera(pool, req.user.userId, attemptId, toggle.enabled)
    if (outcome === 'not_found') return missing(res)
    if (outcome === 'not_active') return inactive(res)
    res.json({ cameraEnabled: toggle.enabled, mode: toggle.enabled ? 'Verified' : 'Standard' })
  }))

  const handleLatestMonitoring = async (req, res) => {
    try {
      const attemptId = await latestCompletedAttemptId(pool, req.user.userId)
      const summary = attemptId && await getAttemptMonitoring(pool, attemptId, { userId: req.user.userId })
      if (!summary) return missing(res)
      res.json(summary)
    } catch (error) {
      console.error('Assessment monitoring error:', error.code || error.message)
      res.status(500).json({ message: 'Assessment monitoring is temporarily unavailable.' })
    }
  }

  // Registered before the :attemptId route so "latest" is never parsed as an id.
  router.get('/api/monitoring/latest', noStore, authenticateToken, handleLatestMonitoring)
  router.get('/api/assessment-attempts/latest/monitoring', noStore, authenticateToken, handleLatestMonitoring)

  router.get('/api/assessment-attempts/:attemptId/monitoring', noStore, authenticateToken, handle(async (req, res, attemptId) => {
    const summary = await getAttemptMonitoring(pool, attemptId, { userId: req.user.userId })
    if (!summary) return missing(res)
    res.json(summary)
  }))

  router.get('/api/admin/assessment-attempts/:attemptId/monitoring', authenticateAdmin, handle(async (_req, res, attemptId) => {
    const summary = await getAttemptMonitoring(pool, attemptId, { admin: true })
    if (!summary) return missing(res)
    res.json(summary)
  }))

  return router
}
