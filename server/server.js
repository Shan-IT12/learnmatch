import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import authRoutes from './routes/authRoutes.js'
import profileRoutes from './routes/profileRoutes.js'
import pool from './config/db.js'
import authenticateToken from './middleware/authenticateToken.js'

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

app.post('/api/interests', authenticateToken, async (req, res) => {
  const { interests } = req.body
  const userId = req.user.userId

  if (!Array.isArray(interests)) {
    return res.status(400).json({ message: 'interests must be an array' })
  }

  try {
    await pool.query('DELETE FROM INTEREST_RESPONSE WHERE user_id = ?', [userId])

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

app.post('/api/quiz', authenticateToken, async (req, res) => {
  const { answers } = req.body
  const userId = req.user.userId

  if (!Array.isArray(answers) || answers.length === 0) {
    return res.status(400).json({ message: 'Missing answers' })
  }

  try {
    const questionIds = answers.map((a) => a.question_id)
    const placeholders = questionIds.map(() => '?').join(',')

    const [questions] = await pool.query(
      `SELECT question_id, correct_answer, dimension FROM QUESTION WHERE question_id IN (${placeholders})`,
      questionIds
    )

    const questionMap = {}
    questions.forEach((q) => {
      questionMap[q.question_id] = q
    })

    let correctCount = 0
    const domainScores = {}

    for (const answer of answers) {
      const question = questionMap[answer.question_id]
      if (!question) continue

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

// Add this route to server.js, alongside your other routes.
// TEMPORARY / PLACEHOLDER: returns 3 random courses with fake match scores and
// static narrative text. Replace this with real WSM engine output once it's built.

app.get('/api/results', async (req, res) => {
  try {
    const [courses] = await pool.query(
      `SELECT course_id, course_name, cluster_category
       FROM COURSE
       WHERE is_active = 1
       ORDER BY RAND()
       LIMIT 3`
    )

    // Generate descending dummy match scores so it looks like a ranked list,
    // e.g. somewhere in the 70-95% range for the top pick, tapering down.
    const dummyScores = [
      Math.floor(Math.random() * 11) + 85, // 85-95%
      Math.floor(Math.random() * 11) + 74, // 74-84%
      Math.floor(Math.random() * 11) + 63, // 63-73%
    ]

    const recommendations = courses.map((course, index) => ({
      rank_position: index + 1,
      course_id: course.course_id,
      course_name: course.course_name,
      cluster_category: course.cluster_category,
      match_score: dummyScores[index],
      ai_narrative: `This is placeholder narrative text for ${course.course_name}. Once the WSM engine and AI narrative generation are built, this will explain why this course matches your skills, interests, and personality profile.`,
    }))

    res.json({ recommendations })
  } catch (error) {
    console.error('Results fetch error:', error)
    res.status(500).json({ message: 'Server error fetching results' })
  }
})

app.post('/api/college/setup', authenticateToken, async (req, res) => {
  const { courseId, yearLevel, semester } = req.body
  const userId = req.user.userId

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

app.get('/api/dashboard/status', authenticateToken, async (req, res) => {
  const userId = req.user.userId

  try {
    const [[interestCount]] = await pool.query(
      'SELECT COUNT(*) AS count FROM INTEREST_RESPONSE WHERE user_id = ?',
      [userId]
    )
    const [[skillCount]] = await pool.query(
      'SELECT COUNT(*) AS count FROM SKILL_RESPONSE WHERE user_id = ?',
      [userId]
    )
    const [[personalityCount]] = await pool.query(
      'SELECT COUNT(*) AS count FROM PERSONALITY_ASSESSMENT WHERE user_id = ?',
      [userId]
    )
    const [checkins] = await pool.query(
      `SELECT sc.semester, sc.comments, c.course_name
       FROM SEMESTER_CHECKIN sc
       JOIN COURSE c ON sc.course_id = c.course_id
       WHERE sc.user_id = ?
       ORDER BY sc.checkin_id DESC
       LIMIT 1`,
      [userId]
    )

    const isCollegePhase = checkins.length > 0

    res.json({
      hasInterests: interestCount.count > 0,
      hasSkills: skillCount.count > 0,
      hasPersonality: personalityCount.count > 0,
      isCollegePhase,
      collegeInfo: isCollegePhase
        ? {
            courseName: checkins[0].course_name,
            semester: checkins[0].semester,
            comments: checkins[0].comments,
          }
        : null,
    })
  } catch (error) {
    console.error('Dashboard status error:', error)
    res.status(500).json({ message: 'Server error fetching dashboard status' })
  }
})