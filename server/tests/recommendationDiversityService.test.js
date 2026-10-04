import test from 'node:test'
import assert from 'node:assert/strict'

import {
  DIVERSITY_SCORE_GAP_LIMIT,
  courseProgramFamily,
  selectDiversifiedTopThree,
} from '../services/recommendationDiversityService.js'

const course = (course_id, course_name, finalScore, rankPosition = course_id) => ({
  course_id,
  course_code: `CRS${String(course_id).padStart(3, '0')}`,
  course_name,
  finalScore,
  rankPosition,
})

test('three near-duplicate variants at the top yield close distinct alternatives', () => {
  const raw = [
    course(1, 'Bachelor of Science in Civil Engineering', 0.90, 1),
    course(2, 'Bachelor of Science in Civil Engineering major in Structural Engineering', 0.895, 2),
    course(3, 'Bachelor of Science in Civil Engineering major in Transportation Engineering', 0.89, 3),
    course(4, 'Bachelor of Science in Architecture', 0.885, 4),
    course(5, 'Bachelor of Science in Environmental Engineering', 0.88, 5),
  ]

  assert.deepEqual(
    selectDiversifiedTopThree(raw).map(({ course_id }) => course_id),
    [1, 4, 5]
  )
})

test('a distinct alternative replaces a same-family candidate only when closely competitive', () => {
  const raw = [
    course(1, 'Bachelor of Science in Criminology', 0.80, 1),
    course(2, 'Bachelor of Arts major in Criminology', 0.795, 2),
    course(3, 'Bachelor of Public Administration', 0.78, 3),
    course(4, 'Bachelor of Legal Management', 0.77, 4),
  ]

  assert.equal(DIVERSITY_SCORE_GAP_LIMIT, 0.02)
  assert.deepEqual(selectDiversifiedTopThree(raw).map(({ course_id }) => course_id), [1, 3, 4])
})

test('a large score gap never replaces a stronger same-family course', () => {
  const raw = [
    course(1, 'Bachelor of Science in Criminology', 0.90, 1),
    course(2, 'Bachelor of Arts major in Criminology', 0.89, 2),
    course(3, 'Bachelor of Public Administration', 0.84, 3),
  ]

  assert.deepEqual(selectDiversifiedTopThree(raw).map(({ course_id }) => course_id), [1, 2, 3])
})

test('a naturally diverse Top 3 remains unchanged even within one broad cluster', () => {
  const raw = [
    course(1, 'Bachelor of Science in Information Technology', 0.90, 1),
    course(2, 'Bachelor of Science in Computer Science', 0.89, 2),
    course(3, 'Bachelor of Science in Data Science', 0.88, 3),
    course(4, 'Bachelor of Science in Mathematics', 0.87, 4),
  ]

  assert.deepEqual(selectDiversifiedTopThree(raw).map(({ course_id }) => course_id), [1, 2, 3])
})

test('diversification is deterministic and never mutates the raw ranking or scores', () => {
  const raw = [
    course(1, 'Bachelor of Secondary Education major in English', 0.82, 1),
    course(2, 'Bachelor in Secondary Education major in Science', 0.815, 2),
    course(3, 'Bachelor of Elementary Education', 0.81, 3),
    course(4, 'Bachelor of Physical Education', 0.805, 4),
  ]
  const before = structuredClone(raw)
  const first = selectDiversifiedTopThree(raw)

  for (let run = 0; run < 10; run += 1) {
    assert.deepEqual(selectDiversifiedTopThree(raw), first)
  }
  assert.deepEqual(raw, before)
  assert.deepEqual(first.map(({ finalScore }) => finalScore), [0.82, 0.81, 0.805])
  assert.equal(courseProgramFamily(raw[0]), courseProgramFamily(raw[1]))
})
