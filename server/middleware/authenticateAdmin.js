import jwt from 'jsonwebtoken'
import pool from '../config/db.js'
import { matchesPasswordSession } from '../services/sessionVersionService.js'
import { withLocalLegacyCatalog } from '../services/localLegacyCatalog.js'
import { ADMIN_JWT_AUDIENCE, jwtVerifyOptions } from '../config/security.js'

const authenticateAdmin = async (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store')
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]

  if (!token) {
    return res.status(401).json({ message: 'No token provided' })
  }

  let decoded
  try {
    decoded = jwt.verify(
      token,
      process.env.JWT_SECRET,
      jwtVerifyOptions(ADMIN_JWT_AUDIENCE)
    )
    if (decoded.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access only' })
    }
    if (!Number.isInteger(decoded.adminId)) {
      return res.status(403).json({ message: 'Invalid or expired token' })
    }
  } catch {
    return res.status(403).json({ message: 'Invalid or expired token' })
  }

  try {
    const [admins] = await withLocalLegacyCatalog(pool, () => pool.query(
      'SELECT admin_id, email, password_hash FROM ADMIN WHERE admin_id = ? LIMIT 1',
      [decoded.adminId]
    ), () => pool.query(
      'SELECT admin_id, NULL AS email, password_hash FROM ADMIN WHERE admin_id = ? LIMIT 1',
      [decoded.adminId]
    ), 'ER_BAD_FIELD_ERROR')
    const admin = admins[0]
    if (!admin || (decoded.sessionVersion ? !matchesPasswordSession(decoded.sessionVersion, admin.password_hash) : admin.email != null)) {
      return res.status(403).json({ message: 'Invalid or expired token' })
    }
    req.admin = decoded
    return next()
  } catch {
    return res.status(503).json({ message: 'Session verification is temporarily unavailable. Please try again.' })
  }
}

export default authenticateAdmin
