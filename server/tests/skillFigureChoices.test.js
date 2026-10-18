import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, access } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import questionPool from '../data/questionPool.js'
import { getSkillFigurePresentation, SKILL_FIGURE_ITEMS } from '../../shared/skillFigureChoices.js'
import { scoreSkillAnswers } from '../services/assessmentAttemptService.js'

test('figure presentation preserves every original question and all answer letters', () => {
  const source = execFileSync('git', ['show', 'HEAD:server/data/questionPool.js'], { encoding: 'utf8' })
  const original = JSON.parse(source.match(/const questionPool = (\[[\s\S]*\]);/)[1])
  assert.equal(questionPool.length, original.length)
  questionPool.forEach((question, index) => {
    const { choice_figures, ...unchanged } = question
    assert.deepEqual(unchanged, original[index])
    if (choice_figures) assert.equal(choice_figures.length, 4)
  })
})

test('the eleven figure items receive visual choices in the original option order', async () => {
  assert.deepEqual(SKILL_FIGURE_ITEMS.map((item) => item.itemNumber), ['3.1', '3.3', '3.6', '3.8', '3.10', '3.13', '4.1', '4.5', '4.7', '4.10', '4.11'])
  for (const item of SKILL_FIGURE_ITEMS) {
    const question = questionPool.find((q) => q.item_number === item.itemNumber)
    assert.equal(getSkillFigurePresentation({ ...question, question_id: 98765 }), item)
    assert.equal(getSkillFigurePresentation({ ...question, choice_a: 'Changed choice' }), null)
    assert.equal(getSkillFigurePresentation({ ...question, question_text: 'Different question' }), null)
    assert.equal(new Set(item.figures.map((figure) => figure.src)).size, 4)
    for (const figure of item.figures) {
      await access(new URL(`../../client/public${figure.src}`, import.meta.url))
      const svg = await readFile(new URL(`../../client/public${figure.src}`, import.meta.url), 'utf8')
      assert.match(svg, /viewBox="0 0 128 128"/)
      assert.doesNotMatch(svg, /script|foreignObject|https?:\/\/(?!www.w3.org)/)
      assert.doesNotMatch(figure.description, /correct|answer|rotat|mirror|clockwise/i)
    }
  }
  for (const itemNumber of ['4.2', '4.4', '4.8', '4.14', '4.15']) {
    assert.equal(getSkillFigurePresentation(questionPool.find((q) => q.item_number === itemNumber)), null)
  }
})

test('existing saved A-D selections retain their question IDs and scoring', () => {
  const expected = ['B', 'A', 'A', 'D', 'A', 'C', 'A', 'B', 'A', 'C', 'D']
  const expectedFigures = ['circle', 'hexagon', 'circle', 'arrow-left', 'filled-square', 'triangle', 'f-a', 'pyramid', 'square', 'rectangle', 'circle']
  const questions = SKILL_FIGURE_ITEMS.map((item, index) => ({ ...questionPool.find((q) => q.item_number === item.itemNumber), question_id: 1000 + index }))
  assert.deepEqual(questions.map((q) => q.correct_answer), expected)
  questions.forEach((question, index) => {
    const presentation = getSkillFigurePresentation(question)
    assert.equal(presentation.figures['ABCD'.indexOf(question.correct_answer)].src, `/images/quiz/choices/${expectedFigures[index]}.svg`)
  })
  const saved = questions.map((q) => ({ question_id: q.question_id, selected_option: q.correct_answer }))
  const restored = JSON.parse(JSON.stringify(saved))
  const result = scoreSkillAnswers(restored, questions)
  assert.equal(result.correctCount, 11)
  assert.deepEqual(result.scoredAnswers.map(({ is_correct, ...answer }) => answer), saved)
})
