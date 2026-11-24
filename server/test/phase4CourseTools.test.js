import test from 'node:test'
import assert from 'node:assert/strict'
import {
  canonicalizeCourseName,
  detectDuplicateCourses,
  extractCourseAcronym,
} from '../services/courseDuplicateService.js'
import {
  extractCourseFromSource,
  parseCourseFromTextFallback,
} from '../services/courseAutoFillService.js'

test('canonicalizeCourseName and extractCourseAcronym normalize BS/Bachelor equivalents', () => {
  assert.equal(
    canonicalizeCourseName('BS Information Technology'),
    'bachelor of science in information technology'
  )
  assert.equal(
    canonicalizeCourseName('Bachelor of Science in Information Technology (BSIT)'),
    'bachelor of science in information technology'
  )
  assert.equal(extractCourseAcronym('Bachelor of Science in Information Technology'), 'BSIT')
  assert.equal(extractCourseAcronym('BS Information Technology'), 'BSIT')
})

test('detectDuplicateCourses catches exact equivalents across Active, Inactive, and Draft records', () => {
  const existing = [
    {
      course_id: 1,
      course_code: 'CRS001',
      course_name: 'Bachelor of Science in Information Technology',
      course_abbreviation: 'BSIT',
      is_active: 1,
      is_draft: 0,
    },
    {
      course_id: 2,
      course_code: 'CRS002',
      course_name: 'Bachelor of Science in Civil Engineering',
      course_abbreviation: 'BSCE',
      is_active: 0,
      is_draft: 1,
    },
  ]

  const matchByEquivalentName = detectDuplicateCourses(existing, {
    courseName: 'BS Information Technology',
  })
  assert.equal(matchByEquivalentName.hasExactDuplicate, true)
  assert.equal(matchByEquivalentName.exactMatches[0].course_id, 1)
  assert.equal(matchByEquivalentName.exactMatches[0].status, 'Active')

  const matchByAbbr = detectDuplicateCourses(existing, {
    courseName: 'Civil Engineering Program',
    courseAbbreviation: 'bsce',
  })
  assert.equal(matchByAbbr.hasExactDuplicate, true)
  assert.equal(matchByAbbr.exactMatches[0].course_id, 2)
  assert.equal(matchByAbbr.exactMatches[0].status, 'Draft')

  const distinct = detectDuplicateCourses(existing, {
    courseName: 'Bachelor of Science in Marine Biology',
    courseAbbreviation: 'BSMB',
  })
  assert.equal(distinct.hasExactDuplicate, false)
  assert.equal(distinct.hasSimilarMatch, false)
})

test('parseCourseFromTextFallback and extractCourseFromSource extract structured fields and run duplicate check', async () => {
  const sampleText = `
Program Name: Bachelor of Science in Data Science (BSDS)
Description: A 4-year undergraduate degree focused on statistical modeling, machine learning, and data engineering for modern organizations.
Core Competencies: Python programming, statistical analysis, data visualization, SQL databases, machine learning
1st Year: Foundations of programming, calculus, and discrete structures.
2nd Year: Data structures, probability, and database systems.
Career Opportunities:
- Data Analyst - PHP 30,000 - 50,000/mo
- Machine Learning Engineer - Builds predictive models
`
  const parsed = parseCourseFromTextFallback(sampleText)
  assert.equal(parsed.course_name, 'Bachelor of Science in Data Science')
  assert.equal(parsed.course_abbreviation, 'BSDS')
  assert.equal(parsed.cluster_category, 'ENGINEERING / STEM CLUSTER')
  assert.equal(parsed.program_duration_years, 4)
  assert.match(parsed.obtainable_skills, /Python programming/i)
  assert.equal(parsed.career_opportunities.length, 2)
  assert.equal(parsed.career_opportunities[0].job_title, 'Data Analyst')
  assert.match(parsed.career_opportunities[0].salary_range, /PHP 30,000/i)

  const fakeDb = {
    async query() {
      return [[{
        course_id: 99,
        course_code: 'CRS099',
        course_name: 'Bachelor of Science in Data Science',
        course_abbreviation: 'BSDS',
        is_active: 1,
        is_draft: 0,
      }]]
    },
  }

  const result = await extractCourseFromSource(fakeDb, { sourceText: sampleText }, { env: {} })
  assert.equal(result.extractionMethod, 'structured_parser')
  assert.equal(result.duplicateCheck.hasExactDuplicate, true)
  assert.equal(result.duplicateCheck.exactMatches[0].course_id, 99)
})
