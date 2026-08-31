import pool from '../config/db.js'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASSWORD,
  },
})

const generateOtp = () => {
  return Math.floor(100000 + Math.random() * 900000).toString()
}
const isValidEmail = (email) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

const isValidPassword = (password) => {
  if (password.length < 8) return 'Password must be at least 8 characters'
  if (!/[A-Z]/.test(password)) return 'Password must include at least one uppercase letter'
  if (!/[0-9]/.test(password)) return 'Password must include at least one number'
  return null
}

export const registerUser = async (req, res) => {
  const { email, username, password } = req.body

  if (!isValidEmail(email)) {
    return res.status(400).json({ message: 'Please enter a valid email address' })
  }

  const passwordError = isValidPassword(password)
  if (passwordError) {
    return res.status(400).json({ message: passwordError })
  }

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
      'INSERT INTO USER_ACCOUNT (email, username, password, is_active) VALUES (?, ?, ?, 0)',
      [email, username, hashedPassword]
    )

    const userId = result.insertId
    const otpCode = generateOtp()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes from now

    await pool.query(
      'INSERT INTO OTP_VERIFICATION (user_id, otp_code, expires_at) VALUES (?, ?, ?)',
      [userId, otpCode, expiresAt]
    )

    await transporter.sendMail({
      from: `"LearnMatch" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Your LearnMatch Verification Code',
      html: `
        <div style="font-family: sans-serif; max-width: 400px; margin: 0 auto;">
          <h2 style="color: #f97316;">Verify your LearnMatch account</h2>
          <p>Your verification code is:</p>
          <p style="font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #1f2937;">${otpCode}</p>
          <p style="color: #6b7280; font-size: 14px;">This code expires in 10 minutes.</p>
        </div>
      `,
    })

    res.status(201).json({
      message: 'Account created. Please check your email for a verification code.',
      userId,
      email,
    })

  } catch (error) {
    console.error('Register error:', error)
    res.status(500).json({ message: 'Server error during registration' })
  }
}

export const verifyOtp = async (req, res) => {
  const { userId, otpCode } = req.body

  try {
    const [rows] = await pool.query(
      'SELECT * FROM OTP_VERIFICATION WHERE user_id = ? ORDER BY otp_id DESC LIMIT 1',
      [userId]
    )

    if (rows.length === 0) {
      return res.status(400).json({ message: 'No verification code found. Please request a new one.' })
    }

    const otpRecord = rows[0]

    if (new Date() > new Date(otpRecord.expires_at)) {
      return res.status(400).json({ message: 'This code has expired. Please request a new one.' })
    }

    if (otpRecord.otp_code !== otpCode) {
      return res.status(400).json({ message: 'Incorrect code. Please try again.' })
    }

    await pool.query('UPDATE USER_ACCOUNT SET is_active = 1 WHERE user_id = ?', [userId])

    res.json({ message: 'Account verified successfully! You can now log in.' })
  } catch (error) {
    console.error('OTP verify error:', error)
    res.status(500).json({ message: 'Server error verifying code' })
  }
}

export const resendOtp = async (req, res) => {
  const { userId, email } = req.body

  try {
    const otpCode = generateOtp()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000)

    await pool.query(
      'INSERT INTO OTP_VERIFICATION (user_id, otp_code, expires_at) VALUES (?, ?, ?)',
      [userId, otpCode, expiresAt]
    )

    await transporter.sendMail({
      from: `"LearnMatch" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Your New LearnMatch Verification Code',
      html: `
        <div style="font-family: sans-serif; max-width: 400px; margin: 0 auto;">
          <h2 style="color: #f97316;">Your new verification code</h2>
          <p style="font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #1f2937;">${otpCode}</p>
          <p style="color: #6b7280; font-size: 14px;">This code expires in 10 minutes.</p>
        </div>
      `,
    })

    res.json({ message: 'A new code has been sent to your email.' })
  } catch (error) {
    console.error('Resend OTP error:', error)
    res.status(500).json({ message: 'Server error resending code' })
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

    if (!user.is_active) {
  return res.status(403).json({
    message: 'Please verify your email before logging in.',
    userId: user.user_id,
    email: user.email,
  })
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
