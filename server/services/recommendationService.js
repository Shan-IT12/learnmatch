import {
  INTEREST_RIASEC_MAP,
  PRIMARY_INTEREST_CONTRIBUTION,
  SECONDARY_INTEREST_CONTRIBUTION,
} from '../config/interestRiasecConfig.js'
import {
  CLUSTER_RIASEC_CODES,
  CLUSTER_SKILL_DOMAINS,
  MBTI_TO_RIASEC,
  PARENT_CLUSTERS,
  RIASEC_DIMENSIONS,
  SKILL_DOMAINS,
} from '../config/recommendationConfig.js'
import {
  calculateClusterScore,
  calculateCourseScore,
  calculateCourseSkillMatch,
  calculatePersonalFactorScore,
  calculatePersonalityScore,
  calculateRiasecCosineSimilarity,
  rankCourses,
} from './recommendationEngine.js'

export class RecommendationInputError extends Error {
  constructor(message) {
    super(message)
    this.name = 'RecommendationInputError'
  }
}

export class RecommendationDataError extends Error {
  constructor(message) {
    super(message)
    this.name = 'RecommendationDataError'
  }
}

export function buildStudentDomainScores(skillResponses) {
  if (!Array.isArray(skillResponses) || skillResponses.length !== 30) {
    throw new RecommendationInputError(
      'A complete skills assessment with exactly 30 responses is required.'
    )
  }

  const totals = Object.fromEntries(
    SKILL_DOMAINS.map((domain) => [domain, { correct: 0, total: 0 }])
  )

  for (const response of skillResponses) {
    if (!SKILL_DOMAINS.includes(response.dimension)) {
      throw new RecommendationInputError(
        `The current skills assessment contains an unknown domain: ${response.dimension}`
      )
    }

    const isCorrect = Number(response.is_correct)
    if (isCorrect !== 0 && isCorrect !== 1) {
      throw new RecommendationInputError(
        `The current skills assessment contains an invalid score for ${response.dimension}.`
      )
    }

    totals[response.dimension].total += 1
    totals[response.dimension].correct += isCorrect
  }

  const domainScores = {}

  for (const domain of SKILL_DOMAINS) {
    if (totals[domain].total !== 5) {
      throw new RecommendationInputError(
        `The current skills assessment must contain exactly 5 responses for ${domain}.`
      )
    }

    domainScores[domain] = totals[domain].correct / totals[domain].total
  }

  return domainScores
}

export function buildStudentRiasecVector(interestNames) {
  if (!Array.isArray(interestNames) || interestNames.length === 0) {
    throw new RecommendationInputError(
      'At least one selected interest is required to generate recommendations.'
    )
  }

  const vector = Object.fromEntries(RIASEC_DIMENSIONS.map((dimension) => [dimension, 0]))

  for (const interestName of interestNames) {
    const mapping = INTEREST_RIASEC_MAP[interestName]

    if (!mapping) {
      throw new RecommendationInputError(`Unknown stored interest: ${interestName}`)
    }

    vector[mapping.primary] += PRIMARY_INTEREST_CONTRIBUTION
    if (mapping.secondary) {
      vector[mapping.secondary] += SECONDARY_INTEREST_CONTRIBUTION
    }
  }

  return vector
}

export function toDisplayPercent(normalizedScore) {
  if (!Number.isFinite(normalizedScore) || normalizedScore < 0 || normalizedScore > 1) {
    throw new RangeError('Display score must be a number from 0 to 1')
  }

  return Math.round(normalizedScore * 10000) / 100
}

export function calculateClusterSkillScore(studentDomainScores, parentCluster) {
  const domains = CLUSTER_SKILL_DOMAINS[parentCluster]

  if (!domains) {
    throw new Error(`Unknown parent cluster: ${parentCluster}`)
  }

  const total = domains.reduce((sum, domain) => {
    const score = Number(studentDomainScores[domain])

    if (!Number.isFinite(score) || score < 0 || score > 1) {
      throw new RangeError(`Student score for ${domain} must be a number from 0 to 1`)
    }

    return sum + score
  }, 0)

  return total / domains.length
}

export function buildClusterRiasecVector(parentCluster) {
  const codes = CLUSTER_RIASEC_CODES[parentCluster]

  if (!codes) {
    throw new Error(`Unknown parent cluster: ${parentCluster}`)
  }

  const vector = Object.fromEntries(RIASEC_DIMENSIONS.map((dimension) => [dimension, 0]))
  for (const code of codes) {
    vector[code] = 1
  }

  return vector
}

export function calculateClusterInterestScore(studentRiasecVector, parentCluster) {
  return calculateRiasecCosineSimilarity(
    studentRiasecVector,
    buildClusterRiasecVector(parentCluster)
  )
}

export function rankClusters(clusters) {
  const ranked = clusters.map((cluster) => ({ ...cluster }))

  ranked.sort((left, right) => {
    if (right.clusterScore !== left.clusterScore) {
      return right.clusterScore - left.clusterScore
    }
    if (left.cluster_category < right.cluster_category) return -1
    if (left.cluster_category > right.cluster_category) return 1
    return 0
  })

  return ranked.map((cluster, index) => ({
    ...cluster,
    rankPosition: index + 1,
  }))
}

export function scoreAndRankClusters({
  studentDomainScores,
  studentRiasecVector,
  mbtiType,
  profileFactors,
}) {
  const clusterScores = PARENT_CLUSTERS.map((parentCluster) => {
    const skillScore = calculateClusterSkillScore(studentDomainScores, parentCluster)
    const interestScore = calculateClusterInterestScore(studentRiasecVector, parentCluster)
    const personalityScore = calculatePersonalityScore(mbtiType, parentCluster)
    const personalFactorScore = calculatePersonalFactorScore(profileFactors, parentCluster)
    const clusterScore = calculateClusterScore(
      { skillScore, interestScore, personalityScore, personalFactorScore },
      parentCluster
    )

    return {
      cluster_category: parentCluster,
      clusterScore,
      skillScore,
      interestScore,
      personalityScore,
      personalFactorScore,
    }
  })

  return rankClusters(clusterScores)
}

export function selectTopClusters(clusterRanking) {
  return clusterRanking.slice(0, 3)
}

export function filterCoursesByCandidateClusters(courses, candidateClusters) {
  const candidateNames = new Set(
    candidateClusters.map((cluster) => cluster.cluster_category)
  )

  return courses.filter((course) => candidateNames.has(course.cluster_category))
}

function validateMbtiType(mbtiType) {
  const normalizedType = String(mbtiType).toUpperCase()

  if (!MBTI_TO_RIASEC[normalizedType]) {
    throw new RecommendationInputError(`Unknown stored MBTI type: ${mbtiType}`)
  }

  return normalizedType
}

function groupRowsByCourseId(rows) {
  const grouped = new Map()

  for (const row of rows) {
    if (!grouped.has(row.course_id)) {
      grouped.set(row.course_id, [])
    }
    grouped.get(row.course_id).push(row)
  }

  return grouped
}

function validateCourseSkillProfile(course, profile) {
  if (profile.length === 0) {
    throw new RecommendationDataError(
      `Course ${course.course_code} has no skill profile rows.`
    )
  }

  const domains = new Set()

  for (const entry of profile) {
    const weight = Number(entry.weight)

    if (!SKILL_DOMAINS.includes(entry.skill_domain)) {
      throw new RecommendationDataError(
        `Course ${course.course_code} has an unknown skill domain: ${entry.skill_domain}`
      )
    }
    if (domains.has(entry.skill_domain)) {
      throw new RecommendationDataError(
        `Course ${course.course_code} has a duplicate ${entry.skill_domain} skill profile.`
      )
    }
    if (!Number.isInteger(weight) || weight < 1 || weight > 3) {
      throw new RecommendationDataError(
        `Course ${course.course_code} has an invalid weight for ${entry.skill_domain}.`
      )
    }

    domains.add(entry.skill_domain)
  }
}

function buildCourseRiasecVector(course, profile) {
  if (profile.length !== RIASEC_DIMENSIONS.length) {
    throw new RecommendationDataError(
      `Course ${course.course_code} must have exactly 6 RIASEC profile rows.`
    )
  }

  const vector = {}

  for (const entry of profile) {
    const dimension = entry.riasec_type
    const weight = Number(entry.weight)

    if (!RIASEC_DIMENSIONS.includes(dimension)) {
      throw new RecommendationDataError(
        `Course ${course.course_code} has an unknown RIASEC dimension: ${dimension}`
      )
    }
    if (vector[dimension] !== undefined) {
      throw new RecommendationDataError(
        `Course ${course.course_code} has a duplicate ${dimension} RIASEC profile.`
      )
    }
    if (!Number.isInteger(weight) || weight < 0 || weight > 3) {
      throw new RecommendationDataError(
        `Course ${course.course_code} has an invalid RIASEC weight for ${dimension}.`
      )
    }

    vector[dimension] = weight
  }

  for (const dimension of RIASEC_DIMENSIONS) {
    if (vector[dimension] === undefined) {
      throw new RecommendationDataError(
        `Course ${course.course_code} is missing its ${dimension} RIASEC profile.`
      )
    }
  }

  return vector
}

function shapeRecommendation(course) {
  return {
    rank_position: course.rankPosition,
    course_id: course.course_id,
    course_code: course.course_code,
    course_name: course.course_name,
    course_abbreviation: course.course_abbreviation,
    cluster_category: course.cluster_category,
    match_score: toDisplayPercent(course.finalScore),
    score_breakdown: {
      skill_match: toDisplayPercent(course.scoreBreakdown.skillMatch),
      interest_match: toDisplayPercent(course.scoreBreakdown.interestMatch),
      personality_match: toDisplayPercent(course.scoreBreakdown.personalityMatch),
      personal_factor_match: toDisplayPercent(course.scoreBreakdown.personalFactorMatch),
    },
    ai_narrative: null,
  }
}

export async function getTopCourseRecommendations(pool, userId) {
  const [
    [skillResponses],
    [interestRows],
    [personalityRows],
    [profileRows],
    [courseRows],
    [courseSkillRows],
    [courseRiasecRows],
  ] = await Promise.all([
    pool.query(
      `SELECT sr.skill_response_id, sr.is_correct, q.dimension
       FROM SKILL_RESPONSE sr
       JOIN QUESTION q ON q.question_id = sr.question_id
       WHERE sr.user_id = ?
       ORDER BY sr.skill_response_id DESC
       LIMIT 30`,
      [userId]
    ),
    pool.query(
      `SELECT interest_name
       FROM INTEREST_RESPONSE
       WHERE user_id = ?`,
      [userId]
    ),
    pool.query(
      `SELECT assessment_id, mbti_type
       FROM PERSONALITY_ASSESSMENT
       WHERE user_id = ?
       ORDER BY assessment_id DESC
       LIMIT 1`,
      [userId]
    ),
    pool.query(
      `SELECT factor_physical, factor_health, factor_financial,
              factor_family, factor_working_student
       FROM PROFILE
       WHERE user_id = ?
       LIMIT 1`,
      [userId]
    ),
    pool.query(
      `SELECT course_id, course_code, course_name, course_abbreviation, cluster_category
       FROM COURSE
       WHERE is_active = 1`,
    ),
    pool.query(
      `SELECT csp.course_id, csp.skill_domain, csp.weight
       FROM COURSE_SKILL_PROFILE csp
       JOIN COURSE c ON c.course_id = csp.course_id
       WHERE c.is_active = 1`,
    ),
    pool.query(
      `SELECT crp.course_id, crp.riasec_type, crp.weight
       FROM COURSE_RIASEC_PROFILE crp
       JOIN COURSE c ON c.course_id = crp.course_id
       WHERE c.is_active = 1`,
    ),
  ])

  const studentDomainScores = buildStudentDomainScores(skillResponses)
  const studentRiasecVector = buildStudentRiasecVector(
    interestRows.map((row) => row.interest_name)
  )

  if (personalityRows.length === 0) {
    throw new RecommendationInputError(
      'A completed personality assessment is required to generate recommendations.'
    )
  }
  const mbtiType = validateMbtiType(personalityRows[0].mbti_type)

  if (profileRows.length === 0) {
    throw new RecommendationInputError(
      'A student profile is required to generate recommendations.'
    )
  }
  const profileFactors = profileRows[0]

  const knownClusters = new Set(PARENT_CLUSTERS)
  const eligibleCourses = courseRows.filter((course) => knownClusters.has(course.cluster_category))

  if (eligibleCourses.length === 0) {
    throw new RecommendationDataError('No active courses have a recognized parent cluster.')
  }

  const clusterRanking = scoreAndRankClusters({
    studentDomainScores,
    studentRiasecVector,
    mbtiType,
    profileFactors,
  })
  const candidateClusters = selectTopClusters(clusterRanking)
  const candidateCourses = filterCoursesByCandidateClusters(
    eligibleCourses,
    candidateClusters
  )

  if (candidateCourses.length === 0) {
    throw new RecommendationDataError('No active courses belong to the top 3 clusters.')
  }

  const clusterScoresByName = new Map(
    clusterRanking.map((cluster) => [cluster.cluster_category, cluster])
  )
  const skillProfilesByCourse = groupRowsByCourseId(courseSkillRows)
  const riasecProfilesByCourse = groupRowsByCourseId(courseRiasecRows)

  const scoredCourses = candidateCourses.map((course) => {
    if (typeof course.course_code !== 'string' || course.course_code.length === 0) {
      throw new RecommendationDataError(
        `Active course ID ${course.course_id} has no valid course_code.`
      )
    }

    const courseSkillProfile = skillProfilesByCourse.get(course.course_id) ?? []
    const courseRiasecProfile = riasecProfilesByCourse.get(course.course_id) ?? []

    validateCourseSkillProfile(course, courseSkillProfile)
    const courseRiasecVector = buildCourseRiasecVector(course, courseRiasecProfile)

    const courseSkillMatch = calculateCourseSkillMatch(
      studentDomainScores,
      courseSkillProfile
    )
    const courseInterestMatch = calculateRiasecCosineSimilarity(
      studentRiasecVector,
      courseRiasecVector
    )
    const clusterScores = clusterScoresByName.get(course.cluster_category)
    const parentClusterPersonalityScore = clusterScores.personalityScore
    const parentClusterPersonalFactorScore = clusterScores.personalFactorScore
    const finalScore = calculateCourseScore({
      courseSkillMatch,
      courseInterestMatch,
      parentClusterPersonalityScore,
      parentClusterPersonalFactorScore,
      parentCluster: course.cluster_category,
    })

    return {
      ...course,
      finalScore,
      scoreBreakdown: {
        skillMatch: courseSkillMatch,
        interestMatch: courseInterestMatch,
        personalityMatch: parentClusterPersonalityScore,
        personalFactorMatch: parentClusterPersonalFactorScore,
      },
    }
  })

  return rankCourses(scoredCourses).slice(0, 3).map(shapeRecommendation)
}
