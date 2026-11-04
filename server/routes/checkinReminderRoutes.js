import { Router } from 'express'
import { currentReminder, listReminders } from '../services/checkinReminderService.js'
import { startNextCheckin } from '../services/collegeTrackingService.js'

export function createCheckinReminderRouter(pool, authenticate) {
  const router = Router()
  router.use(authenticate)
  router.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next() })
  const handle = fn => async (req, res) => {
    try { await fn(req, res) } catch { res.status(503).json({ message: 'Reminders are temporarily unavailable. Please try again.' }) }
  }
  router.get('/', handle(async (req, res) => res.json(await listReminders(pool, req.user.userId))))
  router.put('/preferences', handle(async (req, res) => {
    if (typeof req.body.emailEnabled !== 'boolean') return res.status(400).json({ message: 'Choose whether to receive reminder emails.' })
    await pool.query(`INSERT INTO CHECKIN_REMINDER_PREFERENCE (user_id, email_enabled) VALUES (?, ?)
      ON DUPLICATE KEY UPDATE email_enabled = VALUES(email_enabled)`, [req.user.userId, req.body.emailEnabled])
    res.json({ emailEnabled: req.body.emailEnabled })
  }))
  router.param('id', (req, res, next, id) => {
    if (!/^[1-9]\d{0,15}$/.test(id)) return res.status(400).json({ message: 'Invalid reminder.' })
    next()
  })
  router.patch('/:id/read', handle(async (req, res) => {
    const [result] = await pool.query('UPDATE CHECKIN_REMINDER SET read_at = COALESCE(read_at, UTC_TIMESTAMP()) WHERE reminder_id = ? AND user_id = ?', [req.params.id, req.user.userId])
    if (!result.affectedRows) return res.status(404).json({ message: 'Reminder not found.' })
    res.json({ read: true })
  }))
  router.post('/:id/open', handle(async (req, res) => {
    const [[row]] = await pool.query("SELECT term_id, phase, DATE_FORMAT(due_date, '%Y-%m-%d') AS due_date FROM CHECKIN_REMINDER WHERE reminder_id = ? AND user_id = ?", [req.params.id, req.user.userId])
    if (!row) return res.status(404).json({ message: 'Reminder not found.' })
    const target = await currentReminder(pool, req.user.userId)
    if (!target || target.termId !== row.term_id || target.phase !== row.phase || target.dueDate !== row.due_date) return res.status(409).json({ message: 'This reminder is no longer pending. Return to your college dashboard.' })
    const result = await startNextCheckin(pool, req.user.userId, { phase: row.phase, termId: row.term_id })
    await pool.query('UPDATE CHECKIN_REMINDER SET read_at = COALESCE(read_at, UTC_TIMESTAMP()) WHERE reminder_id = ? AND user_id = ?', [req.params.id, req.user.userId])
    res.json(result)
  }))
  return router
}
