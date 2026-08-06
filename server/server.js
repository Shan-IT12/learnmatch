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

// Add this route to server.js, alongside your other routes.

app.post('/api/interests', async (req, res) => {
  const { userId, interests } = req.body

  if (!userId) {
    return res.status(400).json({ message: 'Missing userId' })
  }
  if (!Array.isArray(interests)) {
    return res.status(400).json({ message: 'interests must be an array' })
  }

  try {
    // Clear previous selections for this user first (in case they're retaking this step)
    await pool.query('DELETE FROM INTEREST_RESPONSE WHERE user_id = ?', [userId])

    // Insert one row per selected interest. If the user selected nothing, we just skip inserting.
    for (const interestName of interests) {
      await pool.query(
        `INSERT INTO INTEREST_RESPONSE (user_id, interest_name) VALUES (?, ?)`,
        [userId, interestName]
      )
    }

    res.json({ message: 'Interests saved successfully', count: interests.length })
  } catch (error) {
    console.error('Interests save error:', error)
    res.status(500).json({ message: 'Server error saving interests' })
  }
})

app.get('/api/quiz', async (req, res) => {
  const dimensions = [
    'Verbal',
    'Numerical',
    'Abstract/Logical',
    'Spatial',
    'Scientific Reasoning',
    'Practical/Applied',
  ]

  try {
    const questionSets = await Promise.all(
      dimensions.map((dim) =>
        pool.query(
          `SELECT question_id, question_text, image_url, dimension, choice_a, choice_b, choice_c, choice_d
           FROM QUESTION
           WHERE dimension = ? AND is_active = 1
           ORDER BY RAND()
           LIMIT 5`,
          [dim]
        )
      )
    )

 
    const questions = questionSets.flatMap(([rows]) => rows)

    res.json({ questions })
  } catch (error) {
    console.error('Quiz fetch error:', error)
    res.status(500).json({ message: 'Server error fetching quiz questions' })
  }
})

app.post('/api/quiz', async (req, res) => {
  const { userId, answers } = req.body

  if (!userId || !Array.isArray(answers) || answers.length === 0) {
    return res.status(400).json({ message: 'Missing userId or answers' })
  }

  try {
    const questionIds = answers.map((a) => a.question_id)
    const placeholders = questionIds.map(() => '?').join(',')

    const [questions] = await pool.query(
      `SELECT question_id, correct_answer, dimension FROM QUESTION WHERE question_id IN (${placeholders})`,
      questionIds
    )

    // Build a lookup map: question_id -> { correct_answer, dimension }
    const questionMap = {}
    questions.forEach((q) => {
      questionMap[q.question_id] = q
    })

    let correctCount = 0
    const domainScores = {} // e.g. { Verbal: { correct: 4, total: 5 }, ... }

    for (const answer of answers) {
      const question = questionMap[answer.question_id]
      if (!question) continue // skip if question_id somehow doesn't exist

      const isCorrect = question.correct_answer === answer.selected_option ? 1 : 0
      if (isCorrect) correctCount++

      if (!domainScores[question.dimension]) {
        domainScores[question.dimension] = { correct: 0, total: 0 }
      }
      domainScores[question.dimension].total++
      if (isCorrect) domainScores[question.dimension].correct++

      await pool.query(
        `INSERT INTO SKILL_RESPONSE (user_id, question_id, selected_option, is_correct)
         VALUES (?, ?, ?, ?)`,
        [userId, answer.question_id, answer.selected_option, isCorrect]
      )
    }

    res.json({
      message: 'Quiz submitted successfully',
      totalCorrect: correctCount,
      totalQuestions: answers.length,
      domainScores,
    })
  } catch (error) {
    console.error('Quiz submit error:', error)
    res.status(500).json({ message: 'Server error submitting quiz' })
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