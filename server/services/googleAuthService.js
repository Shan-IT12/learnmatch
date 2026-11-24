import bcrypt from 'bcrypt'
import { randomBytes } from 'node:crypto'
import { normalizeRegistrationEmail } from './registrationEmailService.js'
import { recordSuccessfulLogin } from './accountInactivityService.js'
import { TERMS_VERSION, PRIVACY_NOTICE_VERSION } from '../shared/legalDocuments.js'

const VALID_ISSUERS = new Set(['accounts.google.com', 'https://accounts.google.com'])

export class GoogleAuthError extends Error {
  constructor(message, status = 400) {
    super(message)
    this.status = status
  }
}

export function deriveUsernameFromGoogleProfile(profile = {}) {
  const rawName = String(profile.name || profile.given_name || '').trim()
  const emailPrefix = String(profile.email || '').split('@')[0] || 'Student'
  const candidate = (rawName || emailPrefix)
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}_\-. ]/gu, '')
    .replace(/\s+/gu, ' ')
    .trim()
    .slice(0, 30)
  return candidate.length >= 2 ? candidate : 'LearnMatch Student'
}

export async function verifyGoogleIdToken(credential, { clientId = process.env.GOOGLE_CLIENT_ID, fetchImpl = fetch } = {}) {
  if (!clientId || !String(clientId).trim()) {
    throw new GoogleAuthError('Google Sign-In is not configured on this server.', 503)
  }
  const token = typeof credential === 'string' ? credential.trim() : ''
  if (!token || token.length < 20) {
    throw new GoogleAuthError('Missing or invalid Google sign-in token.', 400)
  }

  const response = await fetchImpl(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(token)}`,
    { signal: AbortSignal.timeout(10000) }
  )
  if (!response.ok) {
    throw new GoogleAuthError('Google sign-in token could not be verified. Please try again.', 401)
  }

  const payload = await response.json().catch(() => null)
  if (!payload || typeof payload !== 'object') {
    throw new GoogleAuthError('Invalid response from Google token verification.', 401)
  }
  if (payload.aud !== String(clientId).trim()) {
    throw new GoogleAuthError('Google token audience mismatch.', 401)
  }
  if (payload.iss && !VALID_ISSUERS.has(payload.iss)) {
    throw new GoogleAuthError('Invalid Google token issuer.', 401)
  }
  const exp = Number(payload.exp)
  if (Number.isFinite(exp) && exp * 1000 < Date.now()) {
    throw new GoogleAuthError('Google sign-in session expired. Please try again.', 401)
  }
  const emailVerified = payload.email_verified === true || payload.email_verified === 'true'
  const normalizedEmail = normalizeRegistrationEmail(payload.email)
  const email = normalizedEmail ? normalizedEmail.toLowerCase() : null
  if (!email || !emailVerified || !payload.sub) {
    throw new GoogleAuthError('Your Google account must have a verified email address.', 401)
  }

  return {
    googleId: String(payload.sub),
    email,
    name: String(payload.name || '').trim(),
    givenName: String(payload.given_name || '').trim(),
  }
}

export async function findOrCreateGoogleStudent(database, googleProfile) {
  const connection = await database.getConnection()
  try {
    await connection.beginTransaction()

    const [existingRows] = await connection.query(
      `SELECT user_id, username, email, password, is_active
       FROM USER_ACCOUNT
       WHERE email = ?
       LIMIT 1
       FOR UPDATE`,
      [googleProfile.email]
    )

    let user = existingRows[0] || null
    let isNewAccount = false

    if (user) {
      try {
        await connection.query(
          `UPDATE USER_ACCOUNT
           SET is_active = 1,
               google_id = COALESCE(google_id, ?)
           WHERE user_id = ?`,
          [googleProfile.googleId, user.user_id]
        )
      } catch (err) {
        if (err?.code !== 'ER_BAD_FIELD_ERROR') throw err
        await connection.query(
          'UPDATE USER_ACCOUNT SET is_active = 1 WHERE user_id = ?',
          [user.user_id]
        )
      }
    } else {
      isNewAccount = true
      const username = deriveUsernameFromGoogleProfile(googleProfile)
      const randomPasswordHash = await bcrypt.hash(randomBytes(32).toString('hex'), 10)
      let insertResult
      try {
        ;[insertResult] = await connection.query(
          `INSERT INTO USER_ACCOUNT
            (email, username, password, is_active, google_id, auth_provider, terms_version, terms_accepted_at, privacy_notice_version)
           VALUES (?, ?, ?, 1, ?, 'google', ?, NOW(3), ?)`,
          [
            googleProfile.email,
            username,
            randomPasswordHash,
            googleProfile.googleId,
            TERMS_VERSION,
            PRIVACY_NOTICE_VERSION,
          ]
        )
      } catch (err) {
        if (err?.code !== 'ER_BAD_FIELD_ERROR') throw err
        ;[insertResult] = await connection.query(
          `INSERT INTO USER_ACCOUNT
            (email, username, password, is_active, terms_version, terms_accepted_at, privacy_notice_version)
           VALUES (?, ?, ?, 1, ?, NOW(3), ?)`,
          [
            googleProfile.email,
            username,
            randomPasswordHash,
            TERMS_VERSION,
            PRIVACY_NOTICE_VERSION,
          ]
        )
      }
      user = {
        user_id: insertResult.insertId,
        username,
        email: googleProfile.email,
        password: randomPasswordHash,
        is_active: 1,
      }
    }

    await recordSuccessfulLogin(connection, user.user_id)
    await connection.commit()
    return { user, isNewAccount }
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}
