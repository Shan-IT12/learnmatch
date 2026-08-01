import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import authRoutes from './routes/authRoutes.js'
import profileRoutes from './routes/profileRoutes.js'
import pool from './config/db.js'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 5000

app.use(cors())
app.use(express.json())

app.use('/api/auth', authRoutes)
app.use('/api/profile', profileRoutes)

app.get('/api/test', (req, res) => {
  res.json({ message: 'Server is working!' })
})

app.get('/api/db-test', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT 1 + 1 AS result')
    res.json({ message: 'Database connected!', result: rows[0].result })
  } catch (error) {
    res.status(500).json({ message: 'Database connection failed', error: error.message })
  }
})

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})

app.get('/api/search', async (req, res) => {
  const { q } = req.query
  if (!q) return res.json({ courses: [], schools: [] })

  try {
    const searchTerm = `%${q}%`

    const [courses] = await pool.query(
      `SELECT course_id, course_name, cluster_category 
       FROM COURSE 
       WHERE course_name LIKE ? AND is_active = 1
       LIMIT 5`,
      [searchTerm]
    )

    const [schools] = await pool.query(
      `SELECT school_name, hei_type, address 
       FROM SCHOOL 
       WHERE school_name LIKE ? AND is_active = 1
       LIMIT 3`,
      [searchTerm]
    )

    res.json({ courses, schools })
  } catch (error) {
    console.error('Search error:', error)
    res.status(500).json({ courses: [], schools: [] })
  }
})

app.post('/api/college/setup', async (req, res) => {
  const { userId, courseId, yearLevel, semester } = req.body

  try {
    await pool.query(
      `INSERT INTO SEMESTER_CHECKIN 
        (user_id, course_id, semester, phase, comments) 
       VALUES (?, ?, ?, 'Early', ?)`,
      [userId, courseId, semester, `Initial setup: ${yearLevel}`]
    )
    res.json({ message: 'College phase setup successful' })
  } catch (error) {
    console.error('College setup error:', error)
    res.status(500).json({ message: 'Server error during college setup' })
  }
})