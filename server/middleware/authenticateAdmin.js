import jwt from 'jsonwebtoken'
import pool from '../config/db.js'
import { ADMIN_JWT_AUDIENCE, jwtVerifyOptions } from '../config/security.js'

const authenticateAdmin = async (req, res, next) => {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]

  if (!token) {
    return res.status(401).json({ message: 'No token provided' })
  }

  try {
    const decoded = jwt.verify(
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
    const [admins] = await pool.query(
      'SELECT admin_id FROM ADMIN WHERE admin_id = ? LIMIT 1',
      [decoded.adminId]
    )
    if (admins.length !== 1) return res.status(403).json({ message: 'Invalid or expired token' })
    req.admin = decoded
    return next()
  } catch {
    return res.status(403).json({ message: 'Invalid or expired token' })
  }
}

export default authenticateAdmin
