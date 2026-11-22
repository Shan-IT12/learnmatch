import { logSystemError } from '../services/systemErrorLogService.js'

export function createErrorHandler(database) {
  // eslint-disable-next-line no-unused-vars
  return async (err, req, res, next) => {
    const status = Number.isInteger(err?.status) && err.status >= 400 && err.status < 600
      ? err.status
      : Number.isInteger(err?.statusCode) && err.statusCode >= 400 && err.statusCode < 600
        ? err.statusCode
        : 500

    const endpoint = `${req?.method || 'UNKNOWN'} ${req?.originalUrl || req?.url || '/'}`
    const userId = req?.user?.userId ?? req?.admin?.adminId ?? null

    console.error(`[SystemError] ${endpoint}:`, err?.message || err)

    await logSystemError(database, {
      source: 'BACKEND',
      endpoint,
      errorMessage: err?.message || 'Unexpected server error',
      stackTrace: err?.stack || null,
      userId,
    })

    if (res.headersSent) {
      return
    }

    const message = status >= 500
      ? (err?.publicMessage || 'An unexpected server error occurred. Please try again later.')
      : (err?.message || 'Request could not be completed.')

    return res.status(status).json({ message })
  }
}

export default createErrorHandler
