import bcrypt from 'bcrypt'
import { randomBytes } from 'node:crypto'
import pool from '../config/db.js'
import { sendResendMail } from '../services/resendEmailService.js'
import { deliverStaffToken, issueStaffToken, staffEmail } from '../services/staffAccountService.js'
import { workflowId, workflowText, workflowTransaction } from '../services/workflowSupport.js'

const [action, identifier, rawEmail, fullName] = process.argv.slice(2)
try {
  const email = staffEmail(rawEmail)
  if (!email || !['link', 'provision'].includes(action)) throw new Error('Use link ADMIN_ID EMAIL or provision USERNAME EMAIL "Full Name".')
  const { id, token } = await workflowTransaction(pool, async (connection) => {
    const [[verified]] = await connection.execute('SELECT admin_id FROM ADMIN WHERE email = ?', [email])
    if (verified) throw new Error('The email is already linked to an Administrator.')
    let id
    if (action === 'link') {
      id = workflowId(identifier)
      const [[admin]] = await connection.execute('SELECT email FROM ADMIN WHERE admin_id = ? FOR UPDATE', [id])
      if (!admin || admin.email) throw new Error('Choose an existing Administrator ID without a linked email.')
    } else {
      const username = workflowText(identifier, 'Internal username', 50)
      const name = workflowText(fullName, 'Full name', 100)
      const hash = await bcrypt.hash(randomBytes(32).toString('base64url'), 10)
      const [record] = await connection.execute('INSERT INTO ADMIN (username, full_name, password_hash) VALUES (?, ?, ?)', [username, name, hash])
      id = record.insertId
    }
    return { id, token: await issueStaffToken(connection, 'admin_setup', id, email) }
  })
  console.log(`Administrator ID ${id}.`)
  if (!await deliverStaffToken(sendResendMail, 'admin_setup', email, token)) throw new Error('Setup email could not be sent. Rerun with link and the Administrator ID above.')
  console.log('Setup email sent. Access changes after the recipient completes setup.')
} catch (error) {
  console.error(error.code ? `Administrator setup failed (${error.code}).` : error.message)
  process.exitCode = 1
} finally { await pool.end() }
