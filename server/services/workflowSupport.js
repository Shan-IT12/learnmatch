export class WorkflowError extends Error {
  constructor(message, status = 400, details = {}) {
    super(message)
    this.status = status
    this.details = details
  }
}

export async function workflowTransaction(database, action) {
  const connection = await database.getConnection()
  try {
    await connection.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED')
    await connection.beginTransaction()
    const result = await action(connection)
    await connection.commit()
    return result
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

export function workflowHandler(action) {
  return async (req, res) => {
    try {
      const result = await action(req, res)
      if (!res.headersSent) res.json(result)
    } catch (error) {
      if (error instanceof WorkflowError) return res.status(error.status).json({ message: error.message, ...error.details })
      if (['ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT', 'ER_DUP_ENTRY'].includes(error.code)) {
        return res.status(409).json({ message: 'The record changed. Reload and try again.' })
      }
      console.error('LearnMatch workflow request failed:', error.code || error.name)
      return res.status(500).json({ message: 'Could not complete this request.' })
    }
  }
}

export function workflowText(value, label, max, required = true) {
  const text = typeof value === 'string' ? value.trim() : ''
  if ((!text && required) || text.length > max) throw new WorkflowError(`${label} must ${required ? 'contain 1 to' : 'contain at most'} ${max} characters.`)
  return text
}

export function workflowId(value) {
  if (!/^\d+$/.test(String(value)) || Number(value) < 1 || Number(value) > 2147483647) throw new WorkflowError('Invalid record ID.')
  return Number(value)
}
