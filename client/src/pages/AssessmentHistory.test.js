import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'

const history = [{
  recommendation_id: 12,
  assessment_id: 22,
  attempt_number: 3,
  generated_at: '2026-09-18T13:20:21.000Z',
  mbti: { type: 'INFJ', scores: { EI: 40, NS: 70, TF: 45, JP: 60 } },
  recommendations: [
    { rank_position: 1, course_name: 'Bachelor of Science in Mathematics', match_score: 81 },
    { rank_position: 2, course_name: 'Bachelor of Science in Statistics', match_score: 78 },
    { rank_position: 3, course_name: 'Bachelor of Science in Data Science', match_score: 75 },
  ],
}]

test('history list renders attempts, latest label, MBTI, Top 3, scores, and navigation path', async () => {
  const vite = await createServer({ server: { middlewareMode: true, hmr: { port: 24682 } }, appType: 'custom', optimizeDeps: { noDiscovery: true } })
  try {
    const { HistoryListContent } = await vite.ssrLoadModule('/src/pages/AssessmentHistory.jsx')
    const { getAssessmentHistoryResultPath } = await vite.ssrLoadModule('/src/utils/assessmentHistory.js')
    const markup = renderToStaticMarkup(React.createElement(HistoryListContent, { history, onView: () => {} }))
    assert.match(markup, /Assessment 3/)
    assert.match(markup, /Latest Assessment/)
    assert.match(markup, /INFJ/)
    assert.match(markup, /Bachelor of Science in Mathematics/)
    assert.match(markup, />81%/)
    assert.equal((markup.match(/<li/g) || []).length, 3)
    assert.equal(getAssessmentHistoryResultPath(12), '/assessment-history/12')
  } finally {
    await vite.close()
  }
})

test('history list has loading, error/retry, and empty states', async () => {
  const vite = await createServer({ server: { middlewareMode: true, hmr: { port: 24683 } }, appType: 'custom', optimizeDeps: { noDiscovery: true } })
  try {
    const { AssessmentHistoryState } = await vite.ssrLoadModule('/src/pages/AssessmentHistory.jsx')
    const loading = renderToStaticMarkup(React.createElement(AssessmentHistoryState, { loading: true, error: '', history: [] }))
    const error = renderToStaticMarkup(React.createElement(AssessmentHistoryState, { loading: false, error: 'Request failed', history: [], onRetry: () => {} }))
    const empty = renderToStaticMarkup(React.createElement(AssessmentHistoryState, { loading: false, error: '', history: [], onView: () => {} }))
    assert.match(loading, /Loading your assessment history/)
    assert.match(error, /Request failed/)
    assert.match(error, /Try again/)
    assert.match(empty, /No completed assessments yet/)
  } finally {
    await vite.close()
  }
})
