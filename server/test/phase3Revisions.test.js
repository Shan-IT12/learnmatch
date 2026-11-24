import test from 'node:test'
import assert from 'node:assert/strict'
import {
  parseEnrollmentVerificationInput,
  rejectEnrollmentProofForAdmin,
  saveEnrollmentProof,
  verifyEnrollmentProofForAdmin,
} from '../services/enrollmentProofService.js'

test('parseEnrollmentVerificationInput accepts valid PNG/PDF proof and rejects invalid types or oversized files', () => {
  const validPngBase64 = Buffer.from('fake-png-bytes').toString('base64')
  const parsed = parseEnrollmentVerificationInput({
    schoolName: 'Bulacan State University',
    studentIdNumber: '2026-00123',
    enrollmentProof: {
      fileName: 'cor.png',
      mimeType: 'image/png',
      base64: `data:image/png;base64,${validPngBase64}`,
    },
  })
  assert.equal(parsed.schoolName, 'Bulacan State University')
  assert.equal(parsed.studentIdNumber, '2026-00123')
  assert.equal(parsed.hasProof, true)
  assert.equal(parsed.proofMime, 'image/png')
  assert.equal(parsed.proofData, validPngBase64)

  assert.throws(
    () => parseEnrollmentVerificationInput({
      enrollmentProof: { fileName: 'script.exe', mimeType: 'application/octet-stream', base64: validPngBase64 },
    }),
    (err) => err.code === 'INVALID_PROOF_TYPE' && err.status === 400
  )

  const hugeBase64 = Buffer.alloc(2 * 1024 * 1024 + 100, 1).toString('base64')
  assert.throws(
    () => parseEnrollmentVerificationInput({
      enrollmentProof: { fileName: 'huge.pdf', mimeType: 'application/pdf', base64: hugeBase64 },
    }),
    (err) => err.code === 'PROOF_TOO_LARGE' && err.status === 400
  )
})

test('saveEnrollmentProof updates latest cycle to submitted and verifyEnrollmentProofForAdmin marks it verified', async () => {
  const updates = []
  const fakeDb = {
    async query(sql, params) {
      if (sql.includes('SELECT tracking_cycle_id')) {
        return [[{
          tracking_cycle_id: 9,
          school_name: 'BSU',
          student_id_number: '2026-1',
          enrollment_proof_status: 'submitted',
          enrollment_proof_name: 'cor.pdf',
        }]]
      }
      updates.push({ sql, params })
      return [{ affectedRows: 1 }]
    },
  }

  const saved = await saveEnrollmentProof(fakeDb, 42, {
    schoolName: 'Bulacan State University',
    studentIdNumber: '2026-00123',
    enrollmentProof: {
      fileName: 'cor.pdf',
      mimeType: 'application/pdf',
      base64: Buffer.from('%PDF-1.4').toString('base64'),
    },
  })
  assert.equal(saved.proofStatus, 'submitted')
  assert.equal(saved.trackingCycleId, 9)

  const verified = await verifyEnrollmentProofForAdmin(fakeDb, 42)
  assert.equal(verified.proofStatus, 'verified')
  assert.equal(verified.trackingCycleId, 9)
  assert.ok(updates.some((u) => u.sql.includes("enrollment_proof_status = 'verified'")))

  await assert.rejects(
    () => rejectEnrollmentProofForAdmin(fakeDb, 42, '   '),
    (err) => err.code === 'REJECTION_REASON_REQUIRED' && err.status === 400
  )

  const rejected = await rejectEnrollmentProofForAdmin(fakeDb, 42, 'COR image is blurry, please re-upload.')
  assert.equal(rejected.proofStatus, 'rejected')
  assert.equal(rejected.rejectionReason, 'COR image is blurry, please re-upload.')
  assert.ok(updates.some((u) => u.sql.includes("enrollment_proof_status = 'rejected'")))
})
