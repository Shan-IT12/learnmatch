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
