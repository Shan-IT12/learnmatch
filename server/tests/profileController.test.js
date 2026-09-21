import test from 'node:test'
import assert from 'node:assert/strict'

import { saveProfileWithDependencies } from '../controllers/profileController.js'

const baseBody = Object.freeze({
  full_name: 'Student Name',
  height_cm: '',
  weight_kg: '',
  factor_physical: false,
  factor_health: false,
  factor_financial: false,
  factor_family: false,
  factor_distance: false,
  factor_working_student: false,
  factor_others: '',
})

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this },
    json(body) { this.body = body; return this },
  }
}

function database(existing = []) {
  const calls = []
  return {
    calls,
    async query(sql, params) {
      calls.push({ sql, params })
      if (sql.includes('SELECT profile_id')) return [existing]
      return [{ affectedRows: 1 }]
    },
  }
}

async function save(body, { existing = [], classify } = {}) {
  const db = database(existing)
  const res = response()
  await saveProfileWithDependencies(
    { user: { userId: 9 }, body: { ...baseBody, ...body } },
    res,
    { database: db, classify: classify || (async () => ({ status: 'UNAVAILABLE', categories: [] })) }
  )
  return { db, res, write: db.calls[1] }
}

test('classifies trimmed custom text while preserving manual booleans', async () => {
  let classifiedText
  const { res, write } = await save({
    factor_family: false,
    factor_working_student: true,
    factor_others: '  I care for my younger siblings.  ',
  }, {
    classify: async (text) => {
      classifiedText = text
      return { status: 'MATCHED', categories: ['factor_family'] }
    },
  })

  assert.equal(res.statusCode, 201)
  assert.equal(classifiedText, 'I care for my younger siblings.')
  assert.equal(write.params[7], false)
  assert.equal(write.params[9], true)
  assert.equal(write.params[10], 'I care for my younger siblings.')
  assert.equal(write.params[11], 'MATCHED')
  assert.equal(write.params[12], '["factor_family"]')
})

test('classification failure still saves the original normalized text', async () => {
  const { res, write } = await save({ factor_others: '  A private circumstance  ' })
  assert.equal(res.statusCode, 201)
  assert.equal(write.params[10], 'A private circumstance')
  assert.equal(write.params[11], 'UNAVAILABLE')
  assert.equal(write.params[12], '[]')
})

test('whitespace-only or removed text clears both classification fields', async () => {
  let classificationCalls = 0
  const { write } = await save({ factor_others: '   ', factor_family: true }, {
    existing: [{
      profile_id: 1,
      factor_others: 'Old text',
      factor_others_classification_status: 'MATCHED',
      factor_others_classification: '["factor_family"]',
    }],
    classify: async () => { classificationCalls += 1 },
  })
  assert.equal(classificationCalls, 0)
  assert.equal(write.params[6], true)
  assert.equal(write.params[9], null)
  assert.equal(write.params[10], null)
  assert.equal(write.params[11], null)
})

test('editing custom text replaces the stored classification', async () => {
  const { write } = await save({ factor_others: 'I work evenings.' }, {
    existing: [{
      profile_id: 1,
      factor_others: 'I care for my siblings.',
      factor_others_classification_status: 'MATCHED',
      factor_others_classification: '["factor_family"]',
    }],
    classify: async () => ({
      status: 'MATCHED',
      categories: ['factor_working_student', 'factor_financial'],
    }),
  })
  assert.equal(write.params[9], 'I work evenings.')
  assert.equal(write.params[10], 'MATCHED')
  assert.equal(write.params[11], '["factor_working_student","factor_financial"]')
})

test('unchanged matched, ambiguous, and unmatched results avoid another AI call', async () => {
  for (const stored of [
    { status: 'MATCHED', categories: ['factor_working_student', 'factor_financial'] },
    { status: 'AMBIGUOUS', categories: [] },
    { status: 'UNMATCHED', categories: [] },
  ]) {
    let classificationCalls = 0
    const { write } = await save({ factor_others: 'I work evenings.' }, {
      existing: [{
        profile_id: 1,
        factor_others: 'I work evenings.',
        factor_others_classification_status: stored.status,
        factor_others_classification: JSON.stringify(stored.categories),
      }],
      classify: async () => { classificationCalls += 1 },
    })
    assert.equal(classificationCalls, 0)
    assert.equal(write.params[10], stored.status)
    assert.equal(write.params[11], JSON.stringify(stored.categories))
  }
})

test('reused classification is reported without exposing profile data', async () => {
  const events = []
  const db = database([{
    profile_id: 1,
    factor_others: 'Private custom text',
    factor_others_classification_status: 'MATCHED',
    factor_others_classification: '["factor_family"]',
  }])
  const res = response()
  await saveProfileWithDependencies(
    {
      user: { userId: 9 },
      body: { ...baseBody, full_name: 'Student Name', factor_others: 'Private custom text' },
    },
    res,
    {
      database: db,
      classify: async () => { throw new Error('classification should not run') },
      logClassification: (result, options) => events.push({ result, options }),
    }
  )
  assert.deepEqual(events, [{
    result: { status: 'MATCHED', categories: ['factor_family'] },
    options: { reused: true },
  }])
  assert.doesNotMatch(JSON.stringify(events), /Private custom text|Student Name|"userId":9/)
})

test('unchanged unavailable result triggers one new classification attempt', async () => {
  let classificationCalls = 0
  const { write } = await save({ factor_others: 'I work evenings.' }, {
    existing: [{
      profile_id: 1,
      factor_others: 'I work evenings.',
      factor_others_classification_status: 'UNAVAILABLE',
      factor_others_classification: null,
    }],
    classify: async () => {
      classificationCalls += 1
      return { status: 'MATCHED', categories: ['factor_working_student'] }
    },
  })
  assert.equal(classificationCalls, 1)
  assert.equal(write.params[10], 'MATCHED')
  assert.equal(write.params[11], '["factor_working_student"]')
})

test('failed retry of unchanged unavailable result still saves unavailable and empty categories', async () => {
  let classificationCalls = 0
  const { res, write } = await save({ factor_others: 'I work evenings.' }, {
    existing: [{
      profile_id: 1,
      factor_others: 'I work evenings.',
      factor_others_classification_status: 'UNAVAILABLE',
      factor_others_classification: null,
    }],
    classify: async () => {
      classificationCalls += 1
      return { status: 'UNAVAILABLE', categories: [] }
    },
  })
  assert.equal(classificationCalls, 1)
  assert.equal(res.statusCode, 200)
  assert.equal(write.params[10], 'UNAVAILABLE')
  assert.equal(write.params[11], '[]')
})

test('rejects non-string and over-limit custom input without writing', async () => {
  for (const factor_others of [{ private: true }, 'x'.repeat(501)]) {
    const { db, res } = await save({ factor_others })
    assert.equal(res.statusCode, 400)
    assert.equal(db.calls.length, 0)
  }
})
