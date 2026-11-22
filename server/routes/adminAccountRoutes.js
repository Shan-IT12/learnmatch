import express from 'express'
import authorizeRoles, { STAFF_ROLES } from '../middleware/authorizeRoles.js'
import { sendResendMail } from '../services/resendEmailService.js'
import {
  AdminAccountError,
  createAdminAccount,
  getAdminSelf,
  listAdminAccounts,
  regenerateAdminSetupLink,
} from '../services/adminAccountService.js'

export function createAdminAccountRouter(database, authenticateAdmin) {
  const router = express.Router()

  router.get('/api/admin/me', authenticateAdmin, async (req, res, next) => {
    try {
      const admin = await getAdminSelf(database, req.admin.adminId)
      if (!admin) return res.status(404).json({ message: 'Admin account not found.' })
      return res.json({ admin })
    } catch (error) {
      return next(error)
    }
  })

  router.get(
    '/api/admin/accounts',
    authenticateAdmin,
    authorizeRoles(STAFF_ROLES.SYSTEM_DEVELOPER, STAFF_ROLES.SYSTEM_ADMIN),
    async (req, res, next) => {
      try {
        const roleFilter = req.admin.role === STAFF_ROLES.SYSTEM_ADMIN ? STAFF_ROLES.SYSTEM_ADMIN : null
        const accounts = await listAdminAccounts(database, { roleFilter })
        return res.json({ accounts })
      } catch (error) {
        return next(error)
      }
    }
  )

  router.post(
    '/api/admin/accounts',
    authenticateAdmin,
    authorizeRoles(STAFF_ROLES.SYSTEM_DEVELOPER, STAFF_ROLES.SYSTEM_ADMIN),
    async (req, res, next) => {
      try {
        const { account, setupUrl, emailSent } = await createAdminAccount(database, req.body, {
          actorRole: req.admin.role,
          actorAdminId: req.admin.adminId,
          send: sendResendMail,
        })
        return res.status(201).json({
          message: emailSent
            ? 'Account created and setup link emailed. You can also copy the link below.'
            : 'Account created! Copy and share the setup link below so the new admin can set their password.',
          account,
          setupUrl,
          emailSent,
        })
      } catch (error) {
        if (error instanceof AdminAccountError) {
          return res.status(error.status).json({ message: error.message })
        }
        return next(error)
      }
    }
  )

  router.post(
    '/api/admin/accounts/:adminId/setup-link',
    authenticateAdmin,
    authorizeRoles(STAFF_ROLES.SYSTEM_DEVELOPER, STAFF_ROLES.SYSTEM_ADMIN),
    async (req, res, next) => {
      try {
        const result = await regenerateAdminSetupLink(database, req.params.adminId, {
          actorRole: req.admin.role,
          actorAdminId: req.admin.adminId,
          send: sendResendMail,
        })
        return res.json({
          message: result.emailSent
            ? 'New setup link emailed and ready to copy.'
            : 'New setup link generated. Copy and share it below.',
          ...result,
        })
      } catch (error) {
        if (error instanceof AdminAccountError) {
          return res.status(error.status).json({ message: error.message })
        }
        return next(error)
      }
    }
  )

  return router
}

export default createAdminAccountRouter
