import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import { readFile } from 'node:fs/promises'

test('completed term card presents calendar-aware transition as primary and completed result as secondary', async () => {
  const source = await readFile(new URL('./CollegeDashboard.jsx', import.meta.url), 'utf8')
  assert.match(source, /`Start \$\{nextAcademicStage\.semester\}`/)
  assert.match(source, /Start Next Term/)
  assert.match(source, /bg-orange-500[^>]*>[\s\S]*nextTermActionLabel/)
  assert.match(source, /View Completed Check-in/)
  assert.doesNotMatch(source, /onClick=\{\(\) => setShowNextSemesterForm\(\(visible\)/)
})

test('tracking lifecycle actions are status-specific and preserve a completed program', async () => {
  const source = await readFile(new URL('./CollegeDashboard.jsx', import.meta.url), 'utf8')

  assert.match(source, /Tracking status: \{lifecycleStatus === 'active' \? 'Active'/)
  assert.match(source, /lifecycleStatus === 'paused'[\s\S]*updateLifecycle\('resume'\)/)
  assert.doesNotMatch(source, /college\/setup\?action=resume/)
  assert.match(source, /onClick=\{\(\) => updateLifecycle\('pause'\)\}[\s\S]*Pause Tracking/)
  assert.match(source, /End college tracking\? Your history will be preserved/)
  assert.match(source, /Previous Tracking \/ History/)
  assert.match(source, /Program Tracking Complete/)
  assert.match(source, /nextAcademicStage\?\.programCompleted/)
  assert.match(source, /Finish Tracking/)
})

test('check-in progress is based on phase progression and omits calendar progress', async () => {
  const vite = await createServer({
    server: { middlewareMode: true, hmr: { port: 24682 } },
    appType: 'custom',
    optimizeDeps: { noDiscovery: true },
  })
  try {
    const { CheckinProgress } = await vite.ssrLoadModule('/src/pages/college/CollegeDashboard.jsx')
    const markup = renderToStaticMarkup(React.createElement(CheckinProgress, {
      completedPhases: ['Early', 'Mid'],
      nextPhase: 'End',
    }))

    assert.match(markup, /2 of 3 check-ins completed/)
    assert.match(markup, />66%</)
    assert.match(markup, /Current phase: <strong>Mid/)
    assert.match(markup, /Next: <strong>End Check-in/)
    assert.doesNotMatch(markup, /Term calendar progress/)
    assert.match(markup, /aria-valuenow="66"/)
    assert.equal((markup.match(/→/g) || []).length, 2)
  } finally {
    await vite.close()
  }
})

test('check-in completion percentages advance from zero through all three phases', async () => {
  const vite = await createServer({
    server: { middlewareMode: true, hmr: { port: 24683 } },
    appType: 'custom',
    optimizeDeps: { noDiscovery: true },
  })
  try {
    const { CheckinProgress } = await vite.ssrLoadModule('/src/pages/college/CollegeDashboard.jsx')
    const render = (completedPhases, nextPhase) => renderToStaticMarkup(React.createElement(CheckinProgress, { completedPhases, nextPhase }))
    assert.match(render([], 'Early'), />0%</)
    assert.match(render(['Early'], 'Mid'), />33%</)
    assert.match(render(['Early', 'Mid'], 'End'), />66%</)
    assert.match(render(['Early', 'Mid', 'End'], null), />100%</)
  } finally {
    await vite.close()
  }
})

test('a Mid-start term preserves Early as not recorded while reaching Mid progress', async () => {
  const vite = await createServer({
    server: { middlewareMode: true, hmr: { port: 24684 } },
    appType: 'custom',
    optimizeDeps: { noDiscovery: true },
  })
  try {
    const { CheckinProgress } = await vite.ssrLoadModule('/src/pages/college/CollegeDashboard.jsx')
    const markup = renderToStaticMarkup(React.createElement(CheckinProgress, {
      completedPhases: ['Mid'],
      phaseStates: [
        { phase: 'Early', state: 'not_recorded' },
        { phase: 'Mid', state: 'completed' },
        { phase: 'End', state: 'available_early' },
      ],
      nextPhase: 'End',
    }))

    assert.match(markup, />66%</)
    assert.match(markup, /Early<\/p><p[^>]*>Not Recorded/)
    assert.match(markup, /Mid<\/p><p[^>]*>Completed/)
    assert.match(markup, /End<\/p><p[^>]*>Current \/ next/)
    assert.doesNotMatch(markup, /Early<\/p><p[^>]*>Upcoming/)
  } finally {
    await vite.close()
  }
})
