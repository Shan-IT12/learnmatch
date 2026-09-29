export const JWT_ISSUER = process.env.JWT_ISSUER || 'learnmatch-api'
export const USER_JWT_AUDIENCE = process.env.JWT_USER_AUDIENCE || 'learnmatch-web'
export const ADMIN_JWT_AUDIENCE = process.env.JWT_ADMIN_AUDIENCE || 'learnmatch-admin'
export const RESET_JWT_AUDIENCE = process.env.JWT_RESET_AUDIENCE || 'learnmatch-password-reset'
export const JWT_ALGORITHMS = ['HS256']

export const jwtSignOptions = (audience, expiresIn) => ({
  algorithm: 'HS256',
  issuer: JWT_ISSUER,
  audience,
  expiresIn,
})

export const jwtVerifyOptions = (audience) => ({
  algorithms: JWT_ALGORITHMS,
  issuer: JWT_ISSUER,
  audience,
})

const normalizeOrigin = (value) => {
  try {
    return new URL(value).origin
  } catch {
    return null
  }
}

export function allowedCorsOrigins(env = process.env) {
  const configured = [env.FRONTEND_URL, env.CORS_ALLOWED_ORIGINS]
    .filter(Boolean)
    .flatMap((value) => value.split(','))
    .map((value) => normalizeOrigin(value.trim()))
    .filter(Boolean)
  const development = env.NODE_ENV === 'production'
    ? []
    : ['http://localhost:5173', 'http://127.0.0.1:5173']
  return new Set([...configured, ...development])
}

export function corsOptions(env = process.env) {
  const allowed = allowedCorsOrigins(env)
  return {
    origin(origin, callback) {
      if (!origin || allowed.has(origin)) return callback(null, true)
      return callback(null, false)
    },
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 600,
  }
}
