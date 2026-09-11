import express from 'express'
import { saveProfile, getProfile } from '../controllers/profileController.js'
import authenticateToken from '../middleware/authenticateToken.js'

const router = express.Router()

router.post('/', authenticateToken, saveProfile)
router.get('/', authenticateToken, getProfile)

export default router
