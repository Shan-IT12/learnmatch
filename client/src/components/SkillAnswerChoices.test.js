import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { build } from 'vite'
import react from '@vitejs/plugin-react'
import { Buffer } from 'node:buffer'
import { SKILL_FIGURE_ITEMS } from '../../../shared/skillFigureChoices.js'

test('visual choices render A-D, accessible descriptions, mobile grid, and selected state; numbers stay text', async () => {
  const bundle = await build({ configFile: false, plugins: [react()], logLevel: 'silent', build: { ssr: 'src/components/SkillAnswerChoices.jsx', write: false, minify: false } })
  const entry = bundle.output.find((item) => item.type === 'chunk' && item.isEntry)
  const code = entry.code.replace(/from "([^".][^"]*)"/g, (_match, specifier) => `from "${import.meta.resolve(specifier)}"`)
  const { default: Choices } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
  for (const item of SKILL_FIGURE_ITEMS) {
    const question = { question_id: 98, dimension: item.dimension, question_text: item.questionText, ...Object.fromEntries(item.texts.map((text, index) => [`choice_${'abcd'[index]}`, text])) }
    const markup = renderToStaticMarkup(React.createElement(Choices, { question, selectedChoice: 'B', onSelect: () => {} }))
    assert.equal([...markup.matchAll(/<img /g)].length, 4)
    assert.equal([...markup.matchAll(/aria-pressed="true"/g)].length, 1)
    assert.match(markup, /grid-cols-2/)
    assert.match(markup, /border-orange-500/)
    assert.deepEqual([...markup.matchAll(/aria-label="Option ([A-D]):/g)].map((match) => match[1]), ['A', 'B', 'C', 'D'])
  }
  const numeric = renderToStaticMarkup(React.createElement(Choices, { question: { question_id: 47, question_text: 'How many triangles?', choice_a: '2', choice_b: '3', choice_c: '4', choice_d: '8' }, onSelect: () => {} }))
  assert.doesNotMatch(numeric, /<img /)
  for (const number of ['2', '3', '4', '8']) assert.match(numeric, new RegExp(`>${number}</span>`))
})
