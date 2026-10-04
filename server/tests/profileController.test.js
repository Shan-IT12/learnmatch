import test from 'node:test'
import assert from 'node:assert/strict'

import {
  getProfileWithDependencies,
  saveProfileWithDependencies,
} from '../controllers/profileController.js'

const baseBody = Object.freeze({
  username: 'student9',
  physical_accessibility_areas: ['seeing', 'walking_climbing'],
  physical_accessibility_difficulties: {
    seeing: 'some_difficulty',
    walking_climbing: 'a_lot_of_difficulty',
  },
  factor_physical_impact: 2,
  factor_health_impact: 1,
  factor_financial_impact: 3,
  factor_family_impact: 4,
  factor_work_impact: 2,
})

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this },
    json(body) { this.body = body; return this },
  }
}

function database({
  accountUsername = 'student9',
  existingProfile = [],
  duplicateUsers = [],
} = {}) {
  const calls = []
  return {
    calls,
    async query(sql, params) {
      calls.push({ sql, params })
      if (sql.includes('SELECT username FROM USER_ACCOUNT')) {
        return [accountUsername === null ? [] : [{ username: accountUsername }]]
      }
      if (sql.includes('SELECT user_id FROM USER_ACCOUNT WHERE username')) return [duplicateUsers]
      if (sql.includes('SELECT profile_id FROM PROFILE')) return [existingProfile]
      if (sql.includes('SELECT * FROM PROFILE')) return [existingProfile]
      return [{ affectedRows: 1 }]
    },
  }
}

async function save(body = {}, options = {}) {
  const db = database(options)
  const res = response()
  await saveProfileWithDependencies(
    { user: { userId: 9, username: 'token-name' }, body: { ...baseBody, ...body } },
    res,
    { database: db }
  )
  const profileWrite = db.calls.find(({ sql }) => /(?:INSERT INTO|UPDATE) PROFILE/.test(sql))
  return { db, res, profileWrite }
}

test('loads the current account username with an existing Profile', async () => {
  const db = database({
    accountUsername: 'current_student',
    existingProfile: [{ profile_id: 14, factor_health_impact: 2 }],
  })
  const res = response()

  await getProfileWithDependencies(
    { user: { userId: 9, username: 'stale-token-name' } },
    res,
    { database: db }
  )

  assert.equal(res.statusCode, 200)
  assert.equal(res.body.username, 'current_student')
  assert.equal(res.body.profile.profile_id, 14)
  assert.deepEqual(db.calls[0].params, [9])
})

test('loads the current account username before a Profile has been created', async () => {
  const db = database({ accountUsername: 'new_student' })
  const res = response()

  await getProfileWithDependencies(
    { user: { userId: 9, username: 'new_student' } },
    res,
    { database: db }
  )

  assert.equal(res.statusCode, 200)
  assert.equal(res.body.username, 'new_student')
  assert.equal(res.body.profile, null)
})

test('an unchanged username is preserved without a duplicate check or account update', async () => {
  const { db, res, profileWrite } = await save({}, {
    accountUsername: 'student9',
    existingProfile: [{ profile_id: 1 }],
  })

  assert.equal(res.statusCode, 200)
  assert.equal(res.body.username, 'student9')
  assert.equal(db.calls.some(({ sql }) => sql.includes('user_id <>')), false)
  assert.equal(db.calls.some(({ sql }) => sql.startsWith('UPDATE USER_ACCOUNT')), false)
  assert.ok(profileWrite)
})

test('a username owned by another account returns an inline field conflict without writing', async () => {
  const { db, res, profileWrite } = await save({ username: 'already_used' }, {
    duplicateUsers: [{ user_id: 22 }],
    existingProfile: [{ profile_id: 1 }],
  })

  assert.equal(res.statusCode, 409)
  assert.deepEqual(res.body, {
    field: 'username',
    message: 'Username is already taken.',
  })
  assert.equal(profileWrite, undefined)
  assert.equal(db.calls.some(({ sql }) => sql.startsWith('UPDATE USER_ACCOUNT')), false)
})

test('a unique edited username updates the account and existing Profile successfully', async () => {
  const { db, res, profileWrite } = await save({ username: 'new_student' }, {
    existingProfile: [{ profile_id: 1 }],
  })

  assert.equal(res.statusCode, 200)
  assert.equal(res.body.username, 'new_student')
  const accountUpdate = db.calls.find(({ sql }) => sql.startsWith('UPDATE USER_ACCOUNT'))
  assert.deepEqual(accountUpdate.params, ['new_student', 9])
  assert.ok(profileWrite)
  assert.doesNotMatch(profileWrite.sql, /full_name\s*=/)
})

test('new profiles persist structured responses without creating a profile-only name', async () => {
  const { res, profileWrite } = await save({})

  assert.equal(res.statusCode, 201)
  assert.match(profileWrite.sql, /physical_accessibility_areas/)
  assert.match(profileWrite.sql, /factor_work_impact/)
  assert.deepEqual(profileWrite.params.slice(13), [
    '["seeing","walking_climbing"]',
    '{"seeing":"some_difficulty","walking_climbing":"a_lot_of_difficulty"}',
    2, 1, 3, 4, 2,
  ])
  assert.equal(profileWrite.params[1], null)
})

test('profile save ignores deprecated Other Context and legacy body measurements', async () => {
  const { res, profileWrite } = await save({
    factor_others: 'Private context',
    height_cm: 170,
    weight_kg: 70,
  })

  assert.equal(res.statusCode, 201)
  assert.equal(profileWrite.params[2], null)
  assert.equal(profileWrite.params[3], null)
  assert.equal(profileWrite.params[10], null)
  assert.equal(profileWrite.params[11], null)
  assert.equal(profileWrite.params[12], null)
})

test('updates write only structured Profile fields and leave every legacy field untouched', async () => {
  const { res, profileWrite } = await save({
    physical_accessibility_areas: [],
    physical_accessibility_difficulties: {},
    factor_physical_impact: 1,
  }, { existingProfile: [{ profile_id: 1 }] })

  assert.equal(res.statusCode, 200)
  assert.doesNotMatch(profileWrite.sql, /full_name\s*=/)
  assert.doesNotMatch(profileWrite.sql, /factor_physical\s*=/)
  assert.doesNotMatch(profileWrite.sql, /factor_distance\s*=/)
  assert.doesNotMatch(profileWrite.sql, /factor_others/)
  assert.doesNotMatch(profileWrite.sql, /height_cm\s*=/)
  assert.doesNotMatch(profileWrite.sql, /weight_kg\s*=/)
  assert.deepEqual(profileWrite.params, ['[]', '{}', 1, 1, 3, 4, 2, 9])
})

test('an invalid username returns a field-specific error and does not access the database', async () => {
  const { db, res } = await save({ username: 'invalid-name' })

  assert.equal(res.statusCode, 400)
  assert.equal(res.body.field, 'username')
  assert.match(res.body.message, /letters, numbers, and underscores/i)
  assert.equal(db.calls.length, 0)
})

test('invalid or incomplete responses are rejected before database access', async () => {
  for (const body of [
    { factor_health_impact: 0 },
    { factor_work_impact: 5 },
    { physical_accessibility_areas: [] },
    {
      physical_accessibility_areas: ['seeing'],
      physical_accessibility_difficulties: {},
    },
  ]) {
    const { db, res } = await save(body)
    assert.equal(res.statusCode, 400)
    assert.equal(db.calls.length, 0)
  }
})
