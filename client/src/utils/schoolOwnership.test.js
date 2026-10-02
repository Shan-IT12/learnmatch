import test from 'node:test'
import assert from 'node:assert/strict'
import { getSchoolOwnershipLabel } from './schoolOwnership.js'

test('verified SUC and LUC institution types display as Public', () => {
  assert.equal(getSchoolOwnershipLabel('SUC'), 'Public')
  assert.equal(getSchoolOwnershipLabel('LUC'), 'Public')
})

test('verified Private institution type displays as Private', () => {
  assert.equal(getSchoolOwnershipLabel('Private'), 'Private')
})

test('missing or unknown classifications do not invent an ownership label', () => {
  assert.equal(getSchoolOwnershipLabel(null), null)
  assert.equal(getSchoolOwnershipLabel('Unknown'), null)
})
