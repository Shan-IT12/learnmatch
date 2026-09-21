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

const router = express.Router()

router.post('/register', registerUser)
router.post('/login', loginUser)
router.post('/verify-otp', verifyOtp)
router.post('/resend-otp', resendOtp)
router.post('/forgot-password', forgotPassword)
router.post('/forgot-password/verify', verifyPasswordResetOtp)
router.post('/forgot-password/reset', resetPassword)

export default router
