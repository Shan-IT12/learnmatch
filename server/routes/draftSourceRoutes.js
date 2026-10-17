import express from 'express'
import { DraftSourceError, listDraftSources, saveDraftSource, removeDraftSource, reviewDraftSource } from '../services/draftSourceService.js'

export function createDraftSourceRouter(database, authenticateAdmin) {
  const router = express.Router({ mergeParams: true })
  router.use(authenticateAdmin)
  const id = (value) => /^\d+$/.test(String(value)) && Number.isSafeInteger(Number(value)) && Number(value) > 0 ? Number(value) : null
  const run = (action) => async (req, res) => {
    if (req.admin?.role !== 'admin' || !Number.isInteger(req.admin?.adminId)) return res.status(403).json({ message: 'Administrator access required.' })
    const courseId = id(req.params.courseId)
    const sourceId = req.params.sourceId === undefined ? null : id(req.params.sourceId)
    if (!courseId || (req.params.sourceId !== undefined && !sourceId)) return res.status(400).json({ message: 'Invalid course or source ID.' })
    try { await action(req, res, courseId, sourceId) } catch (error) {
      if (error instanceof DraftSourceError) return res.status(error.status).json({ message: error.message, ...error.details })
      // Avoid logging driver objects/queries or private course/reviewer data.
      console.error('Draft source request failed:', error.code || error.name)
      res.status(500).json({ message: 'Could not save or load draft sources.' })
    }
  }
  router.get('/', run(async (req, res, courseId) => res.json({ sources: await listDraftSources(database, courseId) })))
  router.post('/', run(async (req, res, courseId) => res.status(201).json(await saveDraftSource(database, courseId, req.body))))
  router.put('/:sourceId', run(async (req, res, courseId, sourceId) => res.json(await saveDraftSource(database, courseId, req.body, sourceId))))
  router.delete('/:sourceId', run(async (req, res, courseId, sourceId) => { await removeDraftSource(database, courseId, sourceId, req.body?.source_revision); res.json({ message: 'Source removed. Review history retained.' }) }))
  router.post('/:sourceId/reviews', run(async (req, res, courseId, sourceId) => res.status(201).json(await reviewDraftSource(database, courseId, sourceId, req.body, req.admin.adminId))))
  return router
}
