export const SKILL_DOMAINS = [
  {
    name: 'Verbal',
    shortLabel: 'Verbal',
    description: 'Word relationships, vocabulary, and reading comprehension.',
  },
  {
    name: 'Numerical',
    shortLabel: 'Numerical',
    description: 'Percentages, ratios, sequences, and quantitative reasoning.',
  },
  {
    name: 'Abstract/Logical',
    shortLabel: 'Abstract / Logical',
    description: 'Pattern recognition, deduction, and logical rules.',
  },
  {
    name: 'Spatial',
    shortLabel: 'Spatial',
    description: 'Mental rotation, 3D visualization, and directional mapping.',
  },
  {
    name: 'Scientific Reasoning',
    shortLabel: 'Scientific Reasoning',
    description: 'Hypotheses, fair testing, variables, and evidence evaluation.',
  },
  {
    name: 'Practical/Applied',
    shortLabel: 'Practical / Applied',
    description: 'Real-world problem solving, procedures, and sound judgment.',
  },
]

export function getDomainSummaries(questions = [], answers = {}) {
  const byName = new Map()
  for (const domain of SKILL_DOMAINS) {
    byName.set(domain.name, {
      ...domain,
      questionIndices: [],
      total: 0,
      answered: 0,
      completed: false,
      status: 'not_started',
      firstUnansweredIndex: -1,
    })
  }

  questions.forEach((question, index) => {
    const key = question?.dimension
    if (!key) return
    if (!byName.has(key)) {
      byName.set(key, {
        name: key,
        shortLabel: key,
        description: '',
        questionIndices: [],
        total: 0,
        answered: 0,
        completed: false,
        status: 'not_started',
        firstUnansweredIndex: -1,
      })
    }
    const entry = byName.get(key)
    entry.questionIndices.push(index)
    entry.total += 1
    if (answers && answers[question.question_id]) {
      entry.answered += 1
    } else if (entry.firstUnansweredIndex === -1) {
      entry.firstUnansweredIndex = index
    }
  })

  return Array.from(byName.values())
    .filter((entry) => entry.total > 0)
    .map((entry) => {
      const completed = entry.total > 0 && entry.answered >= entry.total
      const status = completed
        ? 'completed'
        : entry.answered > 0
          ? 'in_progress'
          : 'not_started'
      return { ...entry, completed, status }
    })
}

export function getDomainQuestionPosition(questions = [], currentIndex = 0) {
  const currentQuestion = questions[currentIndex]
  if (!currentQuestion) {
    return {
      domain: null,
      indices: [],
      indexInDomain: 0,
      totalInDomain: 0,
      prevIndexInDomain: -1,
      nextIndexInDomain: -1,
      isFirstInDomain: true,
      isLastInDomain: true,
    }
  }
  const domain = currentQuestion.dimension
  const indices = []
  questions.forEach((question, index) => {
    if (question?.dimension === domain) indices.push(index)
  })
  const pos = indices.indexOf(currentIndex)
  return {
    domain,
    indices,
    indexInDomain: pos >= 0 ? pos : 0,
    totalInDomain: indices.length,
    prevIndexInDomain: pos > 0 ? indices[pos - 1] : -1,
    nextIndexInDomain: pos >= 0 && pos < indices.length - 1 ? indices[pos + 1] : -1,
    isFirstInDomain: pos <= 0,
    isLastInDomain: pos === indices.length - 1,
  }
}
