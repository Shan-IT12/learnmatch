import test from 'node:test'
import assert from 'node:assert/strict'
import {
  clearStudentBrowserData,
  clearUserAuth,
  getPostRegistrationDestination,
  storeUserAuth,
} from './userAuth.js'

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial))
  return {
    get length() { return values.size },
    key: index => [...values.keys()][index] ?? null,
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

test('logout clears student drafts and feedback caches in both stores while preserving unrelated settings', () => {
  const local = memoryStorage({ token: 'old', userId: '7', username: 'first', 'learnmatch:assessment:skills': 'private', 'learnmatch:feedback-prompt:7:3': 'submitted', adminToken: 'admin', theme: 'dark' })
  const session = memoryStorage({ 'learnmatch:assessment:attempt-id': '51', 'learnmatch:assessment:personality': 'private', 'learnmatch:assessment:future-cache': 'private', 'learnmatch.feedbackEntryContext': 'college', 'learnmatch:intro-seen': '1', unrelated: 'keep' })
  clearUserAuth(local, session)
  for (const key of ['token', 'userId', 'username', 'learnmatch:assessment:skills', 'learnmatch:feedback-prompt:7:3']) assert.equal(local.getItem(key), null)
  for (const key of ['learnmatch:assessment:attempt-id', 'learnmatch:assessment:personality', 'learnmatch:assessment:future-cache', 'learnmatch.feedbackEntryContext']) assert.equal(session.getItem(key), null)
  assert.equal(local.getItem('adminToken'), 'admin')
  assert.equal(local.getItem('theme'), 'dark')
  assert.equal(session.getItem('learnmatch:intro-seen'), '1')
  assert.equal(session.getItem('unrelated'), 'keep')
})

test('signing into another account clears drafts even when the old account ID is missing', () => {
  const local = memoryStorage({ 'learnmatch:feedback-prompt:7:3': 'submitted' })
  const session = memoryStorage({ 'learnmatch:assessment:skills': 'first student answers' })
  storeUserAuth(local, { token: 'new', userId: 8, username: 'second' }, session)
  assert.equal(local.getItem('userId'), '8')
  assert.equal(local.getItem('learnmatch:feedback-prompt:7:3'), null)
  assert.equal(session.getItem('learnmatch:assessment:skills'), null)
})

test('cache cleanup tolerates restricted storage', () => {
  const restricted = { get length() { throw new Error('blocked') }, removeItem() { throw new Error('blocked') } }
  assert.doesNotThrow(() => clearStudentBrowserData(restricted, restricted))
})
