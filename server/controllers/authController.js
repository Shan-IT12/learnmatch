import pool from '../config/db.js'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'

export const registerUser = async (req, res) => {
  const { email, username, password } = req.body

  try {
    const [existingEmail] = await pool.query(
      'SELECT user_id FROM USER_ACCOUNT WHERE email = ?',
      [email]
    )
    if (existingEmail.length > 0) {
      return res.status(400).json({ message: 'Email already in use' })
    }

    const [existingUsername] = await pool.query(
      'SELECT user_id FROM USER_ACCOUNT WHERE username = ?',
      [username]
    )
    if (existingUsername.length > 0) {
      return res.status(400).json({ message: 'Username already taken' })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const [result] = await pool.query(
      'INSERT INTO USER_ACCOUNT (email, username, password) VALUES (?, ?, ?)',
      [email, username, hashedPassword]
    )

    res.status(201).json({
      message: 'User registered successfully',
      userId: result.insertId
    })

  } catch (error) {
    console.error('Register error:', error)
    res.status(500).json({ message: 'Server error during registration' })
  }
}

export const loginUser = async (req, res) => {
  const { identifier, password } = req.body

  try {
    const [rows] = await pool.query(
      'SELECT * FROM USER_ACCOUNT WHERE email = ? OR username = ?',
      [identifier, identifier]
    )

    if (rows.length === 0) {
      return res.status(400).json({ message: 'Invalid email/username or password' })
    }

    const user = rows[0]

    const passwordMatch = await bcrypt.compare(password, user.password)

    if (!passwordMatch) {
      return res.status(400).json({ message: 'Invalid email/username or password' })
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.user_id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    )

    res.json({
      message: 'Login successful',
      token,
      userId: user.user_id,
      username: user.username
    })

  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({ message: 'Server error during login' })
  }
}