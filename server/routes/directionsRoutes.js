import express from 'express'
import { DirectionsError, getDrivingDirections } from '../services/directionsService.js'

const router = express.Router()

router.post('/', async (req, res) => {
  try {
    res.json(await getDrivingDirections(req.body))
  } catch (error) {
    if (error instanceof DirectionsError) {
      return res.status(error.status).json({ message: error.message, code: error.code })
    }
    console.error('Directions request error:', error)
    res.status(503).json({
      message: 'Directions are temporarily unavailable.',
      code: 'DIRECTIONS_UNAVAILABLE',
    })
  }
})

export default router
