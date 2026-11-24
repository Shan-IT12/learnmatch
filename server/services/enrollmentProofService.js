import { CollegeTrackingError } from './collegeTrackingService.js'

export const ALLOWED_PROOF_MIMES = new Set([
  'image/png',
  'image/jpeg',
  'application/pdf',
])
export const MAX_PROOF_BYTES = 2 * 1024 * 1024

function cleanOptionalText(value, maxLength) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.slice(0, maxLength)
}

export function parseEnrollmentVerificationInput(input = {}) {
  const schoolName = cleanOptionalText(input?.schoolName, 255)
  const studentIdNumber = cleanOptionalText(input?.studentIdNumber, 64)
  const proof = input?.enrollmentProof || null

  if (!proof) {
    return {
      schoolName,
      studentIdNumber,
      proofName: null,
      proofMime: null,
      proofData: null,
      hasProof: false,
    }
  }

  const mimeType = String(proof.mimeType || '').toLowerCase().trim()
  if (!ALLOWED_PROOF_MIMES.has(mimeType)) {
    throw new CollegeTrackingError(
      'Upload a PNG, JPG, or PDF file for your enrollment proof.',
      'INVALID_PROOF_TYPE',
      400
    )
  }

  const fileName = cleanOptionalText(proof.fileName, 255) || 'enrollment-proof'
  const rawBase64 = String(proof.base64 || '').replace(/^data:[^;]+;base64,/i, '').trim()
  if (!rawBase64 || !/^[A-Za-z0-9+/=\s]+$/.test(rawBase64)) {
    throw new CollegeTrackingError('The uploaded enrollment proof file is invalid.', 'INVALID_PROOF_DATA', 400)
  }

  const buffer = Buffer.from(rawBase64, 'base64')
  if (!buffer.length || buffer.length > MAX_PROOF_BYTES) {
    throw new CollegeTrackingError(
      'Enrollment proof must be 2 MB or smaller.',
      'PROOF_TOO_LARGE',
      400
    )
  }

  return {
    schoolName,
    studentIdNumber,
    proofName: fileName,
    proofMime: mimeType,
    proofData: buffer.toString('base64'),
    hasProof: true,
  }
}

export async function saveEnrollmentProof(database, userId, input) {
  const parsed = parseEnrollmentVerificationInput(input)
  if (!parsed.schoolName && !parsed.studentIdNumber && !parsed.hasProof) {
    throw new CollegeTrackingError(
      'Enter your school name or upload an enrollment proof file.',
      'EMPTY_ENROLLMENT_PROOF',
      400
    )
  }

  const [cycles] = await database.query(
    `SELECT tracking_cycle_id, school_name, student_id_number, enrollment_proof_status
     FROM COLLEGE_TRACKING_CYCLE
     WHERE user_id = ?
     ORDER BY tracking_cycle_id DESC
     LIMIT 1`,
    [userId]
  )
  const cycle = cycles[0]
  if (!cycle) {
    throw new CollegeTrackingError('Complete College Phase setup before submitting enrollment proof.', 'NO_TRACKING_CYCLE', 404)
  }

  const nextSchool = parsed.schoolName ?? cycle.school_name ?? null
  const nextStudentId = parsed.studentIdNumber ?? cycle.student_id_number ?? null

  if (parsed.hasProof) {
    await database.query(
      `UPDATE COLLEGE_TRACKING_CYCLE
       SET school_name = ?,
           student_id_number = ?,
           enrollment_proof_name = ?,
           enrollment_proof_mime = ?,
           enrollment_proof_data = ?,
           enrollment_proof_status = 'submitted',
           enrollment_proof_submitted_at = CURRENT_TIMESTAMP,
           enrollment_proof_verified_at = NULL,
           enrollment_proof_rejection_reason = NULL
       WHERE tracking_cycle_id = ?`,
      [nextSchool, nextStudentId, parsed.proofName, parsed.proofMime, parsed.proofData, cycle.tracking_cycle_id]
    )
  } else {
    await database.query(
      `UPDATE COLLEGE_TRACKING_CYCLE
       SET school_name = ?,
           student_id_number = ?
       WHERE tracking_cycle_id = ?`,
      [nextSchool, nextStudentId, cycle.tracking_cycle_id]
    )
  }

  return {
    trackingCycleId: cycle.tracking_cycle_id,
    schoolName: nextSchool,
    studentIdNumber: nextStudentId,
    proofFileName: parsed.hasProof ? parsed.proofName : null,
    proofStatus: parsed.hasProof ? 'submitted' : (cycle.enrollment_proof_status || 'unsubmitted'),
  }
}

export async function getEnrollmentProofForAdmin(database, userId) {
  const normalizedUserId = Number(userId)
  if (!Number.isInteger(normalizedUserId) || normalizedUserId <= 0) return null
  const [rows] = await database.query(
    `SELECT tracking_cycle_id, school_name, student_id_number,
            enrollment_proof_name, enrollment_proof_mime, enrollment_proof_data,
            enrollment_proof_status, enrollment_proof_submitted_at, enrollment_proof_verified_at
     FROM COLLEGE_TRACKING_CYCLE
     WHERE user_id = ?
     ORDER BY tracking_cycle_id DESC
     LIMIT 1`,
    [normalizedUserId]
  )
  const row = rows[0]
  if (!row || !row.enrollment_proof_data || !row.enrollment_proof_mime) return null
  return {
    trackingCycleId: row.tracking_cycle_id,
    fileName: row.enrollment_proof_name || 'enrollment-proof',
    mimeType: row.enrollment_proof_mime,
    buffer: Buffer.from(row.enrollment_proof_data, 'base64'),
    status: row.enrollment_proof_status || 'submitted',
  }
}

export async function verifyEnrollmentProofForAdmin(database, userId) {
  const normalizedUserId = Number(userId)
  if (!Number.isInteger(normalizedUserId) || normalizedUserId <= 0) {
    throw new CollegeTrackingError('Invalid user ID.', 'INVALID_USER_ID', 400)
  }
  const [rows] = await database.query(
    `SELECT tracking_cycle_id, enrollment_proof_status, enrollment_proof_name
     FROM COLLEGE_TRACKING_CYCLE
     WHERE user_id = ?
     ORDER BY tracking_cycle_id DESC
     LIMIT 1`,
    [normalizedUserId]
  )
  const cycle = rows[0]
  if (!cycle) {
    throw new CollegeTrackingError('No College Phase tracking record found for this student.', 'NO_TRACKING_CYCLE', 404)
  }
  if (!cycle.enrollment_proof_name && cycle.enrollment_proof_status === 'unsubmitted') {
    throw new CollegeTrackingError('This student has not submitted an enrollment proof yet.', 'NO_PROOF_SUBMITTED', 409)
  }

  await database.query(
    `UPDATE COLLEGE_TRACKING_CYCLE
     SET enrollment_proof_status = 'verified',
         enrollment_proof_verified_at = CURRENT_TIMESTAMP,
         enrollment_proof_rejection_reason = NULL
     WHERE tracking_cycle_id = ?`,
    [cycle.tracking_cycle_id]
  )

  return {
    trackingCycleId: cycle.tracking_cycle_id,
    proofStatus: 'verified',
  }
}

export async function rejectEnrollmentProofForAdmin(database, userId, rawReason) {
  const normalizedUserId = Number(userId)
  if (!Number.isInteger(normalizedUserId) || normalizedUserId <= 0) {
    throw new CollegeTrackingError('Invalid user ID.', 'INVALID_USER_ID', 400)
  }
  const reason = cleanOptionalText(rawReason, 500)
  if (!reason) {
    throw new CollegeTrackingError('Enter a brief reason explaining what the student should resubmit.', 'REJECTION_REASON_REQUIRED', 400)
  }

  const [rows] = await database.query(
    `SELECT tracking_cycle_id, enrollment_proof_status, enrollment_proof_name
     FROM COLLEGE_TRACKING_CYCLE
     WHERE user_id = ?
     ORDER BY tracking_cycle_id DESC
     LIMIT 1`,
    [normalizedUserId]
  )
  const cycle = rows[0]
  if (!cycle) {
    throw new CollegeTrackingError('No College Phase tracking record found for this student.', 'NO_TRACKING_CYCLE', 404)
  }
  if (!cycle.enrollment_proof_name && cycle.enrollment_proof_status === 'unsubmitted') {
    throw new CollegeTrackingError('This student has not submitted an enrollment proof yet.', 'NO_PROOF_SUBMITTED', 409)
  }

  await database.query(
    `UPDATE COLLEGE_TRACKING_CYCLE
     SET enrollment_proof_status = 'rejected',
         enrollment_proof_verified_at = NULL,
         enrollment_proof_rejection_reason = ?
     WHERE tracking_cycle_id = ?`,
    [reason, cycle.tracking_cycle_id]
  )

  return {
    trackingCycleId: cycle.tracking_cycle_id,
    proofStatus: 'rejected',
    rejectionReason: reason,
  }
}

export async function getEnrollmentVerificationSummary(database) {
  try {
    const [[row]] = await database.query(
      `SELECT
         COUNT(*) AS total_enrolled,
         SUM(c.enrollment_proof_status = 'verified') AS verified_count,
         SUM(c.enrollment_proof_status = 'submitted') AS pending_review_count,
         SUM(c.enrollment_proof_status = 'rejected') AS rejected_count,
         SUM(c.enrollment_proof_status = 'unsubmitted' OR c.enrollment_proof_status IS NULL) AS unsubmitted_count
       FROM COLLEGE_TRACKING_CYCLE c
       JOIN (
         SELECT user_id, MAX(tracking_cycle_id) AS latest_cycle_id
         FROM COLLEGE_TRACKING_CYCLE
         GROUP BY user_id
       ) latest ON latest.latest_cycle_id = c.tracking_cycle_id`
    )
    return {
      totalEnrolled: Number(row?.total_enrolled || 0),
      verified: Number(row?.verified_count || 0),
      pendingReview: Number(row?.pending_review_count || 0),
      rejected: Number(row?.rejected_count || 0),
      unsubmitted: Number(row?.unsubmitted_count || 0),
    }
  } catch (error) {
    if (error?.code === 'ER_BAD_FIELD_ERROR' || error?.code === 'ER_NO_SUCH_TABLE') {
      return { totalEnrolled: 0, verified: 0, pendingReview: 0, rejected: 0, unsubmitted: 0 }
    }
    throw error
  }
}
