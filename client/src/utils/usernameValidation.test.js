import test from 'node:test'
import assert from 'node:assert/strict'

import {
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  validateUsername,
} from './usernameValidation.js'

test('shared username rules accept registration-compatible usernames', () => {
  assert.equal(validateUsername('student_2026'), null)
  assert.equal(validateUsername('  student_2026  '), null)
})

test('shared username rules enforce required, length, and allowed format', () => {
  assert.match(validateUsername('   '), /enter a username/i)
  assert.match(validateUsername('a'.repeat(USERNAME_MIN_LENGTH - 1)), /at least/i)
  assert.match(validateUsername('a'.repeat(USERNAME_MAX_LENGTH + 1)), /at most/i)
  assert.match(validateUsername('student-name'), /letters, numbers, and underscores/i)
  assert.match(validateUsername('_student'), /must start/i)
})
