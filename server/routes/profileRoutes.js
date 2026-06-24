import express from 'express'
import { saveProfile, getProfile } from '../controllers/profileController.js'

const router = express.Router()

router.post('/', saveProfile)
router.get('/', getProfile)

export default router