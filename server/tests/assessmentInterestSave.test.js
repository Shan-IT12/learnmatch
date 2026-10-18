import test from 'node:test'
import assert from 'node:assert/strict'
import { updateAttempt } from '../services/assessmentAttemptService.js'

test('unchanged autosaved interests remain successful only for an owned active attempt', async () => {
  for (const status of ['IN_PROGRESS', 'COMPLETED', null]) {
    const database = { query: async (sql, values) => {
      if (sql.trim().startsWith('UPDATE')) return [{ affectedRows: 0 }]
      assert.deepEqual(values, [27, 7])
      return [status ? [{ status }] : []]
    } }
    assert.equal(await updateAttempt(database, 7, 27, 'interests', { selected: [], noInterests: true }), status === 'IN_PROGRESS')
  }
})
