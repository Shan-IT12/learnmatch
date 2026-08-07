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

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1] // expects "Bearer <token>"

  if (!token) {
    return res.status(401).json({ message: 'No token provided. Please log in.' })
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid or expired token. Please log in again.' })
    }
    req.user = decoded // { userId: 1, username: '...', iat: ..., exp: ... }
    next()
  })
}

export default authenticateToken