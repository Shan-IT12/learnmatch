import express from 'express'
import authenticateToken from '../middleware/authenticateToken.js'
import {
  forgotPassword,
  loginUser,
  registerUser,
  resendOtp,
  resetPassword,
  verifyOtp,
  verifyPasswordResetOtp,
} from '../controllers/authController.js'
import {
  otpIpRateLimiter,
  passwordResetOtpIdentityRateLimiter,
  registrationOtpIdentityRateLimiter,
} from '../middleware/otpRateLimiters.js'
import {
  userLoginIdentityRateLimiter,
  userLoginIpRateLimiter,
} from '../middleware/loginRateLimiters.js'
import {
  forgotPasswordEmailIdentityRateLimiter,
  forgotPasswordEmailIpRateLimiter,
  registrationEmailIdentityRateLimiter,
  registrationEmailIpRateLimiter,
  resendEmailIdentityRateLimiter,
  resendEmailIpRateLimiter,
} from '../middleware/emailRateLimiters.js'

const router = express.Router()
router.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store')
  next()
})

// Verify the existing student session without issuing or renewing a token.
router.get('/session', authenticateToken, (req, res) => {
  res.json({ userId: req.user.userId, username: req.user.username })
})

router.post(
  '/register',
  registrationEmailIpRateLimiter,
  registrationEmailIdentityRateLimiter,
  registerUser
)
router.post(
  '/login',
  userLoginIpRateLimiter,
  userLoginIdentityRateLimiter,
  loginUser
)
router.post(
  '/verify-otp',
  otpIpRateLimiter,
  registrationOtpIdentityRateLimiter,
  verifyOtp
)
router.post(
  '/resend-otp',
  resendEmailIpRateLimiter,
  resendEmailIdentityRateLimiter,
  resendOtp
)
router.post(
  '/forgot-password',
  forgotPasswordEmailIpRateLimiter,
  forgotPasswordEmailIdentityRateLimiter,
  forgotPassword
)
router.post(
  '/forgot-password/verify',
  otpIpRateLimiter,
  passwordResetOtpIdentityRateLimiter,
  verifyPasswordResetOtp
)
router.post('/forgot-password/reset', resetPassword)

export default router
