import test from 'node:test'
import assert from 'node:assert/strict'
import { buildStaffEmail, staffTokenLifetime } from '../services/staffEmailService.js'

const email = 'staff@example.test'
const token = 'a'.repeat(43)
const production = { NODE_ENV: 'production', FRONTEND_URL: 'http://localhost:5173' }
const development = { NODE_ENV: 'test', DB_HOST: '127.0.0.1', FRONTEND_URL: 'http://localhost:5173' }

for (const [purpose, path, action, minutes, expiry] of [
  ['admin_setup', '/admin/account/setup', 'Set up account', 60, '1 hour'],
  ['admin_reset', '/admin/account/reset', 'Reset password', 30, '30 minutes'],
  ['validator_invite', '/validator/account/invite', 'Open Validator application', 10080, '7 days'],
  ['validator_verify', '/validator/account/verify', 'Verify email address', 60, '1 hour'],
  ['validator_reset', '/validator/account/reset', 'Reset password', 30, '30 minutes'],
]) {
  test(`${purpose} email uses the production page and matches the stored token lifetime`, () => {
    const message = buildStaffEmail(purpose, email, token, production)
    const url = `https://www.learnmatch.online${path}#${token}`
    assert.equal(message.to, email)
    assert.match(message.subject, /LearnMatch/)
    assert.equal(staffTokenLifetime(purpose), minutes)
    assert.ok(message.text.includes(`\n${action}\n${url}\n`))
    assert.ok(message.text.includes(`This link is valid for ${expiry} and can be used once.`))
    assert.ok(message.html.includes(`href="${url}"`))
    assert.ok(message.html.includes(`>${action}</a>`))
    assert.ok(message.html.includes(`<strong>${expiry}</strong>`))
    assert.ok(!message.text.includes('localhost') && !message.html.includes('localhost'))
  })
}

test('production and an unset environment use the public client even with a custom frontend URL', () => {
  for (const env of [
    { NODE_ENV: 'production', FRONTEND_URL: 'https://other.example.test' },
    { FRONTEND_URL: 'http://localhost:5173' },
    { ...development, NODE_ENV: 'development', RAILWAY_ENVIRONMENT_NAME: 'production' },
  ]) {
    const { text } = buildStaffEmail('validator_invite', email, token, env)
    assert.ok(text.includes(`\nhttps://www.learnmatch.online/validator/account/invite#${token}\n`))
  }
})

test('explicit nonproduction accepts loopback for local testing and HTTPS for staging', () => {
  const local = buildStaffEmail('validator_invite', email, token, development)
  assert.ok(local.text.includes(`\nhttp://localhost:5173/validator/account/invite#${token}\n`))
  const staging = buildStaffEmail('validator_invite', email, token, {
    ...development,
    RAILWAY_ENVIRONMENT_ID: 'staging-id',
    FRONTEND_URL: 'https://staging.example.test',
  })
  assert.ok(staging.text.includes(`\nhttps://staging.example.test/validator/account/invite#${token}\n`))
})

test('a hosted nonproduction environment cannot send loopback links', () => {
  for (const env of [
    { ...development, DB_HOST: 'mysql.example.test' },
    { ...development, RAILWAY_ENVIRONMENT_ID: 'staging-id', FRONTEND_URL: 'https://localhost:5173' },
    { ...development, FRONTEND_URL: 'http://staging.example.test' },
    { ...development, FRONTEND_URL: 'https://name:password@staging.example.test' },
  ]) {
    assert.throws(() => buildStaffEmail('validator_invite', email, token, env), /Invalid staff email frontend origin/)
  }
})

test('staff email rejects malformed tokens before rendering a link', () => {
  assert.throws(() => buildStaffEmail('admin_setup', email, '../../wrong', production), /Invalid staff email token/)
})
