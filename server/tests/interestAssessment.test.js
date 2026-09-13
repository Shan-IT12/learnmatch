import test from 'node:test'
import assert from 'node:assert/strict'

import interestGroups, {
  MAX_INTEREST_SELECTIONS as CLIENT_MAX,
  MIN_INTEREST_SELECTIONS as CLIENT_MIN,
  updateInterestSelection,
} from '../../client/src/data/interestList.js'
import {
  CURRENT_INTEREST_RIASEC_MAP,
  HISTORICAL_INTEREST_RIASEC_MAP,
  PRIMARY_INTEREST_CONTRIBUTION,
  SECONDARY_INTEREST_CONTRIBUTION,
} from '../config/interestRiasecConfig.js'
import {
  MAX_INTEREST_SELECTIONS,
  MIN_INTEREST_SELECTIONS,
  validateInterestSubmission,
} from '../services/interestSubmissionService.js'
import { buildStudentRiasecVector } from '../services/recommendationService.js'

const currentItems = interestGroups.flatMap((group) => group.items)
const currentNames = currentItems.map((item) => item.name)
const validCodes = new Set(['R', 'I', 'A', 'S', 'E', 'C'])

test('the selectable list has exactly 35 unique canonical interests with valid mappings', () => {
  assert.equal(currentNames.length, 35)
  assert.equal(new Set(currentNames).size, 35)
  assert.deepEqual(new Set(currentNames), new Set(Object.keys(CURRENT_INTEREST_RIASEC_MAP)))

  for (const item of currentItems) {
    assert.ok(validCodes.has(item.primary))
    assert.ok(item.secondary === null || validCodes.has(item.secondary))
    assert.deepEqual(CURRENT_INTEREST_RIASEC_MAP[item.name], {
      primary: item.primary,
      secondary: item.secondary,
    })
  }
})

test('interest scoring contributions remain 1.0 primary and 0.5 secondary', () => {
  assert.equal(PRIMARY_INTEREST_CONTRIBUTION, 1)
  assert.equal(SECONDARY_INTEREST_CONTRIBUTION, 0.5)
})

test('all four deprecated combined interests remain available for historical scoring', () => {
  assert.deepEqual(Object.keys(HISTORICAL_INTEREST_RIASEC_MAP).sort(), [
    'Building / Fixing Gadgets',
    'Dancing / Performing Arts',
    'Music / Singing',
    'Video Editing / Filmmaking',
  ])
  assert.deepEqual(buildStudentRiasecVector(Object.keys(HISTORICAL_INTEREST_RIASEC_MAP)), {
    R: 1,
    I: 1,
    A: 3,
    S: 0.5,
    E: 0,
    C: 0,
  })
})

test('client selection rules block fewer than 3 and allow 3 through 10', () => {
  assert.equal(CLIENT_MIN, 3)
  assert.equal(CLIENT_MAX, 10)
  assert.ok([0, 1, 2].every((count) => count < CLIENT_MIN))
  assert.ok([3, 10].every((count) => count >= CLIENT_MIN && count <= CLIENT_MAX))
})

test('an attempted 11th selection is blocked and a selected interest can be removed', () => {
  const ten = currentNames.slice(0, 10)
  assert.deepEqual(updateInterestSelection(ten, currentNames[10]), {
    selected: ten,
    maxReached: true,
  })
  assert.deepEqual(updateInterestSelection(ten, ten[0]), {
    selected: ten.slice(1),
    maxReached: false,
  })
})

test('server validation enforces canonical unique submissions containing 3 to 10 interests', () => {
  assert.equal(MIN_INTEREST_SELECTIONS, 3)
  assert.equal(MAX_INTEREST_SELECTIONS, 10)
  assert.ok(validateInterestSubmission(currentNames.slice(0, 2)))
  assert.ok(validateInterestSubmission(currentNames.slice(0, 11)))
  assert.ok(validateInterestSubmission([currentNames[0], currentNames[1], currentNames[1]]))
  assert.ok(validateInterestSubmission([currentNames[0], currentNames[1], 'Unknown']))
  assert.ok(validateInterestSubmission([
    currentNames[0], currentNames[1], 'Video Editing / Filmmaking',
  ]))
  assert.equal(validateInterestSubmission(currentNames.slice(0, 3)), null)
  assert.equal(validateInterestSubmission(currentNames.slice(0, 10)), null)
})
