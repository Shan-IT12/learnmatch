import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'

test('personality result renders student-friendly letter meanings and one continue action', async () => {
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', optimizeDeps: { noDiscovery: true } })
  try {
    const { default: PersonalityResult } = await vite.ssrLoadModule('/src/components/PersonalityResult.jsx')
    const markup = renderToStaticMarkup(React.createElement(PersonalityResult, { result: { mbtiType: 'ESFJ', scores: { EI: 56, NS: 44, TF: 44, JP: 60 } }, onContinue: () => {} }))
    const textContent = markup.replace(/<[^>]+>/g, '')
    for (const text of ['ESFJ', 'Extraverted • Sensing • Feeling • Judging', '56%', '44%', 'Common Strengths', 'Possible Challenges', 'What the letters mean', 'Your result shows which side was stronger in each pair.', 'E — Extraversion', 'I — Introversion', 'S — Sensing', 'N — Intuition', 'T — Thinking', 'F — Feeling', 'J — Judging', 'P — Perceiving', 'How this relates to LearnMatch']) assert.match(textContent, new RegExp(text.replace(/[()[\]+*?.]/g, '\\$&')))
    assert.equal((markup.match(/Your result<\/span>/g) || []).length, 4)
    for (const hidden of ['How your result was calculated', '40 questions', 'E% =', 'tie rule', 'career-interest mapping']) assert.doesNotMatch(markup, new RegExp(hidden))
    assert.equal((markup.match(/Continue to Recommendations/g) || []).length, 1)
  } finally { await vite.close() }
})
