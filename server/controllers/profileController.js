import pool from '../config/db.js'

export const saveProfile = async (req, res) => {
  const {
    userId,
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
          full_name, height_cm, weight_kg,
          factor_physical, factor_health, factor_financial,
          factor_family, factor_distance, factor_working_student,
          factor_others, userId
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
        userId, full_name, height_cm, weight_kg,
        factor_physical, factor_health, factor_financial,
        factor_family, factor_distance, factor_working_student,
        factor_others
      ]
    )

    res.status(201).json({ message: 'Profile saved successfully' })

  } catch (error) {
    console.error('Profile save error:', error)
    res.status(500).json({ message: 'Server error saving profile' })
  }
}

export const getProfile = async (req, res) => {
  const { userId } = req.query

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