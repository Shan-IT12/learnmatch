import test from 'node:test'
import assert from 'node:assert/strict'
import {
  EVENT_TYPES, GRACE_MS, COOLDOWN_MS,
  createEventTracker, createPoseBaseline, evaluateFrame, headPoseFromLandmarks, headPoseFromMatrix, isLookingAway,
} from '../src/utils/monitoringDetection.js'
import { MONITORING_WARNING_MESSAGES, summarizeFocusLevel } from '../src/utils/assessmentMonitoringApi.js'

// Column-major 4x4 rotation about Y (yaw) then X (pitch), as MediaPipe lays out its matrix.
function matrix(yawDeg, pitchDeg) {
  const y = yawDeg * Math.PI / 180, p = pitchDeg * Math.PI / 180
  const [cy, sy, cp, sp] = [Math.cos(y), Math.sin(y), Math.cos(p), Math.sin(p)]
  // R = Ry * Rx
  const r = [[cy, sy * sp, sy * cp], [0, cp, -sp], [-sy, cy * sp, cy * cp]]
  return [r[0][0], r[1][0], r[2][0], 0, r[0][1], r[1][1], r[2][1], 0, r[0][2], r[1][2], r[2][2], 0, 0, 0, 0, 1]
}

test('head pose is recovered from the transform matrix, ignoring scale', () => {
  const pose = headPoseFromMatrix(matrix(30, -15).map((v, i) => (i % 4 === 3 || i > 11 ? v : v * 1.7)))
  assert.ok(Math.abs(pose.yaw - 30) < 0.01)
  assert.ok(Math.abs(pose.pitch + 15) < 0.01)
  assert.equal(headPoseFromMatrix(null), null)
  assert.equal(headPoseFromMatrix(new Array(16).fill(0)), null)
})

test('looking away is measured against the calibrated baseline', () => {
  const baseline = createPoseBaseline(2)
  assert.equal(baseline.ready, false)
  baseline.add({ yaw: 4, pitch: 170 }); baseline.add({ yaw: 6, pitch: -170 }) // pitch wraps around 180
  assert.equal(baseline.ready, true)
  assert.ok(Math.abs(baseline.value.yaw - 5) < 1e-9)
  assert.equal(isLookingAway({ yaw: 10, pitch: 175 }, baseline.value), false)
  assert.equal(isLookingAway({ yaw: 40, pitch: 180 }, baseline.value), true) // turned right
  assert.equal(isLookingAway({ yaw: -30, pitch: 180 }, baseline.value), true) // turned left
  assert.equal(isLookingAway({ yaw: 5, pitch: 150 }, baseline.value), true) // head tilted down/up
  assert.equal(isLookingAway({ yaw: 90, pitch: 0 }, null), false) // no baseline yet
})

test('frame evaluation maps faces and phone to event conditions', () => {
  const baseline = { yaw: 0, pitch: 0 }
  assert.equal(evaluateFrame({ faceCount: 0, baseline })[EVENT_TYPES.NO_FACE], true)
  assert.equal(evaluateFrame({ faceCount: 2, baseline })[EVENT_TYPES.MULTIPLE_FACES], true)
  const away = evaluateFrame({ faceCount: 1, pose: { yaw: 50, pitch: 0 }, baseline, phoneVisible: true })
  assert.equal(away[EVENT_TYPES.LOOKING_AWAY], true)
  assert.equal(away[EVENT_TYPES.CELLPHONE], true)
  assert.equal(evaluateFrame({ faceCount: 0, pose: { yaw: 50, pitch: 0 }, baseline })[EVENT_TYPES.LOOKING_AWAY], false)
  const pts = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5, z: 0 }))
  pts[234] = { x: 0.3, y: 0.5 }; pts[454] = { x: 0.7, y: 0.5 }
  pts[33] = { x: 0.4, y: 0.4 }; pts[263] = { x: 0.6, y: 0.4 }
  pts[10] = { x: 0.5, y: 0.25 }; pts[152] = { x: 0.5, y: 0.75 }
  pts[1] = { x: 0.5, y: 0.56 }
  const centered = headPoseFromLandmarks(pts)
  pts[1] = { x: 0.64, y: 0.56 } // turned sideways
  const turned = headPoseFromLandmarks(pts)
  assert.equal(isLookingAway(turned, centered), true)
})

test('grace period requires continuous conditions and cooldown limits repeats', () => {
  const tracker = createEventTracker()
  const noFace = { [EVENT_TYPES.NO_FACE]: true }
  const grace = GRACE_MS[EVENT_TYPES.NO_FACE]
  assert.deepEqual(tracker.update(noFace, 0), [])
  assert.deepEqual(tracker.update(noFace, grace - 1), [])
  assert.deepEqual(tracker.update({}, grace), []) // a blink/adjustment resets the timer
  assert.deepEqual(tracker.update(noFace, grace + 1), [])
  assert.deepEqual(tracker.update(noFace, grace * 2 + 1), [EVENT_TYPES.NO_FACE])
  assert.equal(tracker.currentCondition(noFace, grace * 2 + 1), EVENT_TYPES.NO_FACE)
  assert.deepEqual(tracker.update(noFace, grace * 2 + 1 + COOLDOWN_MS - 1), [])
  assert.equal(tracker.currentCondition(noFace, grace * 2 + 1 + COOLDOWN_MS - 1), EVENT_TYPES.NO_FACE)
  assert.deepEqual(tracker.update(noFace, grace * 2 + 1 + COOLDOWN_MS), [EVENT_TYPES.NO_FACE])
  assert.deepEqual(tracker.update({}, grace * 2 + 2 + COOLDOWN_MS), [])
  assert.equal(tracker.currentCondition({}, grace * 2 + 2 + COOLDOWN_MS), null)
})

test('instant events share the cooldown and clearing conditions resets grace timers', () => {
  const tracker = createEventTracker()
  assert.equal(tracker.instant(EVENT_TYPES.TAB_SWITCH, 1000), true)
  assert.equal(tracker.instant(EVENT_TYPES.TAB_SWITCH, 1000 + COOLDOWN_MS - 1), false)
  assert.equal(tracker.instant(EVENT_TYPES.TAB_SWITCH, 1000 + COOLDOWN_MS), true)
  assert.equal(tracker.instant(EVENT_TYPES.CAMERA_OFF, 1000), true) // separate type
  const looking = { [EVENT_TYPES.LOOKING_AWAY]: true }
  tracker.update(looking, 0)
  tracker.clearConditions()
  assert.deepEqual(tracker.update(looking, GRACE_MS[EVENT_TYPES.LOOKING_AWAY]), [])
})

test('focus summary maps camera state and event counts to Verified or Standard badge and level', () => {
  assert.equal(summarizeFocusLevel(null).badge, 'Standard Assessment')
  assert.equal(summarizeFocusLevel({ cameraEnabled: false, totalEvents: 2 }).verified, false)
  assert.deepEqual(
    [summarizeFocusLevel({ cameraEnabled: true, totalEvents: 0 }).badge, summarizeFocusLevel({ cameraEnabled: true, totalEvents: 0 }).level],
    ['Verified Assessment', 'Excellent Focus']
  )
  assert.equal(summarizeFocusLevel({ cameraEnabled: true, totalEvents: 2 }).level, 'Strong Focus')
  assert.equal(summarizeFocusLevel({ cameraEnabled: true, totalEvents: 4 }).level, 'Moderate Focus')
  assert.equal(summarizeFocusLevel({ cameraEnabled: true, totalEvents: 8 }).level, 'Frequent Interruptions')
  for (const type of Object.values(EVENT_TYPES)) assert.ok(MONITORING_WARNING_MESSAGES[type], type)
})
