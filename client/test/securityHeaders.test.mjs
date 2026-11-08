import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'

test('browser policy disables unused capture APIs but preserves School Locator location access', async () => {
  const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'))
  const headers = config.headers.find(rule => rule.source === '/(.*)').headers
  const policy = headers.find(header => header.key.toLowerCase() === 'permissions-policy')?.value
  assert.equal(policy, 'camera=(), microphone=(), geolocation=(self)')
  assert.ok(headers.some(header => header.key === 'Content-Security-Policy'))
  assert.ok(headers.some(header => header.key === 'X-Content-Type-Options' && header.value === 'nosniff'))
})

test('built security disclosure file is plain text with an existing contact and an unexpired canonical URL', async () => {
  const text = await readFile(new URL('../dist/.well-known/security.txt', import.meta.url), 'utf8')
  const source = await readFile(new URL('../public/.well-known/security.txt', import.meta.url), 'utf8')
  assert.equal(text, source)
  assert.ok(text.includes('Contact: mailto:learnmatch1@gmail.com'))
  assert.ok(text.includes('Canonical: https://www.learnmatch.online/.well-known/security.txt'))
  assert.ok(text.includes('Preferred-Languages: en'))
  assert.ok(Date.parse(text.match(/^Expires: (.+)$/m)?.[1]) > Date.now(), 'Renew the disclosure contact expiry')
  assert.ok(!/<html|<script/i.test(text))
})

test('deployment output contains no database dumps, environment files or repository metadata', async () => {
  const files = await readdir(new URL('../dist/', import.meta.url), { recursive: true })
  assert.deepEqual(files.filter(file => /(?:^|[/\\])(?:\.env(?:\..*)?|\.git)(?:[/\\]|$)|\.(?:sql|sqlite3?|db|bak)$/i.test(file)), [])
})
