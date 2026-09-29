import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import dotenv from 'dotenv'
import authRoutes from './routes/authRoutes.js'
import profileRoutes from './routes/profileRoutes.js'
import pool from './config/db.js'
import authenticateToken from './middleware/authenticateToken.js'
import authenticateAdmin from './middleware/authenticateAdmin.js'
import { loginAdmin } from './controllers/adminAuthController.js'
import {
  adminLoginIdentityRateLimiter,
  adminLoginIpRateLimiter,
} from './middleware/loginRateLimiters.js'
import publicCourseRoutes from './routes/publicCourseRoutes.js'
import { validateInterestSubmission } from './services/interestSubmissionService.js'
import { validatePersonalitySubmission } from './services/personalitySubmissionService.js'
import {
  getAdminCourses,
  getCourseRecommendationReadiness,
  setCourseActiveStatus,
} from './services/adminCourseService.js'
import { getAdminDashboard } from './services/adminDashboardService.js'
import { getAdminAnalytics } from './services/adminAnalyticsService.js'
import { getAdminFeedback, getAdminFeedbackDetail } from './services/adminFeedbackService.js'
import { getAdminUserDetail, getAdminUsers } from './services/adminUserMonitoringService.js'
import { normalizeCourseSearchQuery, searchActiveCollegeCourses } from './services/collegeCourseSearchService.js'
import { getPublicCourse } from './services/publicCourseService.js'
import {
  positiveInteger,
  validateCareer,
  validateCourse,
  validateFeedback,
  validateSkillQuiz,
} from './services/requestValidationService.js'
import { corsOptions } from './config/security.js'
import {
  RecommendationDataError,
  RecommendationInputError,
} from './services/recommendationService.js'
import {
  getLatestSavedRecommendations,
  getOrCreateSavedRecommendations,
} from './services/recommendationPersistenceService.js'
import {
  getAssessmentHistory,
  getAssessmentHistoryDetail,
} from './services/assessmentHistoryService.js'
import {
  CollegeTrackingError,
  changeCollegeProgram,
  createCollegeSetup,
  endCollegeTracking,
  getCheckinHistory,
  getCheckinStatus,
  getCollegeStatus,
  getPendingCheckin,
  pauseCollegeTracking,
  resumeCollegeTracking,
  startNextCheckin,
  startNextSemester,
  submitCollegeCheckin,
} from './services/collegeTrackingService.js'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 5000

// Railway terminates public connections at one trusted reverse-proxy hop.
// This lets IP-based security controls use the nearest proxy-provided address
// without trusting an arbitrary client-supplied forwarding chain.
app.set('trust proxy', 1)
app.disable('x-powered-by')
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      connectSrc: ["'self'"],
      frameAncestors: ["'none'"],
      imgSrc: ["'self'", 'data:', 'https://tile.openstreetmap.org'],
      objectSrc: ["'none'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
    },
  },
}))
app.use(cors(corsOptions()))
app.use(express.json({ limit: '100kb' }))

app.use('/api/auth', authRoutes)
app.use('/api/profile', profileRoutes)
app.use('/api/public/courses', publicCourseRoutes)

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
  const validation = validateSkillQuiz(req.body?.answers)
  if (!validation.valid) return res.status(400).json({ message: validation.message })
  const answers = validation.answers
  const userId = req.user.userId

  try {
    const questionIds = answers.map((a) => a.question_id)
    const placeholders = questionIds.map(() => '?').join(',')

    const [questions] = await pool.query(
      `SELECT question_id, correct_answer, dimension FROM QUESTION WHERE question_id IN (${placeholders})`,
      questionIds
    )

    if (questions.length !== answers.length) {
      return res.status(400).json({ message: 'One or more question IDs are invalid.' })
    }

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

app.get('/api/assessment-history', authenticateToken, async (req, res) => {
  try {
    const history = await getAssessmentHistory(pool, req.user.userId)
    res.json({ history })
  } catch (error) {
    console.error('Assessment history fetch error:', error)
    res.status(500).json({ message: 'Server error fetching assessment history' })
  }
})

app.get('/api/assessment-history/:recommendationId', authenticateToken, async (req, res) => {
  try {
    const result = await getAssessmentHistoryDetail(
      pool,
      req.user.userId,
      req.params.recommendationId
    )
    if (!result) return res.status(404).json({ message: 'Assessment result not found' })
    res.json({ result })
  } catch (error) {
    console.error('Assessment history detail fetch error:', error)
    res.status(500).json({ message: 'Server error fetching assessment result' })
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
      calendarType: result.calendarType,
      termCode: result.termCode,
      semester: result.semester,
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
  const validation = validateFeedback(req.body)
  if (!validation.valid) return res.status(400).json({ message: validation.message })
  const { rating, category, comment } = validation.value
  const userId = req.user.userId

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

app.post(
  '/api/admin/login',
  adminLoginIpRateLimiter,
  adminLoginIdentityRateLimiter,
  loginAdmin
)

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
    const readiness = await getCourseRecommendationReadiness(pool, req.params.id)
    const canonicalCourse = courseRows[0].course_code
      ? getPublicCourse(courseRows[0].course_code)
      : null

    res.json({
      course: courseRows[0],
      careers: careerRows,
      canonicalCareers: canonicalCourse?.career_opportunities || [],
      recommendationReadiness: readiness,
    })
  } catch (error) {
    console.error('Admin course detail fetch error:', error)
    res.status(500).json({ message: 'Server error fetching course' })
  }
})

// Create a new course
app.post('/api/admin/courses', authenticateAdmin, async (req, res) => {
  const validation = validateCourse(req.body)
  if (!validation.valid) return res.status(400).json({ message: validation.message })
  const { course_name, program_type, cluster_category, psced_group, description, obtainable_skills } = validation.value

  try {
    const [result] = await pool.query(
      `INSERT INTO COURSE (course_name, program_type, cluster_category, psced_group, description, obtainable_skills, is_active)
       VALUES (?, ?, ?, ?, ?, ?, 0)`,
      [course_name, program_type || null, cluster_category, psced_group || null, description || null, obtainable_skills || null]
    )
    const readiness = await getCourseRecommendationReadiness(pool, result.insertId)
    res.status(201).json({
      message: 'Course created successfully as inactive',
      courseId: result.insertId,
      recommendationReadiness: readiness,
    })
  } catch (error) {
    console.error('Admin course create error:', error)
    res.status(500).json({ message: 'Server error creating course' })
  }
})

// Update an existing course
app.put('/api/admin/courses/:id', authenticateAdmin, async (req, res) => {
  const courseId = positiveInteger(req.params.id)
  const validation = validateCourse(req.body)
  if (!courseId || !validation.valid) return res.status(400).json({ message: validation.message || 'Invalid course ID.' })
  const { course_name, program_type, cluster_category, psced_group, description, obtainable_skills } = validation.value
  const hasProgramType = Object.hasOwn(req.body, 'program_type')
  const hasPscedGroup = Object.hasOwn(req.body, 'psced_group')

  try {
    await pool.query(
      `UPDATE COURSE
       SET course_name = ?,
           program_type = CASE WHEN ? THEN ? ELSE program_type END,
           cluster_category = ?,
           psced_group = CASE WHEN ? THEN ? ELSE psced_group END,
           description = ?, obtainable_skills = ?
       WHERE course_id = ?`,
      [course_name, hasProgramType, program_type || null, cluster_category, hasPscedGroup, psced_group || null,
       description || null, obtainable_skills || null, courseId]
    )
    const readiness = await getCourseRecommendationReadiness(pool, courseId)
    res.json({ message: 'Course updated successfully', recommendationReadiness: readiness })
  } catch (error) {
    console.error('Admin course update error:', error)
    res.status(500).json({ message: 'Server error updating course' })
  }
})

// Activate or deactivate a course without deleting its catalog row
app.patch('/api/admin/courses/:id/status', authenticateAdmin, async (req, res) => {
  const courseId = positiveInteger(req.params.id)
  if (!courseId) return res.status(400).json({ message: 'Invalid course ID.' })
  try {
    if (req.body.is_active === true) {
      const readiness = await getCourseRecommendationReadiness(pool, courseId)
      if (!readiness) return res.status(404).json({ message: 'Course not found' })
      if (!readiness.ready) {
        return res.status(422).json({
          message: 'Course is not recommendation-ready and cannot be activated.',
          reasons: readiness.reasons,
          recommendationReadiness: readiness,
        })
      }
    }
    const updated = await setCourseActiveStatus(pool, courseId, req.body.is_active)
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

const lifecycleRoute = (handler) => async (req, res) => {
  try {
    res.json(await handler(pool, req.user.userId, req.body || {}))
  } catch (error) {
    if (error instanceof CollegeTrackingError) {
      return res.status(error.status).json({ message: error.message, code: error.code })
    }
    console.error('College lifecycle error:', error)
    res.status(500).json({ message: 'Server error updating college tracking' })
  }
}

app.post('/api/college/tracking/pause', authenticateToken, lifecycleRoute(pauseCollegeTracking))
app.post('/api/college/tracking/resume', authenticateToken, lifecycleRoute(resumeCollegeTracking))
app.post('/api/college/tracking/change-program', authenticateToken, lifecycleRoute(changeCollegeProgram))
app.post('/api/college/tracking/end', authenticateToken, lifecycleRoute(
  (database, userId) => endCollegeTracking(database, userId)
))

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
  const courseId = positiveInteger(req.params.id)
  const validation = validateCareer(req.body)
  if (!courseId || !validation.valid) return res.status(400).json({ message: validation.message || 'Invalid course ID.' })
  const { job_title, salary_range, description } = validation.value

  try {
    const [result] = await pool.query(
      `INSERT INTO CAREER_OPPORTUNITY (course_id, job_title, salary_range, description)
       VALUES (?, ?, ?, ?)`,
      [courseId, job_title, salary_range, description]
    )
    res.status(201).json({ message: 'Career opportunity added', opportunityId: result.insertId })
  } catch (error) {
    console.error('Admin career create error:', error)
    res.status(500).json({ message: 'Server error adding career opportunity' })
  }
})

app.put('/api/admin/careers/:careerId', authenticateAdmin, async (req, res) => {
  const careerId = positiveInteger(req.params.careerId)
  const validation = validateCareer(req.body)
  if (!careerId || !validation.valid) return res.status(400).json({ message: validation.message || 'Invalid career ID.' })
  const { job_title, salary_range, description } = validation.value

  try {
    await pool.query(
      `UPDATE CAREER_OPPORTUNITY SET job_title = ?, salary_range = ?, description = ? WHERE opportunity_id = ?`,
      [job_title, salary_range, description, careerId]
    )
    res.json({ message: 'Career opportunity updated' })
  } catch (error) {
    console.error('Admin career update error:', error)
    res.status(500).json({ message: 'Server error updating career opportunity' })
  }
})

app.delete('/api/admin/careers/:careerId', authenticateAdmin, async (req, res) => {
  const careerId = positiveInteger(req.params.careerId)
  if (!careerId) return res.status(400).json({ message: 'Invalid career ID.' })
  try {
    await pool.query('DELETE FROM CAREER_OPPORTUNITY WHERE opportunity_id = ?', [careerId])
    res.json({ message: 'Career opportunity deleted' })
  } catch (error) {
    console.error('Admin career delete error:', error)
    res.status(500).json({ message: 'Server error deleting career opportunity' })
  }
})

