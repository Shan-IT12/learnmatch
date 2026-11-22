export const STAFF_ROLES = Object.freeze({
  SYSTEM_DEVELOPER: 'system_developer',
  SYSTEM_ADMIN: 'system_admin',
  VALIDATOR: 'validator',
})

export const ADMIN_PANEL_ROLES = Object.freeze([
  STAFF_ROLES.SYSTEM_DEVELOPER,
  STAFF_ROLES.SYSTEM_ADMIN,
])

export function normalizeAdminRole(role) {
  if (role === 'admin' || role === STAFF_ROLES.SYSTEM_DEVELOPER) {
    return STAFF_ROLES.SYSTEM_DEVELOPER
  }
  if (role === STAFF_ROLES.SYSTEM_ADMIN) {
    return STAFF_ROLES.SYSTEM_ADMIN
  }
  if (role === STAFF_ROLES.VALIDATOR) {
    return STAFF_ROLES.VALIDATOR
  }
  return STAFF_ROLES.SYSTEM_DEVELOPER
}

export function authorizeRoles(...allowedRoles) {
  const normalizedAllowed = new Set(allowedRoles.map(normalizeAdminRole))
  return (req, res, next) => {
    const actorRole = req.admin
      ? normalizeAdminRole(req.admin.role)
      : req.validator
        ? STAFF_ROLES.VALIDATOR
        : null

    if (!actorRole || !normalizedAllowed.has(actorRole)) {
      return res.status(403).json({
        message: 'You do not have permission to access this resource.',
      })
    }
    return next()
  }
}

export default authorizeRoles
