import pool from '../config/db.js'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { randomInt } from 'node:crypto'
import {
  RESET_JWT_AUDIENCE,
  USER_JWT_AUDIENCE,
  jwtSignOptions,
  jwtVerifyOptions,
} from '../config/security.js'

const sendResendMail = async ({ to, subject, html }) => {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is missing')
  }

  if (!process.env.RESEND_FROM_EMAIL) {
    throw new Error('RESEND_FROM_EMAIL is missing')
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `LearnMatch <${process.env.RESEND_FROM_EMAIL}>`,
      to: [to],
      subject,
      html,
    }),
  })

  if (!response.ok) {
    await response.text()
    const error = new Error(`Email provider request failed with status ${response.status}`)
    error.code = 'EMAIL_PROVIDER_ERROR'
    error.status = response.status
    throw error
  }

  return response.json()
}

export const MAX_OTP_FAILED_ATTEMPTS = 5

export const generateOtp = () => randomInt(100000, 1000000).toString()

const invalidOtpResponse = (res) => res.status(400).json({
  message: 'Invalid or expired verification code. Please request a new code if needed.',
})

const isValidEmail = (email) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

const isValidPassword = (password) => {
  if (!password || password.length < 8) {
    return 'Password must be at least 8 characters'
  }

  if (!/[A-Z]/.test(password)) {
    return 'Password must include at least one uppercase letter'
  }

  if (!/[0-9]/.test(password)) {
    return 'Password must include at least one number'
  }

  return null
}

export const registerUser = async (req, res) => {
  const { email, username, password } = req.body

  if (!email || !username || !password) {
    return res.status(400).json({
      message: 'Email, username, and password are required',
    })
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({
      message: 'Please enter a valid email address',
    })
  }

  const passwordError = isValidPassword(password)

  if (passwordError) {
    return res.status(400).json({
      message: passwordError,
    })
  }

  let userId = null

  try {
    const [existingEmail] = await pool.query(
      'SELECT user_id FROM USER_ACCOUNT WHERE email = ?',
      [email]
    )

    if (existingEmail.length > 0) {
      return res.status(400).json({
        message: 'Email already in use',
      })
    }

    const [existingUsername] = await pool.query(
      'SELECT user_id FROM USER_ACCOUNT WHERE username = ?',
      [username]
    )

    if (existingUsername.length > 0) {
      return res.status(400).json({
        message: 'Username already taken',
      })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const [result] = await pool.query(
      `
      INSERT INTO USER_ACCOUNT
      (email, username, password, is_active)
      VALUES (?, ?, ?, 0)
      `,
      [email, username, hashedPassword]
    )

    userId = result.insertId

    const otpCode = generateOtp()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000)

    await pool.query(
      `
      INSERT INTO OTP_VERIFICATION
      (user_id, otp_code, failed_attempts, expires_at)
      VALUES (?, ?, 0, ?)
      `,
      [userId, otpCode, expiresAt]
    )

    try {
      await sendResendMail({
        to: email,
        subject: 'Your LearnMatch Verification Code',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 420px; margin: 0 auto; padding: 24px;">
            <h2 style="color: #f97316;">
              Verify your LearnMatch account
            </h2>

            <p>Your verification code is:</p>

            <p style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #1f2937;">
              ${otpCode}
            </p>

            <p style="color: #6b7280; font-size: 14px;">
              This code expires in 10 minutes.
            </p>
          </div>
        `,
      })
    } catch (emailError) {
      console.error('Resend registration email error:', emailError)

      await pool.query(
        'DELETE FROM OTP_VERIFICATION WHERE user_id = ?',
        [userId]
      )

      await pool.query(
        'DELETE FROM USER_ACCOUNT WHERE user_id = ?',
        [userId]
      )

      return res.status(500).json({
        message:
          'Unable to send verification email. Please try registering again.',
      })
    }

    return res.status(201).json({
      message:
        'Account created. Please check your email for a verification code.',
      userId,
      email,
    })
  } catch (error) {
    console.error('Register error:', error)

    return res.status(500).json({
      message: 'Server error during registration',
    })
  }
}

export const verifyOtp = async (req, res) => {
  const { userId, otpCode } = req.body

  if (!userId || !otpCode) {
    return res.status(400).json({
      message: 'User ID and verification code are required',
    })
  }

  const normalizedUserId = Number(userId)
  const normalizedOtpCode = String(otpCode).trim()
  if (!Number.isInteger(normalizedUserId) || normalizedUserId <= 0 || !/^\d{6}$/.test(normalizedOtpCode)) {
    return invalidOtpResponse(res)
  }

  let connection
  try {
    connection = await pool.getConnection()
    await connection.beginTransaction()

    const [users] = await connection.query(
      `
      SELECT user_id, is_active
      FROM USER_ACCOUNT
      WHERE user_id = ?
      FOR UPDATE
      `,
      [normalizedUserId]
    )

    if (users.length === 0 || users[0].is_active) {
      await connection.commit()
      return invalidOtpResponse(res)
    }

    const [rows] = await connection.query(
      `
      SELECT otp_id, otp_code, failed_attempts, expires_at
      FROM OTP_VERIFICATION
      WHERE user_id = ?
      ORDER BY otp_id DESC
      LIMIT 1
      FOR UPDATE
      `,
      [normalizedUserId]
    )

    if (rows.length === 0) {
      await connection.commit()
      return invalidOtpResponse(res)
    }

    const otpRecord = rows[0]

    if (
      new Date() > new Date(otpRecord.expires_at)
      || Number(otpRecord.failed_attempts) >= MAX_OTP_FAILED_ATTEMPTS
    ) {
      await connection.commit()
      return invalidOtpResponse(res)
    }

    if (otpRecord.otp_code !== normalizedOtpCode) {
      await connection.query(
        `UPDATE OTP_VERIFICATION
         SET failed_attempts = LEAST(failed_attempts + 1, ?)
         WHERE otp_id = ? AND user_id = ?`,
        [MAX_OTP_FAILED_ATTEMPTS, otpRecord.otp_id, normalizedUserId]
      )
      await connection.commit()
      return invalidOtpResponse(res)
    }

    await connection.query(
      `
      UPDATE USER_ACCOUNT
      SET is_active = 1
      WHERE user_id = ?
      `,
      [normalizedUserId]
    )

    await connection.query(
      `
      DELETE FROM OTP_VERIFICATION
      WHERE otp_id = ? AND user_id = ?
      `,
      [otpRecord.otp_id, normalizedUserId]
    )
    await connection.commit()

    return res.json({
      message:
        'Account verified successfully! You can now log in.',
    })
  } catch (error) {
    if (connection) await connection.rollback()
    console.error('OTP verify error:', error)

    return res.status(500).json({
      message: 'Server error verifying code',
    })
  } finally {
    if (connection) connection.release()
  }
}

export const resendOtp = async (req, res) => {
  const { userId } = req.body

  if (!userId) {
    return res.status(400).json({
      message: 'User ID is required',
    })
  }

  try {
    const [users] = await pool.query(
      `
      SELECT email, is_active
      FROM USER_ACCOUNT
      WHERE user_id = ?
      `,
      [userId]
    )

    const genericResponse = { message: 'If the account is eligible, a new code has been sent.' }
    if (users.length === 0 || users[0].is_active) return res.json(genericResponse)

    const email = users[0].email

    const otpCode = generateOtp()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000)

    await pool.query(
      `
      DELETE FROM OTP_VERIFICATION
      WHERE user_id = ?
      `,
      [userId]
    )

    await pool.query(
      `
      INSERT INTO OTP_VERIFICATION
      (user_id, otp_code, failed_attempts, expires_at)
      VALUES (?, ?, 0, ?)
      `,
      [userId, otpCode, expiresAt]
    )

    try {
      await sendResendMail({
        to: email,
        subject: 'Your New LearnMatch Verification Code',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 420px; margin: 0 auto; padding: 24px;">
            <h2 style="color: #f97316;">
              Your new verification code
            </h2>

            <p>Your new LearnMatch verification code is:</p>

            <p style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #1f2937;">
              ${otpCode}
            </p>

            <p style="color: #6b7280; font-size: 14px;">
              This code expires in 10 minutes.
            </p>
          </div>
        `,
      })
    } catch (emailError) {
      console.error('Resend OTP email error:', emailError)

      await pool.query(
        `
        DELETE FROM OTP_VERIFICATION
        WHERE user_id = ?
        `,
        [userId]
      )

      return res.status(500).json({
        message:
          'Unable to send a new verification code. Please try again.',
      })
    }

    return res.json(genericResponse)
  } catch (error) {
    console.error('Resend OTP error:', error)

    return res.status(500).json({
      message: 'Server error resending code',
    })
  }
}

export const loginUser = async (req, res) => {
  const { identifier, password } = req.body

  if (!identifier || !password) {
    return res.status(400).json({
      message: 'Email/username and password are required',
    })
  }

  try {
    const [rows] = await pool.query(
      `
      SELECT *
      FROM USER_ACCOUNT
      WHERE email = ?
      OR username = ?
      `,
      [identifier, identifier]
    )

    if (rows.length === 0) {
      return res.status(400).json({
        message: 'Invalid email/username or password',
      })
    }

    const user = rows[0]

    const passwordMatch = await bcrypt.compare(
      password,
      user.password
    )

    if (!passwordMatch) {
      return res.status(400).json({
        message: 'Invalid email/username or password',
      })
    }

    if (!user.is_active) {
      return res.status(403).json({
        message: 'Please verify your email before logging in.',
        userId: user.user_id,
        email: user.email,
      })
    }

    const token = jwt.sign(
      {
        userId: user.user_id,
        username: user.username,
      },
      process.env.JWT_SECRET,
      jwtSignOptions(USER_JWT_AUDIENCE, '7d')
    )

    return res.json({
      message: 'Login successful',
      token,
      userId: user.user_id,
      username: user.username,
    })
  } catch (error) {
    console.error('Login error:', error)

    return res.status(500).json({
      message: 'Server error during login',
    })
  }
}

const normalizeEmail = (email) => String(email || '').trim().toLowerCase()

export const forgotPassword = async (req, res) => {
  const email = normalizeEmail(req.body?.email)

  if (!isValidEmail(email)) {
    return res.status(400).json({ message: 'Please enter a valid email address' })
  }

  const genericResponse = {
    message: 'If an account exists for that email, a verification code has been sent.',
  }

  try {
    const [users] = await pool.query(
      `SELECT user_id, email FROM USER_ACCOUNT WHERE LOWER(email) = ? AND is_active = 1 LIMIT 1`,
      [email]
    )

    if (users.length === 0) {
      return res.json(genericResponse)
    }

    const user = users[0]
    const otpCode = randomInt(100000, 1000000).toString()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000)

    await pool.query('DELETE FROM OTP_VERIFICATION WHERE user_id = ?', [user.user_id])
    const [otpResult] = await pool.query(
      'INSERT INTO OTP_VERIFICATION (user_id, otp_code, failed_attempts, expires_at) VALUES (?, ?, 0, ?)',
      [user.user_id, otpCode, expiresAt]
    )

    try {
      await sendResendMail({
        to: user.email,
        subject: 'Reset your LearnMatch password',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 420px; margin: 0 auto; padding: 24px;">
            <h2 style="color: #f97316;">Reset your LearnMatch password</h2>
            <p>Use this verification code to reset your password:</p>
            <p style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #1f2937;">${otpCode}</p>
            <p style="color: #6b7280; font-size: 14px;">This code expires in 10 minutes. If you did not request this, you can ignore this email.</p>
          </div>
        `,
      })
    } catch (emailError) {
      console.error('Resend password reset email error:', emailError)
      await pool.query(
        'DELETE FROM OTP_VERIFICATION WHERE otp_id = ? AND user_id = ?',
        [otpResult.insertId, user.user_id]
      )
    }

    return res.json(genericResponse)
  } catch (error) {
    console.error('Forgot password error:', error)
    return res.status(500).json({ message: 'Unable to process the request. Please try again.' })
  }
}

export const verifyPasswordResetOtp = async (req, res) => {
  const email = normalizeEmail(req.body?.email)
  const otpCode = String(req.body?.otpCode || '').trim()

  if (!isValidEmail(email) || !/^\d{6}$/.test(otpCode)) {
    return res.status(400).json({ message: 'Invalid or expired verification code.' })
  }

  let connection
  try {
    connection = await pool.getConnection()
    await connection.beginTransaction()

    const [rows] = await connection.query(
      `
      SELECT otp.otp_id, otp.user_id, otp.otp_code, otp.failed_attempts, otp.expires_at
      FROM OTP_VERIFICATION otp
      INNER JOIN USER_ACCOUNT user ON user.user_id = otp.user_id
      WHERE LOWER(user.email) = ? AND user.is_active = 1
      ORDER BY otp.otp_id DESC
      LIMIT 1
      FOR UPDATE
      `,
      [email]
    )

    const otp = rows[0]
    if (
      !otp
      || new Date() > new Date(otp.expires_at)
      || Number(otp.failed_attempts) >= MAX_OTP_FAILED_ATTEMPTS
    ) {
      await connection.commit()
      return invalidOtpResponse(res)
    }

    if (otp.otp_code !== otpCode) {
      await connection.query(
        `UPDATE OTP_VERIFICATION
         SET failed_attempts = LEAST(failed_attempts + 1, ?)
         WHERE otp_id = ? AND user_id = ?`,
        [MAX_OTP_FAILED_ATTEMPTS, otp.otp_id, otp.user_id]
      )
      await connection.commit()
      return invalidOtpResponse(res)
    }

    await connection.commit()

    const resetToken = jwt.sign(
      { userId: otp.user_id, otpId: otp.otp_id, purpose: 'password-reset' },
      process.env.JWT_SECRET,
      jwtSignOptions(RESET_JWT_AUDIENCE, '10m')
    )

    return res.json({ message: 'Code verified.', resetToken })
  } catch (error) {
    if (connection) await connection.rollback()
    console.error('Password reset OTP verification error:', error)
    return res.status(500).json({ message: 'Unable to verify the code. Please try again.' })
  } finally {
    if (connection) connection.release()
  }
}

export const resetPassword = async (req, res) => {
  const { resetToken, password, confirmPassword } = req.body || {}

  if (!resetToken || !password || !confirmPassword) {
    return res.status(400).json({ message: 'Reset token, password, and password confirmation are required.' })
  }

  if (password !== confirmPassword) {
    return res.status(400).json({ message: 'Passwords do not match' })
  }

  const passwordError = isValidPassword(password)
  if (passwordError) {
    return res.status(400).json({ message: passwordError })
  }

  let decoded
  try {
    decoded = jwt.verify(
      resetToken,
      process.env.JWT_SECRET,
      jwtVerifyOptions(RESET_JWT_AUDIENCE)
    )
  } catch {
    return res.status(401).json({ message: 'Invalid or expired password reset authorization.' })
  }

  if (
    decoded.purpose !== 'password-reset'
    || !Number.isInteger(decoded.userId)
    || !Number.isInteger(decoded.otpId)
  ) {
    return res.status(401).json({ message: 'Invalid or expired password reset authorization.' })
  }

  let connection
  try {
    connection = await pool.getConnection()
    await connection.beginTransaction()

    const [rows] = await connection.query(
      `
      SELECT otp.otp_id, otp.expires_at
      FROM OTP_VERIFICATION otp
      INNER JOIN USER_ACCOUNT user ON user.user_id = otp.user_id
      WHERE otp.otp_id = ? AND otp.user_id = ? AND user.is_active = 1
      FOR UPDATE
      `,
      [decoded.otpId, decoded.userId]
    )

    const otp = rows[0]
    if (!otp || new Date() > new Date(otp.expires_at)) {
      await connection.rollback()
      return res.status(401).json({ message: 'Invalid or expired password reset authorization.' })
    }

    const hashedPassword = await bcrypt.hash(password, 10)
    const [updateResult] = await connection.query(
      'UPDATE USER_ACCOUNT SET password = ? WHERE user_id = ? AND is_active = 1',
      [hashedPassword, decoded.userId]
    )

    if (updateResult.affectedRows !== 1) {
      await connection.rollback()
      return res.status(401).json({ message: 'Invalid or expired password reset authorization.' })
    }

    const [deleteResult] = await connection.query(
      'DELETE FROM OTP_VERIFICATION WHERE otp_id = ? AND user_id = ?',
      [decoded.otpId, decoded.userId]
    )

    if (deleteResult.affectedRows !== 1) {
      await connection.rollback()
      return res.status(401).json({ message: 'Invalid or expired password reset authorization.' })
    }

    await connection.commit()

    return res.json({ message: 'Password reset successfully. You can now log in.' })
  } catch (error) {
    if (connection) await connection.rollback()
    console.error('Password reset error:', error)
    return res.status(500).json({ message: 'Unable to reset the password. Please try again.' })
  } finally {
    if (connection) connection.release()
  }
}
