import pool from '../config/db.js'
import { validateProfile } from '../services/requestValidationService.js'

export const saveProfileWithDependencies = async (
  req,
  res,
  { database = pool } = {}
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
  try {
    if (typeof database.getConnection === 'function') connection = await database.getConnection()
    if (typeof connection.beginTransaction === 'function') {
      await connection.beginTransaction()
      transactionStarted = true
    }

    const [accounts] = await connection.query(
      'SELECT username FROM USER_ACCOUNT WHERE user_id = ? LIMIT 1',
      [userId]
    )
    if (accounts.length !== 1) {
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
      await connection.query(
        'UPDATE USER_ACCOUNT SET username = ? WHERE user_id = ?',
        [username, userId]
      )
    }

    const [existing] = await connection.query(
      'SELECT profile_id FROM PROFILE WHERE user_id = ?',
      [userId]
    )

    if (existing.length > 0) {
      await connection.query(
        `UPDATE PROFILE SET 
          physical_accessibility_areas = ?, physical_accessibility_difficulties = ?,
          factor_physical_impact = ?, factor_health_impact = ?, factor_financial_impact = ?,
          factor_family_impact = ?, factor_work_impact = ?
        WHERE user_id = ?`,
        [
          JSON.stringify(physical_accessibility_areas),
          JSON.stringify(physical_accessibility_difficulties),
          factor_physical_impact, factor_health_impact, factor_financial_impact,
          factor_family_impact, factor_work_impact, userId,
        ]
      )
      if (transactionStarted) {
        await connection.commit()
        transactionStarted = false
      }
      return res.json({ message: 'Profile updated successfully', username })
    }

    await connection.query(
      `INSERT INTO PROFILE 
        (user_id, full_name, height_cm, weight_kg, factor_physical, factor_health, 
         factor_financial, factor_family, factor_distance, factor_working_student, factor_others,
         factor_others_classification_status, factor_others_classification,
         physical_accessibility_areas, physical_accessibility_difficulties,
         factor_physical_impact, factor_health_impact, factor_financial_impact,
         factor_family_impact, factor_work_impact)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId, null, null, null,
        false, false, false, false, false, false,
        null, null, null,
        JSON.stringify(physical_accessibility_areas),
        JSON.stringify(physical_accessibility_difficulties),
        factor_physical_impact, factor_health_impact, factor_financial_impact,
        factor_family_impact, factor_work_impact,
      ]
    )
    if (transactionStarted) {
      await connection.commit()
      transactionStarted = false
    }

    res.status(201).json({ message: 'Profile saved successfully', username })

  } catch (error) {
    if (transactionStarted) {
      try { await connection.rollback() } catch { /* preserve the original database error */ }
      transactionStarted = false
    }
    if (error?.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        field: 'username',
        message: 'Username is already taken.',
      })
    }
    console.error('Profile save error:', error)
    res.status(500).json({ message: 'Server error saving profile' })
  } finally {
    if (connection !== database && typeof connection.release === 'function') connection.release()
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
      'SELECT * FROM PROFILE WHERE user_id = ?',
      [userId]
    )

    res.json({ username: accounts[0].username, profile: rows[0] || null })

  } catch (error) {
    console.error('Profile fetch error:', error)
    res.status(500).json({ message: 'Server error fetching profile' })
  }
}

export const getProfile = (req, res) => getProfileWithDependencies(req, res)
