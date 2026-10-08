import test from 'node:test'
import assert from 'node:assert/strict'
import {
  clearUserAuth,
  getPostRegistrationDestination,
  storeUserAuth,
} from './userAuth.js'

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial))
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  }
}

test('verified registration auth is stored like normal login auth', () => {
  const storage = memoryStorage()
  storeUserAuth(storage, { token: 'valid.jwt', userId: 7, username: 'student' })

  assert.equal(storage.getItem('token'), 'valid.jwt')
  assert.equal(storage.getItem('userId'), '7')
  assert.equal(storage.getItem('username'), 'student')
})

test('logout clears authentication and requires login again', () => {
  const storage = memoryStorage({ token: 'valid.jwt', userId: '7', username: 'student' })
  clearUserAuth(storage)

  assert.equal(storage.getItem('token'), null)
  assert.equal(storage.getItem('userId'), null)
  assert.equal(storage.getItem('username'), null)
})

test('successful registration and OTP verification routes to the main dashboard', () => {
  assert.equal(getPostRegistrationDestination(), '/dashboard')
})
