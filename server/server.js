import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import authRoutes from './routes/authRoutes.js'
import profileRoutes from './routes/profileRoutes.js'
import pool from './config/db.js'
import authenticateToken from './middleware/authenticateToken.js'
import nodemailer from 'nodemailer'

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
  const { courseId, yearLevel, semester, startingPhase } = req.body
  const userId = req.user.userId

  try {
    await pool.query(
      `INSERT INTO SEMESTER_CHECKIN 
        (user_id, course_id, semester, phase, year_level) 
       VALUES (?, ?, ?, ?, ?)`,
      [userId, courseId, semester, startingPhase, yearLevel]
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
  const userId = req.user.userId

  try {
    const [rows] = await pool.query(
      `SELECT sc.year_level, sc.semester, c.course_name
       FROM SEMESTER_CHECKIN sc
       JOIN COURSE c ON sc.course_id = c.course_id
       WHERE sc.user_id = ?
       ORDER BY sc.checkin_id DESC
       LIMIT 1`,
      [userId]
    )

    if (rows.length === 0) {
      return res.status(404).json({ message: 'No college enrollment found' })
    }

    res.json({
      courseName: rows[0].course_name,
      yearLevel: rows[0].year_level,
      semester: rows[0].semester,
    })
  } catch (error) {
    console.error('College status fetch error:', error)
    res.status(500).json({ message: 'Server error fetching college status' })
  }
})

app.get('/api/college/checkin/pending', authenticateToken, async (req, res) => {
  const userId = req.user.userId
 
  try {
    const [rows] = await pool.query(
      `SELECT sc.checkin_id, sc.phase, c.course_name
       FROM SEMESTER_CHECKIN sc
       JOIN COURSE c ON sc.course_id = c.course_id
       LEFT JOIN CHECKIN_ALIGNMENT_RESPONSE car ON car.checkin_id = sc.checkin_id
       WHERE sc.user_id = ? AND car.response_id IS NULL
       ORDER BY sc.checkin_id DESC
       LIMIT 1`,
      [userId]
    )
 
    if (rows.length === 0) {
      return res.json({ checkinId: null })
    }
 
    res.json({
      checkinId: rows[0].checkin_id,
      phase: rows[0].phase,
      courseName: rows[0].course_name,
    })
  } catch (error) {
    console.error('Pending check-in fetch error:', error)
    res.status(500).json({ message: 'Server error fetching pending check-in' })
  }
})

app.post('/api/college/checkin', authenticateToken, async (req, res) => {
  const { checkinId, answers, gwa } = req.body
 
  if (!checkinId || !Array.isArray(answers) || answers.length !== 5) {
    return res.status(400).json({ message: 'Missing checkin ID or incomplete answers' })
  }
 
  try {
    // Save each of the 5 answers
    for (const answer of answers) {
      await pool.query(
        `INSERT INTO CHECKIN_ALIGNMENT_RESPONSE (checkin_id, question_number, answer_score)
         VALUES (?, ?, ?)`,
        [checkinId, answer.question_number, answer.score]
      )
    }
 
    // Deterministic mismatch score: average of the 5 ratings (1-5),
    // converted to a 0-100 alignment percentage.
    const total = answers.reduce((sum, a) => sum + a.score, 0)
    const average = total / answers.length
    const alignmentPercent = Math.round(((average - 1) / 4) * 100)
    const mismatchScore = 100 - alignmentPercent
 
    let status
    let usedGwaLogic = false
 
    if (gwa !== undefined && gwa !== null && gwa !== '') {
      // GWA + survey 4-quadrant logic (End-of-semester only)
      usedGwaLogic = true
      const passing = Number(gwa) >= 75
      const highAlignment = alignmentPercent >= 70
 
      if (passing && highAlignment) status = 'Good Alignment'
      else if (passing && !highAlignment) status = 'Emotional / Interest Mismatch'
      else if (!passing && highAlignment) status = 'Academic Support Needed'
      else status = 'High Mismatch'
 
      // Save GWA to the SEMESTER_CHECKIN row it belongs to
      await pool.query('UPDATE SEMESTER_CHECKIN SET gwa = ? WHERE checkin_id = ?', [gwa, checkinId])
    } else {
      // Survey-only status bucket
      if (mismatchScore < 30) status = 'Good Alignment'
      else if (mismatchScore < 60) status = 'Moderate Mismatch'
      else status = 'High Mismatch'
    }
 
    // Placeholder narrative — swap this for a real OpenAI call later
    const placeholderFeedback = `This is placeholder feedback. Once AI narrative generation is ` +
      `connected, this will explain your "${status}" result (${alignmentPercent}% aligned` +
      `${usedGwaLogic ? `, GWA: ${gwa}` : ''}) in plain language based on your specific answers.`
    const placeholderRecommendation = `This is a placeholder recommendation. Once AI narrative ` +
      `generation is connected, this will suggest a concrete next step based on your lowest-scoring ` +
      `question${usedGwaLogic ? ' and GWA' : ''}.`
 
    await pool.query(
      `INSERT INTO AI_MISMATCH_ANALYSIS (checkin_id, mismatch_score, status, ai_feedback, recommendation)
       VALUES (?, ?, ?, ?, ?)`,
      [checkinId, mismatchScore, status, placeholderFeedback, placeholderRecommendation]
    )
 
    res.json({
      message: 'Check-in submitted successfully',
      alignmentPercent,
      mismatchScore,
      status,
      feedback: placeholderFeedback,
      recommendation: placeholderRecommendation,
    })
  } catch (error) {
    console.error('Check-in submit error:', error)
    res.status(500).json({ message: 'Server error submitting check-in' })
  }
})

app.get('/api/college/checkin/status', authenticateToken, async (req, res) => {
  const userId = req.user.userId
 
  try {
    // Any unanswered check-in?
    const [pendingRows] = await pool.query(
      `SELECT sc.checkin_id, sc.phase, c.course_name
       FROM SEMESTER_CHECKIN sc
       JOIN COURSE c ON sc.course_id = c.course_id
       LEFT JOIN CHECKIN_ALIGNMENT_RESPONSE car ON car.checkin_id = sc.checkin_id
       WHERE sc.user_id = ? AND car.response_id IS NULL
       ORDER BY sc.checkin_id DESC
       LIMIT 1`,
      [userId]
    )
 
    // Most recent AI_MISMATCH_ANALYSIS result, regardless of check-in state
    const [resultRows] = await pool.query(
      `SELECT ama.status, ama.mismatch_score, ama.ai_feedback, ama.recommendation
       FROM AI_MISMATCH_ANALYSIS ama
       JOIN SEMESTER_CHECKIN sc ON ama.checkin_id = sc.checkin_id
       WHERE sc.user_id = ?
       ORDER BY ama.analysis_id DESC
       LIMIT 1`,
      [userId]
    )
    const latestResult = resultRows.length > 0
      ? {
          status: resultRows[0].status,
          mismatchScore: resultRows[0].mismatch_score,
          alignmentPercent: 100 - resultRows[0].mismatch_score,
          feedback: resultRows[0].ai_feedback,
          recommendation: resultRows[0].recommendation,
        }
      : null
 
    if (pendingRows.length > 0) {
      return res.json({
        state: 'pending',
        checkinId: pendingRows[0].checkin_id,
        phase: pendingRows[0].phase,
        currentPhase: pendingRows[0].phase,
        courseName: pendingRows[0].course_name,
        latestResult,
      })
    }
 
    const [completedRows] = await pool.query(
      `SELECT sc.checkin_id, sc.phase, sc.checkin_date, sc.course_id, sc.year_level, sc.semester, c.course_name
       FROM SEMESTER_CHECKIN sc
       JOIN COURSE c ON sc.course_id = c.course_id
       WHERE sc.user_id = ?
       ORDER BY sc.checkin_id DESC
       LIMIT 1`,
      [userId]
    )
 
    if (completedRows.length === 0) {
      return res.json({ state: 'complete', latestResult })
    }
 
    const last = completedRows[0]
    const currentIndex = PHASE_ORDER.indexOf(last.phase)
    const nextPhase = PHASE_ORDER[currentIndex + 1]
 
    if (!nextPhase) {
      return res.json({
        state: 'complete',
        currentPhase: last.phase,
        courseName: last.course_name,
        latestResult,
      })
    }
 
    const weeksNeeded = WEEKS_UNTIL_NEXT_PHASE[last.phase]
    const weeksElapsed = (Date.now() - new Date(last.checkin_date).getTime()) / (1000 * 60 * 60 * 24 * 7)
 
    res.json({
      state: weeksElapsed >= weeksNeeded ? 'due' : 'not_due',
      nextPhase,
      currentPhase: last.phase,
      courseName: last.course_name,
      latestResult,
    })
  } catch (error) {
    console.error('Check-in status error:', error)
    res.status(500).json({ message: 'Server error checking check-in status' })
  }
})

const WEEKS_UNTIL_NEXT_PHASE = { Early: 0.001, Mid: 0.001, End: 0.001 } // Placeholder values for testing; replace with real durations later
const PHASE_ORDER = ['Early', 'Mid', 'End']

app.post('/api/college/checkin/start', authenticateToken, async (req, res) => {
  const userId = req.user.userId
 
  try {
    const [rows] = await pool.query(
      `SELECT course_id, year_level, semester, phase
       FROM SEMESTER_CHECKIN
       WHERE user_id = ?
       ORDER BY checkin_id DESC
       LIMIT 1`,
      [userId]
    )
 
    if (rows.length === 0) {
      return res.status(400).json({ message: 'No prior enrollment found' })
    }
 
    const last = rows[0]
    const currentIndex = PHASE_ORDER.indexOf(last.phase)
    const nextPhase = PHASE_ORDER[currentIndex + 1]
 
    if (!nextPhase) {
      return res.status(400).json({ message: 'All check-ins already completed' })
    }
 
    const [result] = await pool.query(
      `INSERT INTO SEMESTER_CHECKIN (user_id, course_id, semester, phase, year_level)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, last.course_id, last.semester, nextPhase, last.year_level]
    )
 
    res.json({ checkinId: result.insertId, phase: nextPhase })
  } catch (error) {
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
 
  if (!Array.isArray(answers) || answers.length === 0) {
    return res.status(400).json({ message: 'Missing answers' })
  }
 
  try {
    // Sum ratings per dimension per pole, e.g. totals.EI.E, totals.EI.I
    const totals = {
      EI: { E: 0, I: 0 },
      SN: { S: 0, N: 0 },
      TF: { T: 0, F: 0 },
      JP: { J: 0, P: 0 },
    }
 
    for (const a of answers) {
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