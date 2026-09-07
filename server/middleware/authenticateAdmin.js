import jwt from 'jsonwebtoken'

const authenticateAdmin = (req, res, next) => {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]

  if (!token) {
    return res.status(401).json({ message: 'No token provided' })
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid or expired token' })
    }

    if (decoded.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access only' })
    }

    req.admin = decoded
    next()
  })
}

export default authenticateAdmin