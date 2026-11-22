import express from 'express'
import authorizeRoles, { STAFF_ROLES } from '../middleware/authorizeRoles.js'
import { getSystemErrorLogs } from '../services/systemErrorLogService.js'

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

  return router
}

export default createSystemLogRouter
