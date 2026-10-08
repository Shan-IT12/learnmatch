export function storeUserAuth(storage, auth) {
  storage.setItem('token', auth.token)
  storage.setItem('userId', String(auth.userId))
  storage.setItem('username', auth.username)
}

export function clearUserAuth(storage) {
  storage.removeItem('token')
  storage.removeItem('userId')
  storage.removeItem('username')
}

export function getPostRegistrationDestination() {
  return '/dashboard'
}
