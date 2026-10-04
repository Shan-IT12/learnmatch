export const PARENT_CLUSTERS = Object.freeze([
  'HEALTHCARE SCIENCE CLUSTER',
  'HUMANITIES & SOCIAL SCIENCE CLUSTER',
  'BUSINESS CLUSTER',
  'HOSPITALITY & TOURISM CLUSTER',
  'AVIATION & MARITIME CLUSTER',
  'LEGAL & PUBLIC SERVICE CLUSTER',
  'EDUCATION CLUSTER',
  'ARTS & MULTIMEDIA CLUSTER',
  'CRIMINOLOGY CLUSTER',
  'AGRICULTURE & ENVIRONMENTAL CLUSTER',
  'SCIENCE & MATHEMATICS CLUSTER',
  'SPORTS & PHYSICAL EDUCATION CLUSTER',
  'ENGINEERING / STEM CLUSTER',
])

export const CLUSTER_WSM_WEIGHTS = Object.freeze({
  'HEALTHCARE SCIENCE CLUSTER': Object.freeze({
    skillsWeight: 0.35,
    interestsWeight: 0.20,
    personalityWeight: 0.30,
    personalFactorsWeight: 0.15,
  }),
  'HUMANITIES & SOCIAL SCIENCE CLUSTER': Object.freeze({
    skillsWeight: 0.30,
    interestsWeight: 0.35,
    personalityWeight: 0.25,
    personalFactorsWeight: 0.10,
  }),
  'BUSINESS CLUSTER': Object.freeze({
    skillsWeight: 0.35,
    interestsWeight: 0.25,
    personalityWeight: 0.30,
    personalFactorsWeight: 0.10,
  }),
  'HOSPITALITY & TOURISM CLUSTER': Object.freeze({
    skillsWeight: 0.25,
    interestsWeight: 0.25,
    personalityWeight: 0.25,
    personalFactorsWeight: 0.25,
  }),
  'AVIATION & MARITIME CLUSTER': Object.freeze({
    skillsWeight: 0.40,
    interestsWeight: 0.15,
    personalityWeight: 0.20,
    personalFactorsWeight: 0.25,
  }),
  'LEGAL & PUBLIC SERVICE CLUSTER': Object.freeze({
    skillsWeight: 0.30,
    interestsWeight: 0.10,
    personalityWeight: 0.40,
    personalFactorsWeight: 0.20,
  }),
  'EDUCATION CLUSTER': Object.freeze({
    skillsWeight: 0.35,
    interestsWeight: 0.25,
    personalityWeight: 0.30,
    personalFactorsWeight: 0.10,
  }),
  'ARTS & MULTIMEDIA CLUSTER': Object.freeze({
    skillsWeight: 0.25,
    interestsWeight: 0.40,
    personalityWeight: 0.25,
    personalFactorsWeight: 0.10,
  }),
  'CRIMINOLOGY CLUSTER': Object.freeze({
    skillsWeight: 0.30,
    interestsWeight: 0.10,
    personalityWeight: 0.35,
    personalFactorsWeight: 0.25,
  }),
  'AGRICULTURE & ENVIRONMENTAL CLUSTER': Object.freeze({
    skillsWeight: 0.30,
    interestsWeight: 0.30,
    personalityWeight: 0.25,
    personalFactorsWeight: 0.15,
  }),
  'SCIENCE & MATHEMATICS CLUSTER': Object.freeze({
    skillsWeight: 0.75,
    interestsWeight: 0.15,
    personalityWeight: 0.05,
    personalFactorsWeight: 0.05,
  }),
  'SPORTS & PHYSICAL EDUCATION CLUSTER': Object.freeze({
    skillsWeight: 0.20,
    interestsWeight: 0.30,
    personalityWeight: 0.30,
    personalFactorsWeight: 0.20,
  }),
  'ENGINEERING / STEM CLUSTER': Object.freeze({
    skillsWeight: 0.55,
    interestsWeight: 0.30,
    personalityWeight: 0.10,
    personalFactorsWeight: 0.05,
  }),
})

export const SKILL_DOMAINS = Object.freeze([
  'Verbal',
  'Numerical',
  'Abstract/Logical',
  'Spatial',
  'Scientific Reasoning',
  'Practical/Applied',
])

export const CLUSTER_SKILL_DOMAINS = Object.freeze({
  'HEALTHCARE SCIENCE CLUSTER': Object.freeze([
    'Verbal',
    'Abstract/Logical',
    'Scientific Reasoning',
    'Numerical',
  ]),
  'HUMANITIES & SOCIAL SCIENCE CLUSTER': Object.freeze([
    'Verbal',
    'Abstract/Logical',
  ]),
  'BUSINESS CLUSTER': Object.freeze([
    'Numerical',
    'Verbal',
    'Abstract/Logical',
  ]),
  'HOSPITALITY & TOURISM CLUSTER': Object.freeze([
    'Verbal',
    'Practical/Applied',
  ]),
  'AVIATION & MARITIME CLUSTER': Object.freeze([
    'Spatial',
    'Practical/Applied',
  ]),
  'LEGAL & PUBLIC SERVICE CLUSTER': Object.freeze([
    'Verbal',
    'Abstract/Logical',
  ]),
  'EDUCATION CLUSTER': Object.freeze([
    'Verbal',
    'Abstract/Logical',
  ]),
  'ARTS & MULTIMEDIA CLUSTER': Object.freeze([
    'Spatial',
    'Abstract/Logical',
    'Verbal',
  ]),
  'CRIMINOLOGY CLUSTER': Object.freeze([
    'Practical/Applied',
    'Abstract/Logical',
  ]),
  'AGRICULTURE & ENVIRONMENTAL CLUSTER': Object.freeze([
    'Scientific Reasoning',
    'Abstract/Logical',
  ]),
  'SCIENCE & MATHEMATICS CLUSTER': Object.freeze([
    'Numerical',
    'Abstract/Logical',
  ]),
  'SPORTS & PHYSICAL EDUCATION CLUSTER': Object.freeze([
    'Verbal',
    'Practical/Applied',
  ]),
  'ENGINEERING / STEM CLUSTER': Object.freeze([
    'Abstract/Logical',
    'Numerical',
    'Spatial',
  ]),
})

export const RIASEC_DIMENSIONS = Object.freeze(['R', 'I', 'A', 'S', 'E', 'C'])

export const MBTI_TO_RIASEC = Object.freeze({
  ISTJ: Object.freeze(['R', 'C']),
  ISFJ: Object.freeze(['S', 'C']),
  INFJ: Object.freeze(['S', 'A']),
  INTJ: Object.freeze(['I', 'C']),
  ISTP: Object.freeze(['R', 'I']),
  ISFP: Object.freeze(['S', 'A']),
  INFP: Object.freeze(['A', 'S']),
  INTP: Object.freeze(['I', 'A']),
  ESTP: Object.freeze(['E', 'R']),
  ESFP: Object.freeze(['E', 'S']),
  ENFP: Object.freeze(['A', 'S']),
  ENTP: Object.freeze(['A', 'I']),
  ESTJ: Object.freeze(['C', 'E']),
  ESFJ: Object.freeze(['E', 'S']),
  ENFJ: Object.freeze(['S', 'A']),
  ENTJ: Object.freeze(['E', 'C']),
})

export const CLUSTER_RIASEC_CODES = Object.freeze({
  'HEALTHCARE SCIENCE CLUSTER': Object.freeze(['S', 'I']),
  'HUMANITIES & SOCIAL SCIENCE CLUSTER': Object.freeze(['I', 'S']),
  'BUSINESS CLUSTER': Object.freeze(['C', 'E']),
  'HOSPITALITY & TOURISM CLUSTER': Object.freeze(['E', 'C']),
  'AVIATION & MARITIME CLUSTER': Object.freeze(['R', 'I']),
  'LEGAL & PUBLIC SERVICE CLUSTER': Object.freeze(['C', 'E']),
  'EDUCATION CLUSTER': Object.freeze(['S', 'A']),
  'ARTS & MULTIMEDIA CLUSTER': Object.freeze(['A', 'E']),
  'CRIMINOLOGY CLUSTER': Object.freeze(['I', 'E']),
  'AGRICULTURE & ENVIRONMENTAL CLUSTER': Object.freeze(['I', 'R']),
  'SCIENCE & MATHEMATICS CLUSTER': Object.freeze(['I', 'C']),
  'SPORTS & PHYSICAL EDUCATION CLUSTER': Object.freeze(['S', 'E']),
  'ENGINEERING / STEM CLUSTER': Object.freeze(['R', 'I']),
})

export const SCORED_PERSONAL_FACTORS = Object.freeze([
  'physical',
  'health',
  'financial',
  'family',
  'work',
])

// Documentary relevance only: 1 means a sufficiently common cluster-level
// characteristic makes the factor contextually applicable. It is never an
// eligibility rule and must not be used to hard-filter a course.
export const PERSONAL_FACTOR_RELEVANCE = Object.freeze({
  'HEALTHCARE SCIENCE CLUSTER': Object.freeze({ physical: 1, health: 1, financial: 1, family: 1, work: 1 }),
  'HUMANITIES & SOCIAL SCIENCE CLUSTER': Object.freeze({ physical: 0, health: 0, financial: 0, family: 1, work: 1 }),
  'BUSINESS CLUSTER': Object.freeze({ physical: 0, health: 0, financial: 0, family: 1, work: 1 }),
  'HOSPITALITY & TOURISM CLUSTER': Object.freeze({ physical: 1, health: 0, financial: 0, family: 1, work: 1 }),
  'AVIATION & MARITIME CLUSTER': Object.freeze({ physical: 1, health: 1, financial: 0, family: 1, work: 1 }),
  'LEGAL & PUBLIC SERVICE CLUSTER': Object.freeze({ physical: 0, health: 0, financial: 0, family: 1, work: 1 }),
  'EDUCATION CLUSTER': Object.freeze({ physical: 0, health: 0, financial: 0, family: 1, work: 1 }),
  'ARTS & MULTIMEDIA CLUSTER': Object.freeze({ physical: 1, health: 0, financial: 0, family: 1, work: 1 }),
  'CRIMINOLOGY CLUSTER': Object.freeze({ physical: 1, health: 1, financial: 1, family: 1, work: 1 }),
  'AGRICULTURE & ENVIRONMENTAL CLUSTER': Object.freeze({ physical: 1, health: 0, financial: 0, family: 1, work: 1 }),
  'SCIENCE & MATHEMATICS CLUSTER': Object.freeze({ physical: 0, health: 0, financial: 0, family: 0, work: 0 }),
  'SPORTS & PHYSICAL EDUCATION CLUSTER': Object.freeze({ physical: 1, health: 1, financial: 0, family: 1, work: 1 }),
  'ENGINEERING / STEM CLUSTER': Object.freeze({ physical: 1, health: 0, financial: 0, family: 1, work: 1 }),
})

const WEIGHT_SUM_TOLERANCE = 1e-12

export function validateRecommendationConfig() {
  for (const cluster of PARENT_CLUSTERS) {
    const weights = CLUSTER_WSM_WEIGHTS[cluster]

    if (!weights) {
      throw new Error(`Missing WSM weights for cluster: ${cluster}`)
    }

    const sum = Object.values(weights).reduce((total, weight) => total + weight, 0)
    if (Math.abs(sum - 1) > WEIGHT_SUM_TOLERANCE) {
      throw new Error(`WSM weights for ${cluster} sum to ${sum}, not 1`)
    }

    if (!CLUSTER_RIASEC_CODES[cluster]) {
      throw new Error(`Missing RIASEC codes for cluster: ${cluster}`)
    }

    const clusterSkillDomains = CLUSTER_SKILL_DOMAINS[cluster]
    if (!clusterSkillDomains || clusterSkillDomains.length === 0) {
      throw new Error(`Missing skill domains for cluster: ${cluster}`)
    }
    if (clusterSkillDomains.some((domain) => !SKILL_DOMAINS.includes(domain))) {
      throw new Error(`Invalid skill domain configured for cluster: ${cluster}`)
    }

    const relevance = PERSONAL_FACTOR_RELEVANCE[cluster]
    if (!relevance) throw new Error(`Missing Personal Factor relevance for cluster: ${cluster}`)
    for (const factor of SCORED_PERSONAL_FACTORS) {
      if (![0, 1].includes(relevance[factor])) {
        throw new Error(`Invalid ${factor} relevance for cluster: ${cluster}`)
      }
    }
  }

  return true
}

validateRecommendationConfig()
