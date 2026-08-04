
import bcrypt from 'bcrypt'
import pool from '../config/db.js'
import questionPool from './questionPool.js'

const PLACEHOLDER_ADMIN = {
  full_name: 'System Admin',
  username: 'admin',
  password: 'learnmatch_admin_2026', //change after admin exists
}

async function getOrCreateAdmin() {
  const [existing] = await pool.query('SELECT admin_id FROM ADMIN LIMIT 1')
  if (existing.length > 0) {
    console.log(`Using existing admin_id: ${existing[0].admin_id}`)
    return existing[0].admin_id
  }

  const passwordHash = await bcrypt.hash(PLACEHOLDER_ADMIN.password, 10)
  const [result] = await pool.query(
    `INSERT INTO ADMIN (full_name, username, password_hash) VALUES (?, ?, ?)`,
    [PLACEHOLDER_ADMIN.full_name, PLACEHOLDER_ADMIN.username, passwordHash]
  )
  console.log(`Created placeholder admin (username: ${PLACEHOLDER_ADMIN.username}, admin_id: ${result.insertId})`)
  return result.insertId
}

async function seedQuestions(adminId) {
  const [existingCount] = await pool.query('SELECT COUNT(*) AS count FROM QUESTION')
  if (existingCount[0].count > 0) {
    console.log(`QUESTION table already has ${existingCount[0].count} rows. Skipping seed.`)
    console.log(`If you want to reseed from scratch, run: TRUNCATE TABLE QUESTION; then re-run this script.`)
    return
  }

  for (const q of questionPool) {
    await pool.query(
      `INSERT INTO QUESTION
        (admin_id, question_text, type, dimension, choice_a, choice_b, choice_c, choice_d, correct_answer, image_url)
       VALUES (?, ?, 'academic', ?, ?, ?, ?, ?, ?, ?)`,
      [
        adminId,
        q.question_text,
        q.dimension,
        q.choice_a,
        q.choice_b,
        q.choice_c,
        q.choice_d,
        q.correct_answer,
        q.image_url,
      ]
    )
  }
  console.log(`Seeded ${questionPool.length} questions into QUESTION.`)
}

async function run() {
  try {
    const adminId = await getOrCreateAdmin()
    await seedQuestions(adminId)
    console.log('Done.')
    process.exit(0)
  } catch (err) {
    console.error('Seed error:', err)
    process.exit(1)
  }
}

run()