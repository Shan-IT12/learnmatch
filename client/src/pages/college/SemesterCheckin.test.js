import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import { checkinQuestions, checkinScale } from '../../data/checkinQuestions.js'

test('Term Check-in renders compact numeric radios, progress, term context, and optional End GWA', async () => {
  const vite = await createServer({
    server: { middlewareMode: true, hmr: { port: 24680 } },
    appType: 'custom',
    optimizeDeps: { noDiscovery: true },
  })
  try {
    const { AnsweredProgress, CheckinHeader, CheckinQuestionCard, EndPhaseGwaField } =
      await vite.ssrLoadModule('/src/pages/college/SemesterCheckin.jsx')

    const header = renderToStaticMarkup(React.createElement(CheckinHeader, {
      courseName: 'Bachelor of Science in Mathematics',
      termLabel: '1st Trimester',
      phase: 'Mid',
      answeredCount: 3,
    }))
    assert.match(header, /Term Check-in/)
    assert.match(header, /Bachelor of Science in Mathematics/)
    assert.match(header, /1st Trimester/)
    assert.match(header, /Mid Phase/)
    assert.match(header, /3 of 5 answered/)

    const question = renderToStaticMarkup(React.createElement(CheckinQuestionCard, {
      question: checkinQuestions.Mid[0],
      selectedValue: 3,
    }))
    assert.equal((question.match(/type="radio"/g) || []).length, 5)
    assert.deepEqual([...question.matchAll(/value="([1-5])"/g)].map((match) => Number(match[1])), [1, 2, 3, 4, 5])
    assert.match(question, /checked="" value="3"/)
    assert.match(question, /Not true for me at all/)
    assert.match(question, /Neutral \/ Not sure/)
    assert.match(question, /Completely true for me/)

    const invalidQuestion = renderToStaticMarkup(React.createElement(CheckinQuestionCard, {
      question: checkinQuestions.Mid[0],
      error: 'Please select a response.',
    }))
    assert.match(invalidQuestion, /aria-invalid="true"/)
    assert.match(invalidQuestion, /Please select a response\./)
    assert.match(invalidQuestion, /text-red-500/)

    const progress = renderToStaticMarkup(React.createElement(AnsweredProgress, { answeredCount: 4 }))
    assert.match(progress, /4 of 5 answered/)
    assert.match(progress, /width:80%/)

    const gwa = renderToStaticMarkup(React.createElement(EndPhaseGwaField, { value: '87.5' }))
    assert.match(gwa, /Your GWA this term/)
    assert.match(gwa, /\(optional\)/)
    assert.match(gwa, /min="0"/)
    assert.match(gwa, /max="100"/)
    assert.match(gwa, /step="0.01"/)
  } finally {
    await vite.close()
  }
})

test('Check-in Complete separates the existing explanation and recommendation without changing values', async () => {
  const vite = await createServer({
    server: { middlewareMode: true, hmr: { port: 24681 } },
    appType: 'custom',
    optimizeDeps: { noDiscovery: true },
  })
  try {
    const { CheckinResult } = await vite.ssrLoadModule('/src/pages/college/SemesterCheckin.jsx')
    const result = {
      status: 'Monitor',
      alignmentPercent: 68,
      feedback: 'Existing explanation from the submitted result.',
      recommendation: 'Existing next-step recommendation from the submitted result.',
    }
    const markup = renderToStaticMarkup(React.createElement(CheckinResult, {
      result,
      courseName: 'Bachelor of Science in Mathematics',
      termLabel: 'Summer/Midyear',
      phase: 'End',
    }))
    assert.match(markup, /Check-in Complete/)
    assert.match(markup, /Bachelor of Science in Mathematics/)
    assert.match(markup, /Summer\/Midyear/)
    assert.match(markup, /End Phase/)
    assert.match(markup, /Career Alignment Result/)
    assert.match(markup, />Monitor</)
    assert.match(markup, />68%</)
    assert.match(markup, /What your result means/)
    assert.match(markup, new RegExp(result.feedback))
    assert.match(markup, /What you can do next/)
    assert.match(markup, new RegExp(result.recommendation))
    assert.match(markup, /Back to College Dashboard/)
  } finally {
    await vite.close()
  }
})

test('all phases retain five questions and numeric submission values 1 through 5', () => {
  assert.deepEqual(checkinScale.map(({ value }) => value), [1, 2, 3, 4, 5])
  for (const phase of ['Early', 'Mid', 'End']) assert.equal(checkinQuestions[phase].length, 5)
})

test('generic question terminology uses term without changing the five measured constructs', () => {
  for (const phase of ['Early', 'Mid', 'End']) {
    assert.doesNotMatch(checkinQuestions[phase].map(({ text }) => text).join(' '), /semester/i)
    assert.deepEqual(checkinQuestions[phase].map(({ dimension }) => dimension), [
      'Interest-Major Fit',
      'Demands-Abilities Fit',
      'Needs-Supplies Fit',
      'Career / Forward-Looking Fit',
      'Overall Satisfaction',
    ])
  }
})
