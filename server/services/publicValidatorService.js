const MAX_SIGNATURE_DATA_URL_LENGTH = 700_000 // ~500 KB PNG/SVG base64
const ALLOWED_SIGNATURE_PREFIX = /^data:image\/(png|svg\+xml);base64,[A-Za-z0-9+/=]+$/

export function validatePublicSignature(signature) {
  if (signature === null || signature === undefined || signature === '') return null
  if (typeof signature !== 'string') {
    const error = new Error('Signature must be a PNG or SVG image.')
    error.status = 400
    throw error
  }
  const trimmed = signature.trim()
  if (!trimmed) return null
  if (trimmed.length > MAX_SIGNATURE_DATA_URL_LENGTH) {
    const error = new Error('Signature image must be 500 KB or smaller.')
    error.status = 400
    throw error
  }
  if (!ALLOWED_SIGNATURE_PREFIX.test(trimmed)) {
    const error = new Error('Signature must be a valid PNG or SVG image.')
    error.status = 400
    throw error
  }
  return trimmed
}

export async function getPublicValidators(database) {
  try {
    const [rows] = await database.query(
      `SELECT validator_id, full_name, profession, affiliation, public_signature
       FROM VALIDATOR_ACCOUNT
       WHERE status = 'approved'
       ORDER BY full_name ASC, validator_id ASC`
    )
    return rows.map((row) => ({
      id: Number(row.validator_id),
      name: row.full_name,
      profession: row.profession,
      affiliation: row.affiliation || null,
      signature: row.public_signature || null,
    }))
  } catch (error) {
    if (error?.code === 'ER_BAD_FIELD_ERROR') {
      const [rows] = await database.query(
        `SELECT validator_id, full_name, profession, affiliation
         FROM VALIDATOR_ACCOUNT
         WHERE status = 'approved'
         ORDER BY full_name ASC, validator_id ASC`
      )
      return rows.map((row) => ({
        id: Number(row.validator_id),
        name: row.full_name,
        profession: row.profession,
        affiliation: row.affiliation || null,
        signature: null,
      }))
    }
    if (error?.code === 'ER_NO_SUCH_TABLE') return []
    throw error
  }
}

export async function updateValidatorPublicProfile(database, validatorId, { fullName, profession, signature } = {}) {
  const normalizedId = Number(validatorId)
  if (!Number.isInteger(normalizedId) || normalizedId <= 0) {
    const error = new Error('Invalid validator ID.')
    error.status = 400
    throw error
  }

  const updates = []
  const params = []

  if (fullName !== undefined) {
    const cleanName = String(fullName || '').trim()
    if (cleanName.length < 2 || cleanName.length > 150) {
      const error = new Error('Display name must be between 2 and 150 characters.')
      error.status = 400
      throw error
    }
    updates.push('full_name = ?')
    params.push(cleanName)
  }

  if (profession !== undefined) {
    const cleanProfession = String(profession || '').trim()
    if (cleanProfession.length < 2 || cleanProfession.length > 150) {
      const error = new Error('Profession/title must be between 2 and 150 characters.')
      error.status = 400
      throw error
    }
    updates.push('profession = ?')
    params.push(cleanProfession)
  }

  if (signature !== undefined) {
    const cleanSignature = validatePublicSignature(signature)
    updates.push('public_signature = ?')
    params.push(cleanSignature)
  }

  if (!updates.length) {
    const error = new Error('No profile fields provided to update.')
    error.status = 400
    throw error
  }

  params.push(normalizedId)
  const [result] = await database.query(
    `UPDATE VALIDATOR_ACCOUNT SET ${updates.join(', ')} WHERE validator_id = ?`,
    params
  )
  if (!result.affectedRows) {
    const error = new Error('Validator account not found.')
    error.status = 404
    throw error
  }
  return { updated: true }
}
