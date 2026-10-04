import express from 'express'
import {
  getAvailablePublicCourse,
  searchAvailablePublicCourses,
} from '../services/publicCourseService.js'
import { getSchoolsForCourse } from '../services/schoolLocatorService.js'

const router = express.Router()

router.get('/', async (req, res) => {
  try {
    const courses = await searchAvailablePublicCourses('')
    res.json({ query: '', courses })
  } catch (error) {
    console.error('Public course catalog error:', error)
    res.status(500).json({ message: 'Server error loading course catalog' })
  }
})

router.get('/search', async (req, res) => {
  const query = typeof req.query.q === 'string' ? req.query.q.trim() : ''

  try {
    const requestedLimit = Number.parseInt(req.query.limit, 10)
    const options = Number.isFinite(requestedLimit) ? { limit: requestedLimit } : {}
    const courses = await searchAvailablePublicCourses(query, options)
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
