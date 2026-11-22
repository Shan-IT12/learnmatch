import test from 'node:test'
import assert from 'node:assert/strict'
import { SKILL_DOMAINS, getDomainQuestionPosition, getDomainSummaries } from '../src/utils/skillDomains.js'

const sampleQuestions = SKILL_DOMAINS.flatMap((domain, dIdx) =>
  Array.from({ length: 5 }, (_, qIdx) => ({
    question_id: dIdx * 10 + qIdx + 1,
    dimension: domain.name,
  }))
)

test('getDomainSummaries groups all 6 domains and tracks not_started, in_progress, and completed accurately', () => {
  const answers = {
    // Complete Spatial (domain index 3 -> ids 31..35) out of order!
    31: 'A', 32: 'B', 33: 'C', 34: 'D', 35: 'A',
    // Partially answer Numerical (domain index 1 -> ids 11..12)
    11: 'A', 12: 'B',
  }

  const summaries = getDomainSummaries(sampleQuestions, answers)
  assert.equal(summaries.length, 6)

  const verbal = summaries.find((d) => d.name === 'Verbal')
  assert.equal(verbal.status, 'not_started')
  assert.equal(verbal.answered, 0)
  assert.equal(verbal.firstUnansweredIndex, 0)

  const numerical = summaries.find((d) => d.name === 'Numerical')
  assert.equal(numerical.status, 'in_progress')
  assert.equal(numerical.answered, 2)
  assert.equal(numerical.total, 5)
  assert.equal(numerical.firstUnansweredIndex, 7)

  const spatial = summaries.find((d) => d.name === 'Spatial')
  assert.equal(spatial.status, 'completed')
  assert.equal(spatial.completed, true)
  assert.equal(spatial.answered, 5)
  assert.equal(spatial.firstUnansweredIndex, -1)
})

test('getDomainQuestionPosition navigates strictly within the chosen domain', () => {
  // Spatial starts at index 15, ends at index 19
  const first = getDomainQuestionPosition(sampleQuestions, 15)
  assert.equal(first.domain, 'Spatial')
  assert.equal(first.indexInDomain, 0)
  assert.equal(first.totalInDomain, 5)
  assert.equal(first.isFirstInDomain, true)
  assert.equal(first.prevIndexInDomain, -1)
  assert.equal(first.nextIndexInDomain, 16)

  const last = getDomainQuestionPosition(sampleQuestions, 19)
  assert.equal(last.isLastInDomain, true)
  assert.equal(last.nextIndexInDomain, -1)
  assert.equal(last.prevIndexInDomain, 18)
})
