import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('College Dashboard initially limits newest-first check-in history to three records', async () => {
  const source = await readFile(new URL('./CollegeDashboard.jsx', import.meta.url), 'utf8')
  assert.match(source, /getCheckinHistoryRecords\(history\)/)
  assert.match(source, /showFullHistory \? displayedHistory : displayedHistory\.slice\(0, 3\)/)
  assert.match(source, /visibleHistory\.map/)
  assert.match(source, /View Full History/)
  assert.match(source, /Full Check-in History/)
})
