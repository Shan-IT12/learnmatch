export const USERNAME_MIN_LENGTH = 3
export const USERNAME_MAX_LENGTH = 30
export const USERNAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_]*$/

export function validateUsername(value) {
  const username = typeof value === 'string' ? value.trim() : ''
  if (!username) return { valid: false, message: 'Username is required.' }
  if (username.length < USERNAME_MIN_LENGTH) {
    return { valid: false, message: `Username must be at least ${USERNAME_MIN_LENGTH} characters.` }
  }
  if (username.length > USERNAME_MAX_LENGTH) {
    return { valid: false, message: `Username must be at most ${USERNAME_MAX_LENGTH} characters.` }
  }
  if (!USERNAME_PATTERN.test(username)) {
    return {
      valid: false,
      message: 'Username may contain only letters, numbers, and underscores, and must start with a letter or number.',
    }
  }
  return { valid: true, value: username }
}
