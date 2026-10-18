import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('Start Next Term uses a dedicated section outside the read-only roadmap', async () => {
  const source = await readFile(new URL('./CollegeDashboard.jsx', import.meta.url), 'utf8')
  const roadmapStart = source.indexOf('id="college-panel-roadmap"')
  const roadmapEnd = source.indexOf('id="college-panel-history"')
  const setup = source.indexOf('id="next-term-setup"')

  assert.ok(roadmapStart >= 0 && roadmapEnd > roadmapStart)
  assert.doesNotMatch(source.slice(roadmapStart, roadmapEnd), /id="next-term-setup"|handleStartNextSemester/)
  assert.ok(setup >= 0 && setup < roadmapStart)
  assert.match(source.slice(roadmapStart, roadmapEnd), /<CollegeProgramRoadmap/)
  assert.match(source, /<h2[^>]*>Start Next Term<\/h2>/)
  assert.match(source, /Academic Year/)
  assert.match(source, /Schedule information/)
  assert.match(source, /border-t border-gray-100 pt-6/)
  assert.match(source, /View Completed Check-in/)
})
