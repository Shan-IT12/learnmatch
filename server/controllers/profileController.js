import pool from '../config/db.js'

export const saveProfile = async (req, res) => {
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

  const normalizedOther =
    factor_others === '' || factor_others === undefined || factor_others === null
      ? null
      : factor_others

  try {
    // Check if profile already exists
    const [existing] = await pool.query(
      'SELECT profile_id FROM PROFILE WHERE user_id = ?',
      [userId]
    )

    if (existing.length > 0) {
      // Update existing profile
      await pool.query(
        `UPDATE PROFILE SET 
          full_name = ?, height_cm = ?, weight_kg = ?,
          factor_physical = ?, factor_health = ?, factor_financial = ?,
          factor_family = ?, factor_distance = ?, factor_working_student = ?,
          factor_others = ?
        WHERE user_id = ?`,
        [
          full_name, normalizedHeight, normalizedWeight,
          factor_physical, factor_health, factor_financial,
          factor_family, factor_distance, factor_working_student,
          normalizedOther, userId
        ]
      )
      return res.json({ message: 'Profile updated successfully' })
    }

    // Insert new profile
    await pool.query(
      `INSERT INTO PROFILE 
        (user_id, full_name, height_cm, weight_kg, factor_physical, factor_health, 
         factor_financial, factor_family, factor_distance, factor_working_student, factor_others)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId, full_name, normalizedHeight, normalizedWeight,
        factor_physical, factor_health, factor_financial,
        factor_family, factor_distance, factor_working_student,
        normalizedOther
      ]
    )

    res.status(201).json({ message: 'Profile saved successfully' })

  } catch (error) {
    console.error('Profile save error:', error)
    res.status(500).json({ message: 'Server error saving profile' })
  }
}

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
