import express from 'express'
import {
  getAvailablePublicCourse,
  searchAvailablePublicCourses,
} from '../services/publicCourseService.js'
import { getSchoolsForCourse } from '../services/schoolLocatorService.js'

const router = express.Router()

router.get('/search', async (req, res) => {
  const query = typeof req.query.q === 'string' ? req.query.q.trim() : ''
  if (!query) return res.json({ query: '', courses: [] })

  try {
    const requestedLimit = Number.parseInt(req.query.limit, 10)
    const limit = Number.isFinite(requestedLimit) ? requestedLimit : 342
    const courses = await searchAvailablePublicCourses(query, { limit })
    res.json({ query, courses })
  } catch (error) {
    console.error('Public course search error:', error)
    res.status(500).json({ message: 'Server error searching courses' })
  }
})

router.get('/:courseCode/schools', async (req, res) => {
  try {
    const result = await getSchoolsForCourse(req.params.courseCode)
    if (!result) return res.status(404).json({ message: 'Course not found' })
    res.json(result)
  } catch (error) {
    console.error('School locator fetch error:', error)
    res.status(500).json({ message: 'Server error fetching schools' })
  }
})

router.get('/:courseCode', async (req, res) => {
  try {
    const course = await getAvailablePublicCourse(req.params.courseCode)
    if (!course) return res.status(404).json({ message: 'Course not found' })
    res.json({ course })
  } catch (error) {
    console.error('Public course detail error:', error)
    res.status(500).json({ message: 'Server error fetching course' })
  }
})

export default router
