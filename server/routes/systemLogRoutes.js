import express from 'express'
import authorizeRoles, { STAFF_ROLES } from '../middleware/authorizeRoles.js'
import { getSystemErrorLogs, reportSystemErrorToDevelopers } from '../services/systemErrorLogService.js'

export function createSystemLogRouter(database, authenticateAdmin) {
  const router = express.Router()

  router.get(
    '/api/admin/system-logs',
    authenticateAdmin,
    authorizeRoles(STAFF_ROLES.SYSTEM_DEVELOPER, STAFF_ROLES.SYSTEM_ADMIN),
    async (req, res, next) => {
      try {
        const includeStackTrace = req.admin?.role === STAFF_ROLES.SYSTEM_DEVELOPER
        const result = await getSystemErrorLogs(database, {
          page: req.query.page,
          limit: req.query.limit,
          includeStackTrace,
        })
        return res.json(result)
      } catch (error) {
        return next(error)
      }
    }
  )

  router.post(
    '/api/admin/system-logs/:logId/report',
    authenticateAdmin,
    authorizeRoles(STAFF_ROLES.SYSTEM_DEVELOPER, STAFF_ROLES.SYSTEM_ADMIN),
    async (req, res) => {
      try {
        const result = await reportSystemErrorToDevelopers(database, {
          logId: req.params.logId,
          reporterUsername: req.admin?.username || 'System Administrator',
        })
        return res.json({
          message: 'Error report sent to System Developer.',
          ...result,
        })
      } catch (error) {
        if (error?.status) {
          return res.status(error.status).json({ message: error.message })
        }
        if (error?.code === 'EMAIL_PROVIDER_ERROR' || /Resend configuration/i.test(error?.message || '')) {
          return res.status(502).json({ message: 'Could not deliver the email right now. Please try again or copy the error details.' })
        }
        return res.status(500).json({ message: 'Could not send error report to System Developer.' })
      }
    }
  )

  return router
}

export default createSystemLogRouter
