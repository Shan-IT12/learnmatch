import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'

test('historical detail renders only persisted result fields and saved explanations', async () => {
  const vite = await createServer({ server: { middlewareMode: true, hmr: { port: 24684 } }, appType: 'custom', optimizeDeps: { noDiscovery: true } })
  try {
    const { HistoricalResultContent } = await vite.ssrLoadModule('/src/pages/AssessmentHistoryResult.jsx')
    const result = {
      recommendation_id: 12,
      attempt_number: 3,
      generated_at: '2026-09-18T13:20:21.000Z',
      mbti: { type: 'INFJ' },
      recommendations: [{
        rank_position: 1,
        course_name: 'Bachelor of Science in Mathematics',
        course_abbreviation: 'BS Math',
        match_score: 81,
        score_breakdown: { skill_match: 82, interest_match: 80, personality_match: 79, personal_factor_match: 83 },
        ai_narrative: 'Stored recommendation explanation.',
      }],
    }
    const markup = renderToStaticMarkup(React.createElement(HistoricalResultContent, { result }))
    assert.match(markup, /Read-only historical result/)
    assert.match(markup, /Assessment 3/)
    assert.match(markup, /INFJ/)
    assert.match(markup, /Bachelor of Science in Mathematics/)
    assert.match(markup, /Stored recommendation explanation/)
    assert.match(markup, /Skills/)
    assert.match(markup, /Personal Factors/)
    assert.doesNotMatch(markup, /Academic skills summary|Selected interests|BMI|Profile information/)
  } finally {
    await vite.close()
  }
})

