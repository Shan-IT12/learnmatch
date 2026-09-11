import {
  CLUSTER_RIASEC_CODES,
  CLUSTER_WSM_WEIGHTS,
  MBTI_TO_RIASEC,
  PERSONAL_FACTOR_EFFECTS,
  RIASEC_DIMENSIONS,
  SCORED_PERSONAL_FACTORS,
  SKILL_DOMAINS,
} from '../config/recommendationConfig.js'

function requireCluster(parentCluster) {
  if (!CLUSTER_WSM_WEIGHTS[parentCluster]) {
    throw new Error(`Unknown parent cluster: ${parentCluster}`)
  }
}

function requireNormalizedScore(value, label) {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(`${label} must be a number from 0 to 1`)
  }
}

function clampNormalizedScore(value) {
  return Math.min(1, Math.max(0, value))
}

export function calculateCourseSkillMatch(studentDomainScores, courseSkillProfile) {
  if (!studentDomainScores || typeof studentDomainScores !== 'object') {
    throw new TypeError('studentDomainScores must be an object')
  }

  if (!Array.isArray(courseSkillProfile)) {
    throw new TypeError('courseSkillProfile must be an array')
  }

  let weightedScore = 0
  let totalWeight = 0

  for (const entry of courseSkillProfile) {
    const domain = entry.skill_domain ?? entry.skill
    const weight = Number(entry.weight)

    if (!SKILL_DOMAINS.includes(domain)) {
      throw new Error(`Unknown skill domain: ${domain}`)
    }

    if (!Number.isInteger(weight) || weight < 1 || weight > 3) {
      throw new RangeError(`Course weight for ${domain} must be an integer from 1 to 3`)
    }

    const studentScore = Number(studentDomainScores[domain])
    requireNormalizedScore(studentScore, `Student score for ${domain}`)

    weightedScore += studentScore * weight
    totalWeight += weight
  }

  return totalWeight === 0 ? 0 : clampNormalizedScore(weightedScore / totalWeight)
}

function vectorValues(vector) {
  if (Array.isArray(vector)) {
    if (vector.length !== RIASEC_DIMENSIONS.length) {
      throw new RangeError('RIASEC arrays must contain exactly six values')
    }
    return vector.map(Number)
  }

  if (!vector || typeof vector !== 'object') {
    throw new TypeError('RIASEC vector must be an object or array')
  }

  return RIASEC_DIMENSIONS.map((dimension) => Number(vector[dimension] ?? 0))
}

export function calculateRiasecCosineSimilarity(studentVector, courseVector) {
  const studentValues = vectorValues(studentVector)
  const courseValues = vectorValues(courseVector)

  if ([...studentValues, ...courseValues].some((value) => !Number.isFinite(value) || value < 0)) {
    throw new RangeError('RIASEC vector values must be finite, non-negative numbers')
  }

  const dotProduct = studentValues.reduce(
    (sum, value, index) => sum + value * courseValues[index],
    0
  )
  const studentMagnitude = Math.sqrt(
    studentValues.reduce((sum, value) => sum + value ** 2, 0)
  )
  const courseMagnitude = Math.sqrt(
    courseValues.reduce((sum, value) => sum + value ** 2, 0)
  )

  if (studentMagnitude === 0 || courseMagnitude === 0) {
    return 0
  }

  return clampNormalizedScore(dotProduct / (studentMagnitude * courseMagnitude))
}

export function getMbtiRiasecPair(mbtiType) {
  const normalizedType = String(mbtiType).toUpperCase()
  const pair = MBTI_TO_RIASEC[normalizedType]

  if (!pair) {
    throw new Error(`Unknown MBTI type: ${mbtiType}`)
  }

  return [...pair]
}

export function calculatePersonalityScore(mbtiType, parentCluster) {
  requireCluster(parentCluster)

  const studentCodes = getMbtiRiasecPair(mbtiType)
  const clusterCodes = CLUSTER_RIASEC_CODES[parentCluster]

  return studentCodes.some((code) => clusterCodes.includes(code)) ? 1 : 0
}

export function calculatePersonalFactorScore(selectedFactors, parentCluster) {
  requireCluster(parentCluster)

  if (!selectedFactors || typeof selectedFactors !== 'object') {
    throw new TypeError('selectedFactors must be an object')
  }

  const activeFactors = SCORED_PERSONAL_FACTORS.filter((factor) => (
    selectedFactors[factor] === true || selectedFactors[factor] === 1
  ))

  if (activeFactors.length === 0) {
    return 0.5
  }

  const totalEffect = activeFactors.reduce(
    (sum, factor) => sum + PERSONAL_FACTOR_EFFECTS[factor][parentCluster],
    0
  )
  const averageEffect = totalEffect / activeFactors.length

  return (averageEffect + 1) / 2
}

export function calculateClusterScore(
  { skillScore, interestScore, personalityScore, personalFactorScore },
  parentCluster
) {
  requireCluster(parentCluster)
  requireNormalizedScore(skillScore, 'skillScore')
  requireNormalizedScore(interestScore, 'interestScore')
  requireNormalizedScore(personalityScore, 'personalityScore')
  requireNormalizedScore(personalFactorScore, 'personalFactorScore')

  const weights = CLUSTER_WSM_WEIGHTS[parentCluster]

  return clampNormalizedScore(
    skillScore * weights.skillsWeight
    + interestScore * weights.interestsWeight
    + personalityScore * weights.personalityWeight
    + personalFactorScore * weights.personalFactorsWeight
  )
}

export function calculateCourseScore({
  courseSkillMatch,
  courseInterestMatch,
  parentClusterPersonalityScore,
  parentClusterPersonalFactorScore,
  parentCluster,
}) {
  return calculateClusterScore(
    {
      skillScore: courseSkillMatch,
      interestScore: courseInterestMatch,
      personalityScore: parentClusterPersonalityScore,
      personalFactorScore: parentClusterPersonalFactorScore,
    },
    parentCluster
  )
}

export function rankCourses(courses) {
  if (!Array.isArray(courses)) {
    throw new TypeError('courses must be an array')
  }

  const ranked = courses.map((course) => {
    if (typeof course.course_code !== 'string' || course.course_code.length === 0) {
      throw new TypeError('Every course must have a course_code')
    }
    requireNormalizedScore(course.finalScore, `finalScore for ${course.course_code}`)
    return { ...course }
  })

  ranked.sort((left, right) => {
    if (right.finalScore !== left.finalScore) {
      return right.finalScore - left.finalScore
    }
    if (left.course_code < right.course_code) return -1
    if (left.course_code > right.course_code) return 1
    return 0
  })

  return ranked.map((course, index) => ({
    ...course,
    rankPosition: index + 1,
  }))
}
