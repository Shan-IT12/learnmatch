// Pure detection rules for assessment monitoring. No browser APIs, so they are unit-testable.

export const EVENT_TYPES = Object.freeze({
  LOOKING_AWAY: 'looking_away',
  CELLPHONE: 'cellphone_detected',
  NO_FACE: 'no_face',
  MULTIPLE_FACES: 'multiple_faces',
  TAB_SWITCH: 'tab_switch',
  CAMERA_OFF: 'camera_turned_off',
})

export const DETECTION_INTERVAL_MS = 500
export const COOLDOWN_MS = 10000 // minimum gap between backend API logs of the same event type
// Continuous time a condition must hold before it is reported.
export const GRACE_MS = Object.freeze({
  [EVENT_TYPES.NO_FACE]: 4500,
  [EVENT_TYPES.LOOKING_AWAY]: 4500,
  [EVENT_TYPES.MULTIPLE_FACES]: 1500,
  [EVENT_TYPES.CELLPHONE]: 1500,
})
export const YAW_LIMIT_DEG = 28
export const PITCH_LIMIT_DEG = 24
export const CALIBRATION_FRAMES = 3

const toDegrees = radians => (radians * 180) / Math.PI

// MediaPipe returns a column-major 4x4 face transform. Columns are normalised so any
// scale in the matrix is ignored.
export function headPoseFromMatrix(data) {
  if (!data || data.length < 16) return null
  const c0 = Math.hypot(data[0], data[1], data[2])
  const c1 = Math.hypot(data[4], data[5], data[6])
  const c2 = Math.hypot(data[8], data[9], data[10])
  if (!c0 || !c1 || !c2) return null
  const yaw = toDegrees(Math.asin(Math.max(-1, Math.min(1, -data[2] / c0))))
  const pitch = toDegrees(Math.atan2(data[6] / c1, data[10] / c2))
  return { yaw, pitch }
}

// Estimates head yaw and pitch directly from normalized face landmarks (478 points)
// using anatomical symmetry so normal screen reading never triggers a false positive.
export function headPoseFromLandmarks(landmarks) {
  if (!Array.isArray(landmarks) || landmarks.length < 455) return null
  const nose = landmarks[1]
  const leftEye = landmarks[33]
  const rightEye = landmarks[263]
  const leftCheek = landmarks[234]
  const rightCheek = landmarks[454]
  const chin = landmarks[152]
  if (!nose || !leftEye || !rightEye || !leftCheek || !rightCheek || !chin) return null

  const cheekWidth = Math.hypot(rightCheek.x - leftCheek.x, rightCheek.y - leftCheek.y)
  const eyeMidX = (leftEye.x + rightEye.x) / 2
  const eyeMidY = (leftEye.y + rightEye.y) / 2
  const eyeToChin = chin.y - eyeMidY
  if (cheekWidth < 1e-4 || eyeToChin < 1e-4) return null

  const cheekMidX = (leftCheek.x + rightCheek.x) / 2
  const centerMidX = (eyeMidX + cheekMidX) / 2
  const yawRatio = Math.max(-1, Math.min(1, (nose.x - centerMidX) / (cheekWidth * 0.55)))
  const yaw = toDegrees(Math.asin(yawRatio))

  // Ratio of eye-to-nose vs eye-to-chin vertical span (~0.41 when facing a laptop screen).
  const noseVerticalRatio = (nose.y - eyeMidY) / eyeToChin
  const pitch = (noseVerticalRatio - 0.41) * 115
  return { yaw, pitch }
}

const wrap = degrees => ((((degrees + 180) % 360) + 360) % 360) - 180

// Mean of angles that may straddle ±180°.
function circularMean(angles) {
  const radians = angles.map(angle => (angle * Math.PI) / 180)
  const sin = radians.reduce((sum, r) => sum + Math.sin(r), 0)
  const cos = radians.reduce((sum, r) => sum + Math.cos(r), 0)
  return toDegrees(Math.atan2(sin, cos))
}

// Averages the first few frontal frames so the student's own camera angle is the reference.
export function createPoseBaseline(frames = CALIBRATION_FRAMES) {
  const samples = []
  let baseline = null
  return {
    get ready() { return baseline !== null },
    get value() { return baseline },
    add(pose) {
      if (baseline || !pose) return
      samples.push(pose)
      if (samples.length >= frames) {
        baseline = {
          yaw: samples.reduce((sum, s) => sum + s.yaw, 0) / samples.length,
          pitch: circularMean(samples.map(s => s.pitch)),
        }
      }
    },
  }
}

// Left/right turns and looking down (or up) relative to the baseline.
export function isLookingAway(pose, baseline) {
  if (!pose || !baseline) return false
  return Math.abs(wrap(pose.yaw - baseline.yaw)) > YAW_LIMIT_DEG ||
    Math.abs(wrap(pose.pitch - baseline.pitch)) > PITCH_LIMIT_DEG
}

const NEUTRAL_POSE = Object.freeze({ yaw: 0, pitch: 0 })

export function evaluateFrame({ faceCount, pose, baseline, landmarkPose, landmarkBaseline, phoneVisible }) {
  const away = landmarkPose
    ? isLookingAway(landmarkPose, landmarkBaseline || NEUTRAL_POSE)
    : isLookingAway(pose, baseline)
  return {
    [EVENT_TYPES.NO_FACE]: faceCount === 0,
    [EVENT_TYPES.MULTIPLE_FACES]: faceCount > 1,
    [EVENT_TYPES.LOOKING_AWAY]: faceCount === 1 && away,
    [EVENT_TYPES.CELLPHONE]: Boolean(phoneVisible),
  }
}

const CONDITION_PRIORITY = [
  EVENT_TYPES.CELLPHONE,
  EVENT_TYPES.MULTIPLE_FACES,
  EVENT_TYPES.NO_FACE,
  EVENT_TYPES.LOOKING_AWAY,
]

// Applies grace periods (continuous duration) and per-type cooldowns.
export function createEventTracker({ grace = GRACE_MS, cooldown = COOLDOWN_MS } = {}) {
  const since = new Map()
  const lastReported = new Map()
  const cooledDown = (type, now) => !lastReported.has(type) || now - lastReported.get(type) >= cooldown
  return {
    // `active` maps a detected event type to whether it is true right now; returns types to report.
    update(active, now) {
      // If a severe head turn causes the face mesh to drop out mid-turn (or vice versa),
      // carry the elapsed start timestamp across so the two states do not cancel each other out.
      if (active[EVENT_TYPES.NO_FACE] && !since.has(EVENT_TYPES.NO_FACE) && since.has(EVENT_TYPES.LOOKING_AWAY)) {
        since.set(EVENT_TYPES.NO_FACE, since.get(EVENT_TYPES.LOOKING_AWAY))
      } else if (active[EVENT_TYPES.LOOKING_AWAY] && !since.has(EVENT_TYPES.LOOKING_AWAY) && since.has(EVENT_TYPES.NO_FACE)) {
        since.set(EVENT_TYPES.LOOKING_AWAY, since.get(EVENT_TYPES.NO_FACE))
      }

      const reports = []
      for (const type of Object.keys(grace)) {
        if (!active[type]) { since.delete(type); continue }
        if (!since.has(type)) since.set(type, now)
        if (now - since.get(type) >= grace[type] && cooledDown(type, now)) {
          lastReported.set(type, now)
          reports.push(type)
        }
      }
      return reports
    },
    // Returns the highest-priority camera condition that has exceeded its grace period, or null once resolved.
    currentCondition(active, now) {
      for (const type of CONDITION_PRIORITY) {
        if (active[type] && since.has(type) && now - since.get(type) >= (grace[type] ?? 0)) {
          return type
        }
      }
      return null
    },
    // For instant events (tab switch, camera off): reports at most once per cooldown.
    instant(type, now) {
      if (!cooledDown(type, now)) return false
      lastReported.set(type, now)
      return true
    },
    clearConditions() { since.clear() },
  }
}
