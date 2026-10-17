import express from 'express'
import rateLimit from 'express-rate-limit'
import { checkUnsavedSource, confirmUnsavedSource } from '../services/sourceCheckService.js'
import { DraftSourceError, draftSourceCheckSnapshot } from '../services/draftSourceService.js'
import { approvedSourceUrlError } from '../services/sourcePublisherPolicy.js'
import { COURSE_SOURCE_FIELDS } from '../shared/courseSourceFields.js'
import { SOURCE_CHECK_DEADLINE_MS } from '../shared/sourceCheckTiming.js'
import { sourceAiRuntimeConfiguration } from '../services/sourceAiAnalysisService.js'

export function createSourceCheckRouter(authenticateAdmin, checker = checkUnsavedSource, database = null) {
  const router = express.Router()
  const activeChecks = new Set()
  router.use(authenticateAdmin)
  router.use((req, res, next) => req.admin?.role === 'admin' && Number.isInteger(req.admin.adminId) ? next() : res.status(403).json({ message: 'Administrator access required.' }))
  router.get('/status', (_req, res) => res.json({ source_ai: sourceAiRuntimeConfiguration() }))
  const limiter = rateLimit({ windowMs: 60000, limit: 10, keyGenerator: (req) => String(req.admin.adminId), standardHeaders: 'draft-8', legacyHeaders: false, message: { message: 'Too many source checks. Try again shortly.' } })
  const run = (handler) => async (req, res) => {
    try { res.json(await handler(req)) } catch (error) {
      if (error instanceof DraftSourceError) return res.status(error.status).json({ message: error.message, ...error.details })
      res.status(400).json({ message: 'Could not process this source request.' })
    }
  }
  router.post('/check', limiter, run(async (req) => {
    const urls = req.body?.urls
    if (!Array.isArray(urls) || !urls.length || urls.length > 3 || urls.some((url) => typeof url !== 'string' || url.length > 2048)) throw new DraftSourceError('Provide one to three source URLs.')
    if (new Set(urls.map(url => url.trim())).size !== urls.length) throw new DraftSourceError('Remove duplicate source URLs.')
    for (const [index, url] of urls.entries()) {
      const error = approvedSourceUrlError(url)
      if (!url.trim() || error) throw new DraftSourceError('Correct the source URL.', 400, { source_index: index, fieldErrors: { url: error || 'Enter a source URL.' } })
    }
    if (activeChecks.has(req.admin.adminId)) throw new DraftSourceError('A source check is already running. Wait or cancel it before trying again.', 409)
    const courseName = req.body.course_name
    if (typeof courseName !== 'string' || !courseName.trim() || courseName.trim().length > 255) throw new DraftSourceError('Enter the course name before checking sources.')
    const sources = req.body.sources
    const course = req.body.course
    if (sources !== undefined || course !== undefined) {
      if (!course || course.course_name?.trim() !== courseName.trim() || !Array.isArray(sources) || sources.length !== urls.length || sources.some((source, i) => !source || source.url !== urls[i].trim() || typeof source.title !== 'string' || source.title.length > 255 || source.notes != null && (typeof source.notes !== 'string' || source.notes.length > 5000) || !Array.isArray(source.supported_fields) || source.supported_fields.length > 5 || new Set(source.supported_fields).size !== source.supported_fields.length || source.supported_fields.some(field => !Object.hasOwn(COURSE_SOURCE_FIELDS, field)))) throw new DraftSourceError('Invalid draft comparison context.')
      if (JSON.stringify(course).length > 100000 || ['skill_profile', 'riasec_profile', 'year_levels'].some(key => course[key] !== undefined && (!Array.isArray(course[key]) || course[key].length > 100))) throw new DraftSourceError('Draft comparison context exceeds supported limits.')
    }
    const courseId = req.body.course_id
    let savedSnapshot
    if (courseId !== undefined) {
      if (!Number.isSafeInteger(courseId) || courseId < 1 || !database || !course || !sources) throw new DraftSourceError('Invalid saved-draft checking context.')
      savedSnapshot = await draftSourceCheckSnapshot(database, courseId)
    }
    if (activeChecks.has(req.admin.adminId)) throw new DraftSourceError('A source check is already running. Wait or cancel it before trying again.', 409)
    const controller = new AbortController()
    const cancel = () => controller.abort()
    req.once('aborted', cancel)
    const close = () => { if (!req.res.writableEnded) cancel() }
    req.res.once('close', close)
    req.res.setTimeout(SOURCE_CHECK_DEADLINE_MS + 5000)
    const deadline = setTimeout(cancel, SOURCE_CHECK_DEADLINE_MS)
    activeChecks.add(req.admin.adminId)
    try {
      const results = []
      for (const [index, url] of urls.entries()) {
        controller.signal.throwIfAborted()
        results.push(await checker(url.trim(), req.admin.adminId, { courseName, source: sources?.[index], course, signal: controller.signal }))
      }
      if (savedSnapshot && savedSnapshot !== await draftSourceCheckSnapshot(database, courseId)) throw new DraftSourceError('The saved draft or its sources changed while checking. Reload and check the current information again.', 409)
      return { results }
    } finally {
      clearTimeout(deadline); req.removeListener('aborted', cancel); req.res.removeListener('close', close)
      activeChecks.delete(req.admin.adminId)
    }
  }))
  router.post('/confirm', run((req) => confirmUnsavedSource(req.body, req.admin.adminId)))
  return router
}
