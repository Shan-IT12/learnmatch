import test from 'node:test'
import assert from 'node:assert/strict'
import {
  deriveUsernameFromGoogleProfile,
  findOrCreateGoogleStudent,
  verifyGoogleIdToken,
} from '../services/googleAuthService.js'
import {
  getPublicValidators,
  validatePublicSignature,
} from '../services/publicValidatorService.js'

test('verifyGoogleIdToken validates audience, issuer, expiry, and verified email', async () => {
  const validFetch = async () => ({
    ok: true,
    async json() {
      return {
        aud: 'test-client-id.apps.googleusercontent.com',
        iss: 'https://accounts.google.com',
        exp: String(Math.floor(Date.now() / 1000) + 3600),
        sub: 'google-sub-12345',
        email: 'Student@Example.com',
        email_verified: 'true',
        name: 'Maria Clara',
      }
    },
  })

  const profile = await verifyGoogleIdToken('x'.repeat(32), {
    clientId: 'test-client-id.apps.googleusercontent.com',
    fetchImpl: validFetch,
  })
  assert.equal(profile.googleId, 'google-sub-12345')
  assert.equal(profile.email, 'student@example.com')
  assert.equal(profile.name, 'Maria Clara')
  assert.equal(deriveUsernameFromGoogleProfile(profile), 'Maria Clara')

  await assert.rejects(
    () => verifyGoogleIdToken('x'.repeat(32), { clientId: 'other-client', fetchImpl: validFetch }),
    (err) => err.status === 401
  )
})

test('findOrCreateGoogleStudent links existing email account and auto-creates new Google accounts', async () => {
  const queries = []
  const makeDb = (existingRows) => ({
    async getConnection() {
      return {
        async beginTransaction() {},
        async commit() {},
        async rollback() {},
        release() {},
        async query(sql, params) {
          queries.push({ sql, params })
          if (sql.includes('FROM USER_ACCOUNT')) return [existingRows]
          if (sql.includes('INSERT INTO USER_ACCOUNT')) return [{ insertId: 77 }]
          return [{ affectedRows: 1 }]
        },
      }
    },
  })

  const existing = await findOrCreateGoogleStudent(
    makeDb([{ user_id: 5, username: 'OldName', email: 'a@b.com', password: 'hash', is_active: 1 }]),
    { googleId: 'sub-1', email: 'a@b.com', name: 'New Name' }
  )
  assert.equal(existing.isNewAccount, false)
  assert.equal(existing.user.user_id, 5)

  const created = await findOrCreateGoogleStudent(
    makeDb([]),
    { googleId: 'sub-2', email: 'new@b.com', name: 'Juan Dela Cruz' }
  )
  assert.equal(created.isNewAccount, true)
  assert.equal(created.user.user_id, 77)
  assert.equal(created.user.username, 'Juan Dela Cruz')
})

test('getPublicValidators returns ONLY approved public display fields and never leaks private fields', async () => {
  const fakeDb = {
    async query() {
      return [[{
        validator_id: 3,
        full_name: 'Dr. Ana Reyes',
        profession: 'Associate Professor of Computer Science',
        affiliation: 'Bulacan State University',
        public_signature: 'data:image/png;base64,iVBORw0KGgo=',
        email: 'private@example.com',
        password_hash: 'secret',
      }]]
    },
  }

  const list = await getPublicValidators(fakeDb)
  assert.equal(list.length, 1)
  assert.deepEqual(Object.keys(list[0]).sort(), ['affiliation', 'id', 'name', 'profession', 'signature'])
  assert.equal(list[0].email, undefined)
  assert.equal(list[0].password_hash, undefined)
})

test('validatePublicSignature accepts bounded PNG/SVG data URLs and rejects invalid formats', () => {
  assert.equal(validatePublicSignature('data:image/png;base64,AAAA'), 'data:image/png;base64,AAAA')
  assert.equal(validatePublicSignature(''), null)
  assert.throws(() => validatePublicSignature('data:text/html;base64,AAAA'), (err) => err.status === 400)
})
