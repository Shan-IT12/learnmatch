import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'

test('question navigation uses clear labels and completion-gated disabled states', async () => {
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: 'custom',
    optimizeDeps: { noDiscovery: true },
  })
  try {
    const { default: AssessmentQuestionNavigation } = await vite.ssrLoadModule('/src/components/AssessmentQuestionNavigation.jsx')
    const render = (props) => renderToStaticMarkup(React.createElement(AssessmentQuestionNavigation, {
      currentIndex: 0,
      isLastQuestion: false,
      currentAnswered: false,
      allAnswered: false,
      submitting: false,
      finalLabel: 'Submit Academic Skills',
      onBack: () => {},
      onNext: () => {},
      onSubmit: () => {},
      ...props,
    }))

    const unanswered = render()
    assert.match(unanswered, /Next Question/)
    assert.match(unanswered, /disabled=""/)
    assert.doesNotMatch(unanswered, /Back to Previous Question/)

    const answered = render({ currentAnswered: true, currentIndex: 2 })
    assert.doesNotMatch(answered, /disabled=""/)
    assert.match(answered, /Back to Previous Question/)

    const incompleteSkills = render({ isLastQuestion: true, currentIndex: 29 })
    assert.match(incompleteSkills, /Submit Academic Skills/)
    assert.match(incompleteSkills, /disabled=""/)
    assert.doesNotMatch(render({ isLastQuestion: true, currentIndex: 29, allAnswered: true }), /disabled=""/)

    const incompletePersonality = render({ isLastQuestion: true, currentIndex: 39, finalLabel: 'View Results' })
    assert.equal((incompletePersonality.match(/View Results/g) || []).length, 1)
    assert.match(incompletePersonality, /disabled=""/)
    assert.doesNotMatch(render({ isLastQuestion: true, currentIndex: 39, finalLabel: 'View Results', allAnswered: true }), /disabled=""/)
  } finally {
    await vite.close()
  }
})
