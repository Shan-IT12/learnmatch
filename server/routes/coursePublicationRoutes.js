import express from 'express'
import { CoursePublicationError, getPublicationReview, confirmMatchingReview, publishCourse } from '../services/coursePublicationService.js'

export function createCoursePublicationRouter(database, authenticateAdmin) {
  const router = express.Router({ mergeParams: true })
  router.use(authenticateAdmin)
  const run = (action) => async (req, res) => {
    if (req.admin?.role !== 'admin' || !Number.isInteger(req.admin?.adminId)) return res.status(403).json({ message: 'Administrator access required.' })
    const id = Number(req.params.courseId)
    if (!/^\d+$/.test(req.params.courseId) || !Number.isSafeInteger(id) || id < 1) return res.status(400).json({ message: 'Invalid course ID.' })
    try { res.json(await action(req, id)) } catch (error) {
      if (error instanceof CoursePublicationError) return res.status(error.status).json({ message: error.message, fieldErrors: error.fieldErrors })
      console.error('Course publication request failed:', error.code || error.name)
      res.status(500).json({ message: 'Could not complete publication review.' })
    }
  }
  router.get('/', run((req, id) => getPublicationReview(database, id)))
  router.post('/matching-review', run((req, id) => confirmMatchingReview(database, id, req.body, req.admin.adminId)))
  router.post('/publish', run((req, id) => publishCourse(database, id, req.body, req.admin.adminId)))
  return router
}
