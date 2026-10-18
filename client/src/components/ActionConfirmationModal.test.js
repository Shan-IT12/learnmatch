import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import { readFile } from 'node:fs/promises'

test('college action confirmations are accessible and distinguish ending tracking', async () => {
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: 'custom',
    optimizeDeps: { noDiscovery: true },
  })

  try {
    const { default: ActionConfirmationModal } = await vite.ssrLoadModule('/src/components/ActionConfirmationModal.jsx')
    const earlyMarkup = renderToStaticMarkup(React.createElement(ActionConfirmationModal, {
      action: 'earlyCheckin', description: 'Your term is currently in the Early phase. Your next check-in is End.',
      onCancel: () => {}, onConfirm: () => {},
    }))
    assert.match(earlyMarkup, /Start this check-in early/)
    assert.match(earlyMarkup, /currently in the Early phase/)
    assert.match(earlyMarkup, /Wait for scheduled phase/)
    assert.match(earlyMarkup, /Continue early/)
    const endMarkup = renderToStaticMarkup(React.createElement(ActionConfirmationModal, {
      action: 'end',
      onCancel: () => {},
      onConfirm: () => {},
    }))
    const pauseMarkup = renderToStaticMarkup(React.createElement(ActionConfirmationModal, {
      action: 'pause',
      onCancel: () => {},
      onConfirm: () => {},
    }))

    const retakeMarkup = renderToStaticMarkup(React.createElement(ActionConfirmationModal, {
      action: 'retake', onCancel: () => {}, onConfirm: () => {},
    }))
    assert.match(retakeMarkup, /Retake your assessment/)
    assert.match(retakeMarkup, /current recommendations and completed assessment will stay saved in Assessment History/)
    assert.match(retakeMarkup, /Start New Assessment/)
    assert.match(retakeMarkup, /Cancel/)
    assert.doesNotMatch(retakeMarkup, /from-red-600/)
    const failedRetake = renderToStaticMarkup(React.createElement(ActionConfirmationModal, {
      action: 'retake', onCancel: () => {}, onConfirm: () => {}, error: 'Could not start a new assessment.',
    }))
    assert.match(failedRetake, /role="alert"/)
    assert.match(failedRetake, /Could not start a new assessment/)
    const leaveMarkup = renderToStaticMarkup(React.createElement(ActionConfirmationModal, {
      action: 'leaveAssessment', onCancel: () => {}, onConfirm: () => {}, confirmDisabled: true,
    }))
    assert.match(leaveMarkup, /Leave this assessment/)
    assert.match(leaveMarkup, /Your progress stays saved/)
    assert.match(leaveMarkup, /Stay here/)
    assert.match(leaveMarkup, /Checking destination/)
    assert.equal((leaveMarkup.match(/disabled=""/g) || []).length, 1)
    const logoutMarkup = renderToStaticMarkup(React.createElement(ActionConfirmationModal, {
      action: 'logout', onCancel: () => {}, onConfirm: () => {},
    }))
    assert.match(logoutMarkup, /Are you sure you want to log out/)
    assert.match(logoutMarkup, /Stay signed in/)
    assert.match(logoutMarkup, /Yes, log out/)
    assert.doesNotMatch(logoutMarkup, /Your progress stays saved/)
    const { default: LogoutButton } = await vite.ssrLoadModule('/src/components/LogoutButton.jsx')
    let logoutCalls = 0
    const buttonMarkup = renderToStaticMarkup(React.createElement(LogoutButton, { onConfirm: () => { logoutCalls += 1 } }))
    assert.match(buttonMarkup, /aria-haspopup="dialog"/)
    assert.doesNotMatch(buttonMarkup, /role="dialog"/)
    assert.equal(logoutCalls, 0)
    assert.match(endMarkup, /role="dialog"/)
    assert.match(endMarkup, /aria-modal="true"/)
    assert.match(endMarkup, /End tracking\?/) 
    assert.match(endMarkup, /Cancel/)
    assert.match(endMarkup, /End Tracking/)
    assert.match(endMarkup, /from-red-600/)
    assert.match(pauseMarkup, /Confirm Pause/)
  } finally {
    await vite.close()
  }
})

test('college action confirmation handles cancel, keyboard escape, focus trapping, and disabled processing state', async () => {
  const source = await readFile(new URL('./ActionConfirmationModal.jsx', import.meta.url), 'utf8')

  assert.match(source, /onClick=\{onCancel\}/)
  assert.match(source, /event\.key === 'Escape' && !processing/)
  assert.match(source, /event\.key !== 'Tab'/)
  assert.match(source, /disabled=\{processing\}/)
  assert.match(source, /previousFocusRef\.current\?\.focus/)
})


test('Summary retake opens a confirmation and creates an attempt only after confirmation', async () => {
  const source = await readFile(new URL('../pages/SummaryDashboard.jsx', import.meta.url), 'utf8')
  assert.match(source, /onClick=\{\(\) => \{ setRetakeError\(''\); setShowRetakeConfirmation\(true\)/)
  assert.match(source, /onConfirm=\{handleRetake\}/)
  assert.match(source, /if \(!showRetakeConfirmation \|\| retakePendingRef\.current\) return/)
  assert.match(source, /processing=\{startingRetake\}/)
  assert.match(source, /error=\{retakeError\}/)
  assert.doesNotMatch(source, /window\.(?:alert|confirm)\(/)
})


test('student and admin logout controls use confirmation before clearing sessions', async () => {
  for (const path of ['../pages/Dashboard.jsx', '../pages/SummaryDashboard.jsx', '../pages/college/CollegeDashboard.jsx', './AdminHeader.jsx']) {
    const source = await readFile(new URL(path, import.meta.url), 'utf8')
    assert.match(source, /<LogoutButton/)
    assert.match(source, /onConfirm=\{handleLogout\}/)
    assert.doesNotMatch(source, /onClick=\{handleLogout\}/)
  }
  const button = await readFile(new URL('./LogoutButton.jsx', import.meta.url), 'utf8')
  assert.match(button, /onClick=\{\(\) => setOpen\(true\)\}/)
  assert.match(button, /onCancel=\{\(\) => setOpen\(false\)\}/)
  assert.match(button, /onConfirm=\{\(\) => \{ setOpen\(false\); onConfirm\(\)/)
  assert.match(button, /createPortal/)
  assert.doesNotMatch(button, /window\.(?:alert|confirm)\(/)
})
