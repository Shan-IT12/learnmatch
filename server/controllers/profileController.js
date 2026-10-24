import pool from '../config/db.js'
import { isDeepStrictEqual } from 'node:util'
import { validateProfile } from '../services/requestValidationService.js'
import { refreshSavedRecommendationsForLatestAssessment } from '../services/recommendationPersistenceService.js'
import { buildPersonalFactorsSnapshot, requestedAttemptId, setAttemptPersonalFactors } from '../services/assessmentAttemptService.js'

export const saveProfileWithDependencies = async (
  req,
  res,
  { database = pool, refreshRecommendations = refreshSavedRecommendationsForLatestAssessment } = {}
) => {
  const userId = req.user.userId
  const validation = validateProfile(req.body)
  if (!validation.valid) {
    return res.status(400).json({
      ...(validation.field ? { field: validation.field } : {}),
      message: validation.message,
    })
  }
  req.body = validation.value
  const {
    username,
    personal_factor_answers,
    physical_accessibility_areas,
    physical_accessibility_difficulties,
    factor_physical_impact,
    factor_health_impact,
    factor_financial_impact,
    factor_family_impact,
    factor_work_impact,
  } = req.body

  let connection = database
  let transactionStarted = false
  let committing = false
  let destroyed = false
  const conflict = () => Object.assign(new Error('Profile write conflict'), { code: 'PROFILE_WRITE_CONFLICT' })
  try {
    if (typeof database.getConnection === 'function') connection = await database.getConnection()
    if (typeof connection.beginTransaction !== 'function') throw new Error('Profile saves require a transaction')
    await connection.beginTransaction()
    transactionStarted = true

    const [accounts] = await connection.query(
      'SELECT username, is_active FROM USER_ACCOUNT WHERE user_id = ? LIMIT 1 FOR UPDATE',
      [userId]
    )
    if (accounts.length !== 1 || Number(accounts[0].is_active) !== 1) {
      if (transactionStarted) {
        await connection.rollback()
        transactionStarted = false
      }
      return res.status(404).json({ message: 'Account not found.' })
    }

    if (accounts[0].username !== username) {
      const [duplicates] = await connection.query(
        'SELECT user_id FROM USER_ACCOUNT WHERE username = ? AND user_id <> ? LIMIT 1',
        [username, userId]
      )
      if (duplicates.length > 0) {
        if (transactionStarted) {
          await connection.rollback()
          transactionStarted = false
        }
        return res.status(409).json({
          field: 'username',
          message: 'Username is already taken.',
        })
      }
      const [accountWrite] = await connection.query(
        'UPDATE USER_ACCOUNT SET username = ? WHERE user_id = ?',
        [username, userId]
      )
      if (accountWrite.affectedRows !== 1) throw conflict()
    }

    // Same parent order as deletion: account -> recommendations -> attempts -> profile.
    // Holding the account lock serializes profile saves and deletion throughout.
    await connection.query('SELECT recommendation_id FROM RECOMMENDATION WHERE user_id = ? FOR UPDATE', [userId])
    await connection.query('SELECT attempt_id FROM ASSESSMENT_ATTEMPT WHERE user_id = ? FOR UPDATE', [userId])
    const [existing] = await connection.query(
      `SELECT profile_id, personal_factor_answers, factor_physical_impact, factor_health_impact,
              factor_financial_impact, factor_family_impact, factor_work_impact,
              physical_accessibility_areas, physical_accessibility_difficulties
       FROM PROFILE WHERE user_id = ? FOR UPDATE`,
      [userId]
    )
    if (existing.length > 1) throw conflict()

    if (existing.length > 0) {
      const impactValues = [
        factor_physical_impact, factor_health_impact, factor_financial_impact,
        factor_family_impact, factor_work_impact, JSON.stringify(personal_factor_answers),
      ]
      const impactFields = [
        'factor_physical_impact', 'factor_health_impact', 'factor_financial_impact',
        'factor_family_impact', 'factor_work_impact',
      ]
      const json = value => typeof value === 'string' ? JSON.parse(value) : value
      const personalFactorScoreChanged = !isDeepStrictEqual(json(existing[0].personal_factor_answers), personal_factor_answers) || impactFields.some(
        (field, index) => Number(existing[0][field]) !== Number(impactValues[index])
      )
      const [profileWrite] = await connection.query(
        `UPDATE PROFILE SET 
          physical_accessibility_areas = ?, physical_accessibility_difficulties = ?,
          factor_physical_impact = ?, factor_health_impact = ?, factor_financial_impact = ?,
          factor_family_impact = ?, factor_work_impact = ?, personal_factor_answers = ?
        WHERE user_id = ?`,
        [
          JSON.stringify(physical_accessibility_areas),
          JSON.stringify(physical_accessibility_difficulties),
          factor_physical_impact, factor_health_impact, factor_financial_impact,
          factor_family_impact, factor_work_impact, JSON.stringify(personal_factor_answers), userId,
        ]
      )
      if (profileWrite.affectedRows !== 1) {
        // Some connections report only changed rows. A no-op is successful only
        // when the locked existing record already equals the requested values.
        const same = profileWrite.affectedRows === 0
          && isDeepStrictEqual(json(existing[0].personal_factor_answers), personal_factor_answers)
          && isDeepStrictEqual(json(existing[0].physical_accessibility_areas), physical_accessibility_areas)
          && isDeepStrictEqual(json(existing[0].physical_accessibility_difficulties), physical_accessibility_difficulties)
          && impactFields.every((field, index) => existing[0][field] === impactValues[index])
        if (!same) throw conflict()
      }
      const attemptId = requestedAttemptId(req)
      if (attemptId) await setAttemptPersonalFactors(connection, userId, attemptId, buildPersonalFactorsSnapshot(req.body))
      // Refresh reads our uncommitted Personal Factors on this same connection;
      // a refresh failure rolls back the profile instead of failing after a save.
      const refresh = personalFactorScoreChanged
        ? await refreshRecommendations(database, userId, undefined, { transactionConnection: connection })
        : { refreshed: false }
      committing = true
      await connection.commit()
      transactionStarted = false
      return res.json({ message: 'Profile updated successfully', username, recommendationsRefreshed: refresh.refreshed })
    }

    const [profileInsert] = await connection.query(
      `INSERT INTO PROFILE 
        (user_id, full_name, height_cm, weight_kg, factor_physical, factor_health, 
         factor_financial, factor_family, factor_distance, factor_working_student, factor_others,
         factor_others_classification_status, factor_others_classification,
         physical_accessibility_areas, physical_accessibility_difficulties,
         factor_physical_impact, factor_health_impact, factor_financial_impact,
         factor_family_impact, factor_work_impact, personal_factor_answers)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId, null, null, null,
        false, false, false, false, false, false,
        null, null, null,
        JSON.stringify(physical_accessibility_areas),
        JSON.stringify(physical_accessibility_difficulties),
        factor_physical_impact, factor_health_impact, factor_financial_impact,
        factor_family_impact, factor_work_impact, JSON.stringify(personal_factor_answers),
      ]
    )
    if (profileInsert.affectedRows !== 1 || !Number.isSafeInteger(profileInsert.insertId) || profileInsert.insertId <= 0) throw conflict()
    const attemptId = requestedAttemptId(req)
    if (attemptId) await setAttemptPersonalFactors(connection, userId, attemptId, buildPersonalFactorsSnapshot(req.body))
    committing = true
    await connection.commit()
    transactionStarted = false

    res.status(201).json({ message: 'Profile saved successfully', username })

  } catch (error) {
    if (committing) {
      connection.destroy()
      destroyed = true
      return res.status(503).json({ code: 'PROFILE_SAVE_OUTCOME_UNKNOWN', message: 'We could not confirm whether your profile was saved. Reload your profile to check before submitting again.' })
    }
    if (transactionStarted) {
      try { await connection.rollback() } catch { connection.destroy(); destroyed = true }
      transactionStarted = false
    }
    if (error?.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        field: 'username',
        message: 'Username is already taken.',
      })
    }
    if (['ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT', 'PROFILE_WRITE_CONFLICT'].includes(error?.code)) {
      return res.status(409).json({ code: 'PROFILE_SAVE_CONFLICT', message: 'Your profile was not saved because another update conflicted with it. Please reload and try again.' })
    }
    // Raw driver errors may contain submitted profile data or SQL parameters.
    res.status(500).json({ message: 'Server error saving profile' })
  } finally {
    if (!destroyed && connection !== database && typeof connection.release === 'function') connection.release()
  }
}

export const saveProfile = (req, res) => saveProfileWithDependencies(req, res)

export const getProfileWithDependencies = async (
  req,
  res,
  { database = pool } = {}
) => {
  const userId = req.user.userId

  try {
    const [accounts] = await database.query(
      'SELECT username FROM USER_ACCOUNT WHERE user_id = ? LIMIT 1',
      [userId]
    )
    if (accounts.length !== 1) {
      return res.status(404).json({ message: 'Account not found.' })
    }

    const [rows] = await database.query(
      `SELECT profile_id, user_id, full_name, height_cm, weight_kg,
              factor_physical, factor_health, factor_financial, factor_family,
              factor_distance, factor_working_student,
              physical_accessibility_areas, physical_accessibility_difficulties,
              factor_physical_impact, factor_health_impact, factor_financial_impact,
              factor_family_impact, factor_work_impact, created_at, updated_at,
              personal_factor_answers
       FROM PROFILE WHERE user_id = ?`,
      [userId]
    )

    res.json({ username: accounts[0].username, profile: rows[0] || null })

  } catch (error) {
    console.error('Profile fetch error:', error)
    res.status(500).json({ message: 'Server error fetching profile' })
  }
}

export const getProfile = (req, res) => getProfileWithDependencies(req, res)
