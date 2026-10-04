export const USERNAME_MIN_LENGTH = 3
export const USERNAME_MAX_LENGTH = 30
export const USERNAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_]*$/

export function validateUsername(value) {
  const username = typeof value === 'string' ? value.trim() : ''
  if (!username) return 'Please enter a username.'
  if (username.length < USERNAME_MIN_LENGTH) {
    return `Username must be at least ${USERNAME_MIN_LENGTH} characters.`
  }
  if (username.length > USERNAME_MAX_LENGTH) {
    return `Username must be at most ${USERNAME_MAX_LENGTH} characters.`
  }
  if (!USERNAME_PATTERN.test(username)) {
    return 'Username may contain only letters, numbers, and underscores, and must start with a letter or number.'
  }
  return null
}
