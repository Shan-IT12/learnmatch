import express from 'express'
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
