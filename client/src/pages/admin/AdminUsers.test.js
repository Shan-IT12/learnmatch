import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('User Monitoring prioritizes User ID and keeps status rows concise', async () => {
  const source = await readFile(new URL('./AdminUsers.jsx', import.meta.url), 'utf8')
  assert.match(source, />User ID</)
  assert.match(source, /User #\{user\.userId\}/)
  assert.match(source, /@\{user\.username\}/)
  assert.match(source, /Search by User ID or username/)
  assert.match(source, />Account Status</)
  assert.match(source, />Assessment Status</)
  assert.match(source, />College Phase</)
  assert.match(source, />Registered</)
  assert.doesNotMatch(source, />Account Information</)
  assert.match(source, /<table className="w-full min-w-\[780px\] table-fixed/)
  assert.match(source, /<col className="w-\[18%\]" \/>/)
  assert.doesNotMatch(source, />View</)
  assert.doesNotMatch(source, /View details/)
  assert.doesNotMatch(source, /user\.displayName/)
  assert.doesNotMatch(source, /user\.email/)
})
