import express from 'express'
import { rateLimit } from 'express-rate-limit'
import noStore from '../middleware/noStore.js'
import {
  createEmailIdentityRateLimiter, createEmailIpRateLimiter, emailIdentityKey,
} from '../middleware/emailRateLimiters.js'
import {
  createLoginIdentityRateLimiter, createLoginIpRateLimiter, loginIdentityKey,
} from '../middleware/loginRateLimiters.js'
import { sendResendMail } from '../services/resendEmailService.js'
import { getPublicValidators, updateValidatorPublicProfile } from '../services/publicValidatorService.js'
import { sendPrivateImage } from '../services/privateReviewImage.js'
import {
  correctCredential, createValidatorAuth, decideValidator, finishStaffPassword, invitationEmail, inviteValidator,
  listValidatorAccounts, loginStaff, privateCredential, registerValidator, requestStaffLink, staffApplication, validatorApprovalStatus, verifyValidator,
} from '../services/staffAccountService.js'
import { adminAssignment, adminReviewRecord, privateSignature, reviewQueue, submitAssignment, submitDecisions, validatorAssignments } from '../services/courseValidationService.js'
import { createReplacementDraft } from '../services/courseReplacementService.js'
import { workflowHandler as run, workflowId } from '../services/workflowSupport.js'

const body = express.json({ limit: '48kb' })
const withImage = express.json({ limit: '1600kb' })
const limits = () => [createEmailIpRateLimiter(), createEmailIdentityRateLimiter(req => emailIdentityKey('staff-email', req.body?.email))]
const loginLimits = [
  createLoginIpRateLimiter({ max: 10 }),
  createLoginIdentityRateLimiter(req => loginIdentityKey('validator-login', req.body?.email), { max: 5 }),
]
const signature = (database, validatorId) => run(async (req, res) => {
  const id = workflowId(req.params.id)
  sendPrivateImage(res, await privateSignature(database, id, validatorId(req)), 'validation-signature')
})
const credential = (database, validatorId) => run(async (req, res) => {
  const id = workflowId(req.params.credential)
  sendPrivateImage(res, await privateCredential(database, validatorId(req), id), 'validator-credential')
})
const parserErrors = (error, _req, res, next) => {
  if (error.type === 'entity.too.large') return res.status(413).json({ message: 'The request is too large.' })
  if (error.type === 'entity.parse.failed') return res.status(400).json({ message: 'Invalid request body.' })
  return next(error)
}

export function mountCourseValidationRoutes(app, database, admin, { send = sendResendMail } = {}) {
  // Public read-only endpoint returning approved validator display profiles for the Landing Page marquee.
  app.get('/api/public/validators', async (_req, res) => {
    try {
      const validators = await getPublicValidators(database)
      res.setHeader('Cache-Control', 'public, max-age=120')
      res.json({ validators })
    } catch {
      res.status(500).json({ message: 'Could not load public validators.' })
    }
  })

  const adminAccount = express.Router()
  adminAccount.use(noStore, body)
  adminAccount.post('/forgot', ...limits(), run(req => requestStaffLink(database, send, 'admin', 'reset', req.body?.email)))
  adminAccount.post('/reset', createEmailIpRateLimiter(), run(req => finishStaffPassword(database, 'admin', 'reset', req.body)))
  adminAccount.post('/setup', createEmailIpRateLimiter(), run(req => finishStaffPassword(database, 'admin', 'setup', req.body)))
  adminAccount.use(parserErrors)
  app.use('/api/admin/account', adminAccount)

  const accounts = express.Router()
  accounts.use(admin, body)
  accounts.get('/', run(() => listValidatorAccounts(database)))
  accounts.post('/invite', ...limits(), run(req => inviteValidator(database, send, req.body?.email, req.admin.adminId)))
  accounts.get('/:id', run(req => staffApplication(database, workflowId(req.params.id), { adminView: true })))
  accounts.post('/:id/decision', run(req => decideValidator(database, req.admin.adminId, workflowId(req.params.id), req.body || {})))
  accounts.patch('/:id/public-profile', withImage, run(req => updateValidatorPublicProfile(database, workflowId(req.params.id), req.body || {})))
  accounts.get('/:id/credentials/:credential', credential(database, req => workflowId(req.params.id)))
  accounts.use(parserErrors)
  app.use('/api/admin/validators', accounts)

  const reviews = express.Router()
  reviews.use(admin, body)
  reviews.get('/', run(req => reviewQueue(database, req.query)))
  reviews.post('/assign', run(req => submitAssignment(database, req.admin.adminId, req.body || {})))
  reviews.post('/replacement/:id', run(req => createReplacementDraft(database, workflowId(req.params.id), req.body?.expectedVersion)))
  reviews.get('/records/:id', run(req => adminReviewRecord(database, workflowId(req.params.id))))
  reviews.get('/assignment/:id', run(req => adminAssignment(database, workflowId(req.params.id))))
  reviews.get('/signatures/:id', signature(database, () => null))
  reviews.use(parserErrors)
  app.use('/api/admin/validation', reviews)

  const validator = express.Router()
  validator.use(noStore)
  validator.post('/login', body, ...loginLimits, run(req => loginStaff(database, 'validator', req.body)))
  validator.post('/forgot', body, ...limits(), run(req => requestStaffLink(database, send, 'validator', 'reset', req.body?.email)))
  validator.post('/reset', createEmailIpRateLimiter(), body, run(req => finishStaffPassword(database, 'validator', 'reset', req.body)))
  validator.post('/invite', createEmailIpRateLimiter(), body, run(req => invitationEmail(database, req.body?.token)))
  validator.post('/register', createEmailIpRateLimiter(), withImage, run(req => registerValidator(database, send, req.body)))
  validator.post('/verify', createEmailIpRateLimiter(), body, run(req => verifyValidator(database, req.body?.token)))
  validator.get('/approval-status', rateLimit({ windowMs: 60000, limit: 120, standardHeaders: 'draft-8', legacyHeaders: false }),
    run(req => validatorApprovalStatus(database, req.headers.authorization)))
  validator.post('/resend', body, ...limits(), run(req => requestStaffLink(database, send, 'validator', 'verify', req.body?.email)))
  validator.use(createValidatorAuth(database))
  validator.get('/profile', run(req => staffApplication(database, req.validator.id)))
  validator.patch('/profile/public', withImage, run(req => updateValidatorPublicProfile(database, req.validator.id, req.body || {})))
  validator.post('/profile/credential', withImage, run(req => correctCredential(database, req.validator, req.body)))
  validator.get('/profile/credentials/:credential', credential(database, req => req.validator.id))
  validator.get('/reviews', run(req => validatorAssignments(database, req.validator)))
  validator.get('/reviews/:id', run(req => validatorAssignments(database, req.validator, workflowId(req.params.id))))
  validator.post('/reviews/:id', withImage, run(req => submitDecisions(database, req.validator, workflowId(req.params.id), req.body)))
  validator.get('/signatures/:id', signature(database, req => req.validator.id))
  validator.use(parserErrors)
  app.use('/api/validator', validator)
}
