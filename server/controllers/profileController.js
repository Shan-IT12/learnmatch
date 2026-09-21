import pool from '../config/db.js'
import {
  classifyPersonalFactorText,
  isReusablePersonalFactorClassification,
  logPersonalFactorClassification,
  normalizePersonalFactorText,
  parseStoredPersonalFactorCategories,
} from '../services/personalFactorClassificationService.js'

export const saveProfileWithDependencies = async (
  req,
  res,
  {
    database = pool,
    classify = classifyPersonalFactorText,
    logClassification = logPersonalFactorClassification,
  } = {}
) => {
  const userId = req.user.userId
  const {
    full_name,
    height_cm,
    weight_kg,
    factor_physical,
    factor_health,
    factor_financial,
    factor_family,
    factor_distance,
    factor_working_student,
    factor_others
  } = req.body

  const normalizedHeight =
    height_cm === '' || height_cm === undefined || height_cm === null
      ? null
      : Number(height_cm)
  const normalizedWeight =
    weight_kg === '' || weight_kg === undefined || weight_kg === null
      ? null
      : Number(weight_kg)

  if (normalizedHeight !== null && !Number.isFinite(normalizedHeight)) {
    return res.status(400).json({ message: 'Height must be a valid number.' })
  }

  if (normalizedWeight !== null && !Number.isFinite(normalizedWeight)) {
    return res.status(400).json({ message: 'Weight must be a valid number.' })
  }

  let normalizedOther
  try {
    normalizedOther = normalizePersonalFactorText(factor_others)
  } catch (error) {
    return res.status(400).json({ message: error.message })
  }

  try {
    // Check if profile already exists
    const [existing] = await database.query(
      `SELECT profile_id, factor_others,
              factor_others_classification_status,
              factor_others_classification
       FROM PROFILE WHERE user_id = ?`,
      [userId]
    )

    let classificationStatus = null
    let classification = null
    if (normalizedOther) {
      const existingProfile = existing[0]
      const existingText = existingProfile?.factor_others == null
        ? null
        : String(existingProfile.factor_others).trim()
      const canReuse = existingText === normalizedOther
        && isReusablePersonalFactorClassification(
          existingProfile?.factor_others_classification_status,
          existingProfile?.factor_others_classification
        )
      const result = canReuse
        ? {
            status: existingProfile.factor_others_classification_status,
            categories: parseStoredPersonalFactorCategories(
              existingProfile.factor_others_classification
            ),
          }
        : await classify(normalizedOther)
      if (canReuse) logClassification(result, { reused: true })
      classificationStatus = result.status
      classification = JSON.stringify(result.categories)
    }

    if (existing.length > 0) {
      // Update existing profile
      await database.query(
        `UPDATE PROFILE SET 
          full_name = ?, height_cm = ?, weight_kg = ?,
          factor_physical = ?, factor_health = ?, factor_financial = ?,
          factor_family = ?, factor_distance = ?, factor_working_student = ?,
          factor_others = ?, factor_others_classification_status = ?,
          factor_others_classification = ?
        WHERE user_id = ?`,
        [
          full_name, normalizedHeight, normalizedWeight,
          factor_physical, factor_health, factor_financial,
          factor_family, factor_distance, factor_working_student,
          normalizedOther, classificationStatus, classification, userId
        ]
      )
      return res.json({ message: 'Profile updated successfully' })
    }

    // Insert new profile
    await database.query(
      `INSERT INTO PROFILE 
        (user_id, full_name, height_cm, weight_kg, factor_physical, factor_health, 
         factor_financial, factor_family, factor_distance, factor_working_student, factor_others,
         factor_others_classification_status, factor_others_classification)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId, full_name, normalizedHeight, normalizedWeight,
        factor_physical, factor_health, factor_financial,
        factor_family, factor_distance, factor_working_student,
        normalizedOther, classificationStatus, classification
      ]
    )

    res.status(201).json({ message: 'Profile saved successfully' })

  } catch (error) {
    console.error('Profile save error:', error)
    res.status(500).json({ message: 'Server error saving profile' })
  }
}

export const saveProfile = (req, res) => saveProfileWithDependencies(req, res)

export const getProfile = async (req, res) => {
  const userId = req.user.userId

  try {
    const [rows] = await pool.query(
      'SELECT * FROM PROFILE WHERE user_id = ?',
      [userId]
    )

    if (rows.length === 0) {
      return res.json({ profile: null })
    }

    res.json({ profile: rows[0] })

  } catch (error) {
    console.error('Profile fetch error:', error)
    res.status(500).json({ message: 'Server error fetching profile' })
  }
}
