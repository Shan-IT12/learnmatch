const DIMENSIONS = Object.freeze([
  Object.freeze({ dimension: 'EI', firstPole: 'E', secondPole: 'I', scoreKey: 'EI' }),
  Object.freeze({ dimension: 'SN', firstPole: 'N', secondPole: 'S', scoreKey: 'NS' }),
  Object.freeze({ dimension: 'TF', firstPole: 'T', secondPole: 'F', scoreKey: 'TF' }),
  Object.freeze({ dimension: 'JP', firstPole: 'J', secondPole: 'P', scoreKey: 'JP' }),
])

// Exact ties intentionally select the first pole (E, N, T, J), preserving the
// established >= 50 rule while making it directly testable.
export function calculateMbtiResult(answers) {
  const totals = Object.fromEntries(DIMENSIONS.map(({ dimension, firstPole, secondPole }) => [
    dimension,
    { [firstPole]: 0, [secondPole]: 0 },
  ]))

  for (const answer of answers) {
    totals[answer.dimension][answer.pole] += Number(answer.rating)
  }

  const scores = {}
  let mbtiType = ''

  for (const { dimension, firstPole, secondPole, scoreKey } of DIMENSIONS) {
    const firstTotal = totals[dimension][firstPole]
    const score = (firstTotal / (firstTotal + totals[dimension][secondPole])) * 100
    scores[scoreKey] = score
    mbtiType += score >= 50 ? firstPole : secondPole
  }

  return { mbtiType, scores }
}
