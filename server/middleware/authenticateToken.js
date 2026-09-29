// server/middleware/authenticateToken.js
//
// This middleware checks for a valid JWT in the Authorization header.
// If valid, it attaches the decoded user info to req.user, so route handlers
// can trust req.user.userId instead of whatever userId the frontend sends
// in the request body (which anyone could fake).
//
// Usage in server.js:
//   import authenticateToken from './middleware/authenticateToken.js'
//   app.post('/api/some-protected-route', authenticateToken, async (req, res) => {
//     const userId = req.user.userId
//     ...
//   })

import jwt from 'jsonwebtoken'
import pool from '../config/db.js'
import { USER_JWT_AUDIENCE, jwtVerifyOptions } from '../config/security.js'

async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1] // expects "Bearer <token>"

  if (!token) {
    return res.status(401).json({ message: 'No token provided. Please log in.' })
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET,
      jwtVerifyOptions(USER_JWT_AUDIENCE)
    )
    if (decoded.purpose === 'password-reset') {
      return res.status(403).json({ message: 'Invalid or expired token. Please log in again.' })
    }
    if (!Number.isInteger(decoded.userId)) {
      return res.status(403).json({ message: 'Invalid or expired token. Please log in again.' })
    }
    const [users] = await pool.query(
      'SELECT user_id FROM USER_ACCOUNT WHERE user_id = ? AND is_active = 1 LIMIT 1',
      [decoded.userId]
    )
    if (users.length !== 1) {
      return res.status(403).json({ message: 'Account is inactive or unavailable. Please log in again.' })
    }
    req.user = decoded // { userId: 1, username: '...', iat: ..., exp: ... }
    return next()
  } catch {
    return res.status(403).json({ message: 'Invalid or expired token. Please log in again.' })
  }
}

export default authenticateToken
