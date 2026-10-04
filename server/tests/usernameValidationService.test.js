import test from 'node:test'
import assert from 'node:assert/strict'

import {
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  validateUsername,
} from '../services/usernameValidationService.js'

test('username validation normalizes and accepts the shared registration format', () => {
  assert.deepEqual(validateUsername('  student_2026  '), {
    valid: true,
    value: 'student_2026',
  })
})

test('username validation rejects missing, short, long, and malformed values', () => {
  assert.equal(validateUsername('   ').valid, false)
  assert.equal(validateUsername('a'.repeat(USERNAME_MIN_LENGTH - 1)).valid, false)
  assert.equal(validateUsername('a'.repeat(USERNAME_MAX_LENGTH + 1)).valid, false)
  assert.equal(validateUsername('student-name').valid, false)
  assert.equal(validateUsername('_student').valid, false)
})
