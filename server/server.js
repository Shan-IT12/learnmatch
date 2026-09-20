import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import authRoutes from './routes/authRoutes.js'
import profileRoutes from './routes/profileRoutes.js'
import pool from './config/db.js'
import authenticateToken from './middleware/authenticateToken.js'
import nodemailer from 'nodemailer'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import authenticateAdmin from './middleware/authenticateAdmin.js'
import publicCourseRoutes from './routes/publicCourseRoutes.js'
import { validateInterestSubmission } from './services/interestSubmissionService.js'
import { validatePersonalitySubmission } from './services/personalitySubmissionService.js'
import { getAdminCourses, setCourseActiveStatus } from './services/adminCourseService.js'
import { getAdminDashboard } from './services/adminDashboardService.js'
import { getAdminAnalytics } from './services/adminAnalyticsService.js'
import { getAdminFeedback, getAdminFeedbackDetail } from './services/adminFeedbackService.js'
import { getAdminUserDetail, getAdminUsers } from './services/adminUserMonitoringService.js'
import { normalizeCourseSearchQuery, searchActiveCollegeCourses } from './services/collegeCourseSearchService.js'
import {
  RecommendationDataError,
  RecommendationInputError,
} from './services/recommendationService.js'
import {
  getLatestSavedRecommendations,
  getOrCreateSavedRecommendations,
} from './services/recommendationPersistenceService.js'
import {
  CollegeTrackingError,
  createCollegeSetup,
  getCheckinHistory,
  getCheckinStatus,
  getCollegeStatus,
  getPendingCheckin,
  startNextCheckin,
  startNextSemester,
  submitCollegeCheckin,
} from './services/collegeTrackingService.js'

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASSWORD,
  },
})
dotenv.config()

const app = express()
const PORT = process.env.PORT || 5000

app.use(cors())
app.use(express.json())

app.use('/api/auth', authRoutes)
app.use('/api/profile', profileRoutes)
app.use('/api/public/courses', publicCourseRoutes)

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
  const query = normalizeCourseSearchQuery(req.query.q)
  if (!query) return res.json({ courses: [], schools: [] })

  try {
    const searchTerm = `%${query}%`
    const courses = await searchActiveCollegeCourses(pool, query)

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


app.post('/api/interests', authenticateToken, async (req, res) => {
  const { interests } = req.body
  const userId = req.user.userId

  const validationError = validateInterestSubmission(interests)
  if (validationError) {
    return res.status(400).json({ message: validationError })
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

app.get('/api/results', authenticateToken, async (req, res) => {
  const userId = req.user.userId

  try {
    const recommendations = await getOrCreateSavedRecommendations(pool, userId)
    res.json({ recommendations })
  } catch (error) {
    console.error('Results fetch error:', error)

    if (error instanceof RecommendationInputError) {
      return res.status(400).json({ message: error.message })
    }
    if (error instanceof RecommendationDataError) {
      return res.status(500).json({ message: error.message })
    }

    res.status(500).json({ message: 'Server error fetching results' })
  }
})

app.get('/api/recommendations/latest', authenticateToken, async (req, res) => {
  try {
    const result = await getLatestSavedRecommendations(pool, req.user.userId)
    res.json(result)
  } catch (error) {
    console.error('Latest recommendation fetch error:', error)
    res.status(500).json({ message: 'Server error fetching saved recommendations' })
  }
})

app.post('/api/college/setup', authenticateToken, async (req, res) => {
  try {
    const result = await createCollegeSetup(pool, req.user.userId, req.body)
    res.status(result.created ? 201 : 200).json({
      message: result.created
        ? 'College phase setup successful'
        : result.timingUpdated
          ? 'Semester schedule updated'
          : 'College phase already set up',
      termId: result.termId,
      course: result.course,
    })
  } catch (error) {
    if (error instanceof CollegeTrackingError) {
      return res.status(error.status).json({ message: error.message })
    }
    console.error('College setup error:', error)
    res.status(500).json({ message: 'Server error during college setup' })
  }
})

app.get('/api/dashboard/status', authenticateToken, async (req, res) => {
  const userId = req.user.userId

  try {
    const [[profileCount]] = await pool.query(
      'SELECT COUNT(*) AS count FROM PROFILE WHERE user_id = ?',
      [userId]
    )
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
      hasProfile: profileCount.count > 0,
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

app.get('/api/college/status', authenticateToken, async (req, res) => {
  try {
    const status = await getCollegeStatus(pool, req.user.userId)
    if (!status) {
      return res.status(404).json({ message: 'No college enrollment found' })
    }
    res.json(status)
  } catch (error) {
    console.error('College status fetch error:', error)
    res.status(500).json({ message: 'Server error fetching college status' })
  }
})

app.get('/api/college/checkin/pending', authenticateToken, async (req, res) => {
  try {
    const pending = await getPendingCheckin(pool, req.user.userId)
    if (!pending) return res.json({ checkinId: null })
    res.json({
      checkinId: pending.checkin_id,
      phase: pending.phase,
      courseCode: pending.course_code,
      courseName: pending.course_name,
    })
  } catch (error) {
    console.error('Pending check-in fetch error:', error)
    res.status(500).json({ message: 'Server error fetching pending check-in' })
  }
})

app.post('/api/college/checkin', authenticateToken, async (req, res) => {
  try {
    const result = await submitCollegeCheckin(pool, req.user.userId, req.body)
    res.json({ message: 'Check-in submitted successfully', ...result })
  } catch (error) {
    if (error instanceof CollegeTrackingError) {
      return res.status(error.status).json({ message: error.message })
    }
    console.error('Check-in submit error:', error)
    res.status(500).json({ message: 'Server error submitting check-in' })
  }
})

app.get('/api/college/checkin/status', authenticateToken, async (req, res) => {
  try {
    res.json(await getCheckinStatus(pool, req.user.userId))
  } catch (error) {
    console.error('Check-in status error:', error)
    res.status(500).json({ message: 'Server error checking check-in status' })
  }
})

app.post('/api/college/checkin/start', authenticateToken, async (req, res) => {
  try {
    res.json(await startNextCheckin(pool, req.user.userId, { phase: req.body?.phase }))
  } catch (error) {
    if (error instanceof CollegeTrackingError) {
      return res.status(error.status).json({ message: error.message })
    }
    console.error('Check-in start error:', error)
    res.status(500).json({ message: 'Server error starting next check-in' })
  }
})
 
 

app.get('/api/interests', authenticateToken, async (req, res) => {
  const userId = req.user.userId

  try {
    const [rows] = await pool.query(
      'SELECT interest_name FROM INTEREST_RESPONSE WHERE user_id = ?',
      [userId]
    )
    res.json({ interests: rows.map((r) => r.interest_name) })
  } catch (error) {
    console.error('Interests fetch error:', error)
    res.status(500).json({ message: 'Server error fetching interests' })
  }
})

app.get('/api/quiz/results', authenticateToken, async (req, res) => {
  const userId = req.user.userId

  try {
    const [rows] = await pool.query(
      `SELECT sr.is_correct, q.dimension
       FROM SKILL_RESPONSE sr
       JOIN QUESTION q ON sr.question_id = q.question_id
       WHERE sr.user_id = ?
       ORDER BY sr.skill_response_id DESC
       LIMIT 30`,
      [userId]
    )

    const domainScores = {}
    rows.forEach((row) => {
      if (!domainScores[row.dimension]) {
        domainScores[row.dimension] = { correct: 0, total: 0 }
      }
      domainScores[row.dimension].total++
      if (row.is_correct) domainScores[row.dimension].correct++
    })

    res.json({ domainScores })
  } catch (error) {
    console.error('Quiz results fetch error:', error)
    res.status(500).json({ message: 'Server error fetching quiz results' })
  }
})

app.get('/api/courses/:id', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT course_id, course_name, description, cluster_category FROM COURSE WHERE course_id = ?',
      [req.params.id]
    )
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Course not found' })
    }
    res.json({ course: rows[0] })
  } catch (error) {
    console.error('Course fetch error:', error)
    res.status(500).json({ message: 'Server error fetching course' })
  }
})

app.post('/api/mbti', authenticateToken, async (req, res) => {
  const { answers } = req.body
  const userId = req.user.userId

  const validation = validatePersonalitySubmission(answers)
  if (!validation.valid) {
    return res.status(400).json({ message: validation.message })
  }
 
  try {
    // Sum ratings per dimension per pole, e.g. totals.EI.E, totals.EI.I
    const totals = {
      EI: { E: 0, I: 0 },
      SN: { S: 0, N: 0 },
      TF: { T: 0, F: 0 },
      JP: { J: 0, P: 0 },
    }
 
    for (const a of validation.answers) {
      if (totals[a.dimension] && totals[a.dimension][a.pole] !== undefined) {
        totals[a.dimension][a.pole] += Number(a.rating)
      }
    }
 
    // % leaning toward the first-listed letter of each dichotomy (E, N, T, J)
    const scoreEI = (totals.EI.E / (totals.EI.E + totals.EI.I)) * 100
    const scoreNS = (totals.SN.N / (totals.SN.N + totals.SN.S)) * 100
    const scoreTF = (totals.TF.T / (totals.TF.T + totals.TF.F)) * 100
    const scoreJP = (totals.JP.J / (totals.JP.J + totals.JP.P)) * 100
 
    const mbtiType =
      (scoreEI >= 50 ? 'E' : 'I') +
      (scoreNS >= 50 ? 'N' : 'S') +
      (scoreTF >= 50 ? 'T' : 'F') +
      (scoreJP >= 50 ? 'J' : 'P')
 
    await pool.query(
      `INSERT INTO PERSONALITY_ASSESSMENT (user_id, mbti_type, score_ei, score_ns, score_tf, score_jp)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, mbtiType, scoreEI, scoreNS, scoreTF, scoreJP]
    )
 
    res.json({
      message: 'Personality assessment saved successfully',
      mbtiType,
      scores: { EI: scoreEI, NS: scoreNS, TF: scoreTF, JP: scoreJP },
    })
  } catch (error) {
    console.error('MBTI submit error:', error)
    res.status(500).json({ message: 'Server error saving personality assessment' })
  }
})
 
// Returns the user's saved MBTI result, if any (used by SummaryDashboard).
app.get('/api/mbti', authenticateToken, async (req, res) => {
  const userId = req.user.userId
 
  try {
    const [rows] = await pool.query(
      `SELECT mbti_type, score_ei, score_ns, score_tf, score_jp
       FROM PERSONALITY_ASSESSMENT
       WHERE user_id = ?
       ORDER BY assessment_id DESC
       LIMIT 1`,
      [userId]
    )
 
    if (rows.length === 0) {
      return res.json({ mbtiType: null })
    }
 
    res.json({
      mbtiType: rows[0].mbti_type,
      scores: {
        EI: rows[0].score_ei,
        NS: rows[0].score_ns,
        TF: rows[0].score_tf,
        JP: rows[0].score_jp,
      },
    })
  } catch (error) {
    console.error('MBTI fetch error:', error)
    res.status(500).json({ message: 'Server error fetching personality assessment' })
  }
})

app.post('/api/feedback', authenticateToken, async (req, res) => {
  const { rating, category, comment } = req.body
  const userId = req.user.userId

  if (!rating || !category) {
    return res.status(400).json({ message: 'Rating and category are required' })
  }

  try {
    await pool.query(
      `INSERT INTO FEEDBACK (user_id, rating, comment, category) VALUES (?, ?, ?, ?)`,
      [userId, rating, comment || null, category]
    )
    res.json({ message: 'Thanks for your feedback!' })
  } catch (error) {
    console.error('Feedback submit error:', error)
    res.status(500).json({ message: 'Server error submitting feedback' })
  }
})

app.post('/api/admin/login', async (req, res) => {
  const { username, password } = req.body

  try {
    const [rows] = await pool.query(
      'SELECT * FROM ADMIN WHERE username = ?',
      [username]
    )

    if (rows.length === 0) {
      return res.status(400).json({ message: 'Invalid username or password' })
    }

    const admin = rows[0]
    const passwordMatch = await bcrypt.compare(password, admin.password_hash)

    if (!passwordMatch) {
      return res.status(400).json({ message: 'Invalid username or password' })
    }

    const token = jwt.sign(
      { adminId: admin.admin_id, username: admin.username, role: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    )

    res.json({
      message: 'Login successful',
      token,
      username: admin.username,
    })
  } catch (error) {
    console.error('Admin login error:', error)
    res.status(500).json({ message: 'Server error during admin login' })
  }
})

// ============ ADMIN: COURSE MANAGEMENT ============

app.get('/api/admin/dashboard', authenticateAdmin, async (req, res) => {
  try {
    const dashboard = await getAdminDashboard(pool)
    res.json(dashboard)
  } catch (error) {
    console.error('Admin dashboard fetch error:', error)
    res.status(500).json({ message: 'Server error fetching dashboard analytics' })
  }
})

app.get('/api/admin/analytics', authenticateAdmin, async (req, res) => {
  try {
    const analytics = await getAdminAnalytics(pool)
    res.json(analytics)
  } catch (error) {
    console.error('Admin analytics fetch error:', error)
    res.status(500).json({ message: 'Server error fetching analytics' })
  }
})

app.get('/api/admin/feedback', authenticateAdmin, async (req, res) => {
  try {
    const result = await getAdminFeedback(pool, req.query)
    res.json(result)
  } catch (error) {
    console.error('Admin feedback fetch error:', error)
    res.status(500).json({ message: 'Server error fetching feedback' })
  }
})

app.get('/api/admin/feedback/:feedbackId', authenticateAdmin, async (req, res) => {
  try {
    const feedback = await getAdminFeedbackDetail(pool, req.params.feedbackId)
    if (!feedback) return res.status(404).json({ message: 'Feedback not found' })
    res.json({ feedback })
  } catch (error) {
    console.error('Admin feedback detail fetch error:', error)
    res.status(500).json({ message: 'Server error fetching feedback details' })
  }
})

app.get('/api/admin/users', authenticateAdmin, async (req, res) => {
  try {
    const result = await getAdminUsers(pool, req.query)
    res.json(result)
  } catch (error) {
    console.error('Admin users fetch error:', error)
    res.status(500).json({ message: 'Server error fetching users' })
  }
})

app.get('/api/admin/users/:userId', authenticateAdmin, async (req, res) => {
  try {
    const user = await getAdminUserDetail(pool, req.params.userId)
    if (!user) return res.status(404).json({ message: 'User not found' })
    res.json({ user })
  } catch (error) {
    console.error('Admin user detail fetch error:', error)
    res.status(500).json({ message: 'Server error fetching user details' })
  }
})

// Get all courses (for the admin course list table)
app.get('/api/admin/courses', authenticateAdmin, async (req, res) => {
  try {
    const courses = await getAdminCourses(pool)
    res.json({ courses })
  } catch (error) {
    console.error('Admin courses fetch error:', error)
    res.status(500).json({ message: 'Server error fetching courses' })
  }
})

// Get one course's full details, including its career opportunities
app.get('/api/admin/courses/:id', authenticateAdmin, async (req, res) => {
  try {
    const [courseRows] = await pool.query(
      'SELECT * FROM COURSE WHERE course_id = ?',
      [req.params.id]
    )

    if (courseRows.length === 0) {
      return res.status(404).json({ message: 'Course not found' })
    }

    const [careerRows] = await pool.query(
      'SELECT * FROM CAREER_OPPORTUNITY WHERE course_id = ? ORDER BY opportunity_id ASC',
      [req.params.id]
    )

    res.json({ course: courseRows[0], careers: careerRows })
  } catch (error) {
    console.error('Admin course detail fetch error:', error)
    res.status(500).json({ message: 'Server error fetching course' })
  }
})

// Create a new course
app.post('/api/admin/courses', authenticateAdmin, async (req, res) => {
  const { course_name, program_type, cluster_category, psced_group, description, obtainable_skills } = req.body

  if (!course_name || !cluster_category) {
    return res.status(400).json({ message: 'Course name and cluster category are required' })
  }

  try {
    const [result] = await pool.query(
      `INSERT INTO COURSE (course_name, program_type, cluster_category, psced_group, description, obtainable_skills, is_active)
       VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [course_name, program_type || null, cluster_category, psced_group || null, description || null, obtainable_skills || null]
    )
    res.status(201).json({ message: 'Course created successfully', courseId: result.insertId })
  } catch (error) {
    console.error('Admin course create error:', error)
    res.status(500).json({ message: 'Server error creating course' })
  }
})

// Update an existing course
app.put('/api/admin/courses/:id', authenticateAdmin, async (req, res) => {
  const { course_name, program_type, cluster_category, psced_group, description, obtainable_skills } = req.body

  try {
    await pool.query(
      `UPDATE COURSE
       SET course_name = ?, program_type = ?, cluster_category = ?, psced_group = ?,
           description = ?, obtainable_skills = ?
       WHERE course_id = ?`,
      [course_name, program_type || null, cluster_category, psced_group || null,
       description || null, obtainable_skills || null, req.params.id]
    )
    res.json({ message: 'Course updated successfully' })
  } catch (error) {
    console.error('Admin course update error:', error)
    res.status(500).json({ message: 'Server error updating course' })
  }
})

// Activate or deactivate a course without deleting its catalog row
app.patch('/api/admin/courses/:id/status', authenticateAdmin, async (req, res) => {
  try {
    const updated = await setCourseActiveStatus(pool, req.params.id, req.body.is_active)
    if (!updated) return res.status(404).json({ message: 'Course not found' })

    res.json({
      message: req.body.is_active ? 'Course reactivated successfully' : 'Course deactivated successfully',
      is_active: req.body.is_active,
    })
  } catch (error) {
    if (error.code === 'INVALID_COURSE_STATUS') {
      return res.status(400).json({ message: error.message })
    }
    console.error('Admin course status update error:', error)
    res.status(500).json({ message: 'Server error updating course status' })
  }
})

app.post('/api/college/semester/advance', authenticateToken, async (req, res) => {
  try {
    res.json(await startNextSemester(pool, req.user.userId, req.body))
  } catch (error) {
    if (error instanceof CollegeTrackingError) {
      return res.status(error.status).json({ message: error.message })
    }
    console.error('Semester progression error:', error)
    res.status(500).json({ message: 'Server error starting the next semester' })
  }
})

app.get('/api/college/checkin/history', authenticateToken, async (req, res) => {
  try {
    const history = await getCheckinHistory(pool, req.user.userId, req.query.limit)
    res.json({ history })
  } catch (error) {
    console.error('Check-in history error:', error)
    res.status(500).json({ message: 'Server error fetching check-in history' })
  }
})

// Permanent course deletion is intentionally unavailable through the application.
app.delete('/api/admin/courses/:id', authenticateAdmin, (req, res) => {
  res.status(405).json({ message: 'Course deletion is disabled. Deactivate the course instead.' })
})

// ============ ADMIN: CAREER OPPORTUNITIES (per course) ============

app.post('/api/admin/courses/:id/careers', authenticateAdmin, async (req, res) => {
  const { job_title, salary_range, description } = req.body

  if (!job_title) {
    return res.status(400).json({ message: 'Job title is required' })
  }

  try {
    const [result] = await pool.query(
      `INSERT INTO CAREER_OPPORTUNITY (course_id, job_title, salary_range, description)
       VALUES (?, ?, ?, ?)`,
      [req.params.id, job_title, salary_range || null, description || null]
    )
    res.status(201).json({ message: 'Career opportunity added', opportunityId: result.insertId })
  } catch (error) {
    console.error('Admin career create error:', error)
    res.status(500).json({ message: 'Server error adding career opportunity' })
  }
})

app.put('/api/admin/careers/:careerId', authenticateAdmin, async (req, res) => {
  const { job_title, salary_range, description } = req.body

  try {
    await pool.query(
      `UPDATE CAREER_OPPORTUNITY SET job_title = ?, salary_range = ?, description = ? WHERE opportunity_id = ?`,
      [job_title, salary_range || null, description || null, req.params.careerId]
    )
    res.json({ message: 'Career opportunity updated' })
  } catch (error) {
    console.error('Admin career update error:', error)
    res.status(500).json({ message: 'Server error updating career opportunity' })
  }
})

app.delete('/api/admin/careers/:careerId', authenticateAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM CAREER_OPPORTUNITY WHERE opportunity_id = ?', [req.params.careerId])
    res.json({ message: 'Career opportunity deleted' })
  } catch (error) {
    console.error('Admin career delete error:', error)
    res.status(500).json({ message: 'Server error deleting career opportunity' })
  }
})

