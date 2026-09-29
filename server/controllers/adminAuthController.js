import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import pool from '../config/db.js'
import { ADMIN_JWT_AUDIENCE, jwtSignOptions } from '../config/security.js'

export const loginAdmin = async (req, res) => {
  const { username, password } = req.body || {}
  const invalidCredentials = () => res.status(400).json({
    message: 'Invalid username or password',
  })

  if (!username || !password) return invalidCredentials()

  try {
    const [rows] = await pool.query(
      'SELECT * FROM ADMIN WHERE username = ?',
      [username]
    )

    if (rows.length === 0) return invalidCredentials()

    const admin = rows[0]
    const passwordMatch = await bcrypt.compare(password, admin.password_hash)

    if (!passwordMatch) return invalidCredentials()

    const token = jwt.sign(
      { adminId: admin.admin_id, username: admin.username, role: 'admin' },
      process.env.JWT_SECRET,
      jwtSignOptions(ADMIN_JWT_AUDIENCE, '2h')
    )

    return res.json({
      message: 'Login successful',
      token,
      username: admin.username,
    })
  } catch (error) {
    console.error('Admin login error:', error)
    return res.status(500).json({ message: 'Server error during admin login' })
  }
}
