import express from 'express'
import { getPublicCourse, searchPublicCourses } from '../services/publicCourseService.js'

const router = express.Router()

router.get('/search', (req, res) => {
  const query = typeof req.query.q === 'string' ? req.query.q.trim() : ''
  if (!query) return res.json({ query: '', courses: [] })

  const requestedLimit = Number.parseInt(req.query.limit, 10)
  const limit = Number.isFinite(requestedLimit) ? requestedLimit : 342
  res.json({ query, courses: searchPublicCourses(query, { limit }) })
})

router.get('/:courseCode', (req, res) => {
  const course = getPublicCourse(req.params.courseCode)
  if (!course) return res.status(404).json({ message: 'Course not found' })
  res.json({ course })
})

export default router
