import test from 'node:test'
import assert from 'node:assert/strict'

import {
  PERSONAL_FACTOR_CATEGORIES,
  classifyPersonalFactorText,
  logPersonalFactorClassification,
} from '../services/personalFactorClassificationService.js'

function responseWith(payload) {
  return {
    ok: true,
    json: async () => ({ output_text: typeof payload === 'string' ? payload : JSON.stringify(payload) }),
  }
}

test('accepts all six allowlisted matched categories', async () => {
  for (const category of PERSONAL_FACTOR_CATEGORIES) {
    const result = await classifyPersonalFactorText('A private custom circumstance', {
      apiKey: 'test-key',
      fetchImpl: async () => responseWith({ status: 'MATCHED', categories: [category] }),
    })
    assert.deepEqual(result, { status: 'MATCHED', categories: [category] })
  }
})

test('accepts two, three, and all six distinct matched categories', async () => {
  for (const categories of [
    ['factor_family', 'factor_financial'],
    ['factor_working_student', 'factor_financial', 'factor_family'],
    [...PERSONAL_FACTOR_CATEGORIES],
  ]) {
    const result = await classifyPersonalFactorText('A paragraph with multiple circumstances.', {
      apiKey: 'test-key',
      fetchImpl: async () => responseWith({ status: 'MATCHED', categories }),
    })
    assert.deepEqual(result, { status: 'MATCHED', categories })
  }
})

test('accepts ambiguous and unmatched results only with empty categories', async () => {
  for (const status of ['AMBIGUOUS', 'UNMATCHED']) {
    const result = await classifyPersonalFactorText('Custom circumstance', {
      apiKey: 'test-key',
      fetchImpl: async () => responseWith({ status, categories: [] }),
    })
    assert.deepEqual(result, { status, categories: [] })
  }
})

test('missing key, network failure, and malformed JSON use the safe fallback', async () => {
  const fallback = { status: 'UNAVAILABLE', categories: [] }
  assert.deepEqual(await classifyPersonalFactorText('Custom circumstance', { apiKey: '' }), fallback)
  assert.deepEqual(await classifyPersonalFactorText('Custom circumstance', {
    apiKey: 'test-key',
    fetchImpl: async () => { throw new Error('offline') },
  }), fallback)
  assert.deepEqual(await classifyPersonalFactorText('Custom circumstance', {
    apiKey: 'test-key',
    fetchImpl: async () => responseWith('{not json'),
  }), fallback)
})

test('timeout uses the safe fallback', async () => {
  const result = await classifyPersonalFactorText('Custom circumstance', {
    apiKey: 'test-key',
    timeoutMs: 5,
    fetchImpl: async (_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(new Error('aborted')))
    }),
  })
  assert.deepEqual(result, { status: 'UNAVAILABLE', categories: [] })
})

test('rejects invalid status, duplicates, unknown categories, empty matches, and non-matched categories', async () => {
  const invalid = [
    { status: 'CERTAIN', categories: ['factor_family'] },
    { status: 'MATCHED', categories: ['factor_academic'] },
    { status: 'MATCHED', categories: [] },
    { status: 'MATCHED', categories: ['factor_family', 'factor_family'] },
    { status: 'AMBIGUOUS', categories: ['factor_family'] },
    { status: 'UNMATCHED', categories: ['factor_health'] },
  ]
  for (const payload of invalid) {
    const result = await classifyPersonalFactorText('Custom circumstance', {
      apiKey: 'test-key',
      fetchImpl: async () => responseWith(payload),
    })
    assert.deepEqual(result, { status: 'UNAVAILABLE', categories: [] })
  }
})

test('empty text bypasses OpenAI', async () => {
  let calls = 0
  const result = await classifyPersonalFactorText('   ', {
    apiKey: 'test-key',
    fetchImpl: async () => { calls += 1 },
  })
  assert.equal(calls, 0)
  assert.deepEqual(result, { status: null, categories: [] })
})

test('sends only normalized custom text as input', async () => {
  const result = await classifyPersonalFactorText('  I care for my siblings.  ', {
    apiKey: 'test-key',
    fetchImpl: async (_url, options) => {
      const request = JSON.parse(options.body)
      assert.equal(request.input, 'I care for my siblings.')
      assert.equal(request.input.includes('user_id'), false)
      assert.equal(request.input.includes('course'), false)
      return responseWith({ status: 'MATCHED', categories: ['factor_family'] })
    },
  })
  assert.deepEqual(result, { status: 'MATCHED', categories: ['factor_family'] })
})

test('sends Tagalog, Taglish, and mixed-language paragraphs whole in one request', async () => {
  const inputs = [
    {
      text: 'Ako ang nag-aalaga sa mga kapatid ko pagkatapos ng klase.',
      categories: ['factor_family'],
    },
    {
      text: 'May trabaho ako habang nag-aaral at hirap din kami financially.',
      categories: ['factor_working_student', 'factor_financial'],
    },
    {
      text: 'Malayo bahay namin and I also work after class.',
      categories: ['factor_distance', 'factor_working_student'],
    },
    {
      text: 'Kailangan kong magtrabaho habang nag-aaral dahil kulang ang income ng pamilya namin. Ako rin ang nag-aalaga sa kapatid ko pagkatapos ng klase.',
      categories: ['factor_working_student', 'factor_financial', 'factor_family'],
    },
  ]
  for (const { text, categories } of inputs) {
    let calls = 0
    const result = await classifyPersonalFactorText(text, {
      apiKey: 'test-key',
      fetchImpl: async (_url, options) => {
        calls += 1
        const request = JSON.parse(options.body)
        assert.equal(request.input, text)
        assert.match(request.instructions, /Filipino\/Tagalog|mixed-language/)
        return responseWith({ status: 'MATCHED', categories })
      },
    })
    assert.equal(calls, 1)
    assert.deepEqual(result, { status: 'MATCHED', categories })
  }
})

test('development observability logs only result metadata', () => {
  const messages = []
  const logger = { info: (message) => messages.push(message) }
  logPersonalFactorClassification(
    { status: 'MATCHED', categories: ['factor_family', 'factor_financial'] },
    { environment: 'development', logger }
  )
  assert.deepEqual(messages, [
    '[PersonalFactorClassifier] Classification completed',
    'Status: MATCHED',
    'Matched categories: factor_family, factor_financial',
  ])
  assert.doesNotMatch(messages.join(' '), /siblings|student name|api[_ -]?key/i)
})

test('development observability distinguishes unavailable and reused results', () => {
  const unavailableMessages = []
  const reusedMessages = []
  logPersonalFactorClassification(
    { status: 'UNAVAILABLE', categories: [] },
    { environment: 'development', logger: { info: (message) => unavailableMessages.push(message) } }
  )
  logPersonalFactorClassification(
    { status: 'AMBIGUOUS', categories: [] },
    {
      reused: true,
      environment: 'development',
      logger: { info: (message) => reusedMessages.push(message) },
    }
  )
  assert.deepEqual(unavailableMessages, [
    '[PersonalFactorClassifier] Classification unavailable',
    'Matched categories: none',
  ])
  assert.deepEqual(reusedMessages, [
    '[PersonalFactorClassifier] Reused stored classification',
    'Status: AMBIGUOUS',
    'Matched categories: none',
  ])
})

test('classification observability is silent outside development', () => {
  const messages = []
  for (const environment of ['production', 'test', undefined]) {
    logPersonalFactorClassification(
      { status: 'MATCHED', categories: ['factor_financial'] },
      { environment, logger: { info: (message) => messages.push(message) } }
    )
  }
  assert.deepEqual(messages, [])
})
