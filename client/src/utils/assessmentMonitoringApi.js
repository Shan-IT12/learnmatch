// Fire-and-forget calls and summary reader for the assessment monitoring API.
// Never throws and never blocks the student; only event metadata is sent.

import { EVENT_TYPES } from './monitoringDetection.js'

export const MONITORING_WARNING_MESSAGES = Object.freeze({
  [EVENT_TYPES.LOOKING_AWAY]: 'Looking away detected. Please face the screen.',
  [EVENT_TYPES.CELLPHONE]: 'Possible external device detected in camera view. Please remove it from the frame to continue.',
  [EVENT_TYPES.NO_FACE]: 'No face detected in camera view. Please stay in frame.',
  [EVENT_TYPES.MULTIPLE_FACES]: 'Multiple faces detected in camera view.',
  [EVENT_TYPES.TAB_SWITCH]: 'Please stay on the assessment tab.',
  [EVENT_TYPES.CAMERA_OFF]: 'Camera turned off. This attempt is now a Standard Assessment.',
})

export const MONITORING_EVENT_LABELS = Object.freeze({
  [EVENT_TYPES.LOOKING_AWAY]: 'Looking away / down',
  [EVENT_TYPES.CELLPHONE]: 'External device in view',
  [EVENT_TYPES.NO_FACE]: 'No face in frame',
  [EVENT_TYPES.MULTIPLE_FACES]: 'Multiple faces in frame',
  [EVENT_TYPES.TAB_SWITCH]: 'Tab or window switch',
  [EVENT_TYPES.CAMERA_OFF]: 'Camera turned off',
})

export function summarizeFocusLevel(summary) {
  const cameraEnabled = Boolean(summary?.cameraEnabled)
  const total = Number(summary?.totalEvents || 0)
  if (!cameraEnabled) {
    return {
      badge: 'Standard Assessment',
      verified: false,
      level: 'Standard Mode',
      headline: 'Completed without camera monitoring',
      description: 'Turn on camera monitoring on your next assessment retake to earn a Verified Assessment Badge and unlock your full Personal Focus Summary.',
    }
  }
  if (total === 0) {
    return {
      badge: 'Verified Assessment',
      verified: true,
      level: 'Excellent Focus',
      headline: 'Zero focus interruptions recorded',
      description: 'You stayed present and focused throughout your assessment session. Great job maintaining a distraction-free environment.',
    }
  }
  if (total <= 2) {
    return {
      badge: 'Verified Assessment',
      verified: true,
      level: 'Strong Focus',
      headline: `${total} minor focus reminder${total === 1 ? '' : 's'} recorded`,
      description: 'You maintained steady concentration across the assessment with only brief interruptions. These reminders never reduce your scores.',
    }
  }
  if (total <= 5) {
    return {
      badge: 'Verified Assessment',
      verified: true,
      level: 'Moderate Focus',
      headline: `${total} focus reminders recorded`,
      description: 'A few distractions came up during your session. Finding a quiet space and keeping one tab open can help you stay focused.',
    }
  }
  return {
    badge: 'Verified Assessment',
    verified: true,
    level: 'Frequent Interruptions',
    headline: `${total} focus reminders recorded`,
    description: 'Several interruptions were logged during this attempt. Your scores and course recommendations are not penalized by focus reminders.',
  }
}

function monitoringUrl(apiUrl, attemptId, path = '') {
  const suffix = path ? `/${path}` : ''
  return `${apiUrl || ''}/api/assessment-attempts/${encodeURIComponent(attemptId)}/monitoring${suffix}`
}

function send(url, token, method, body) {
  if (!token) return Promise.resolve(false)
  return fetch(url, {
    method,
    keepalive: true,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    ...(body ? { body: JSON.stringify(body) } : {}),
  }).then(response => response.ok, () => false)
}

export function reportMonitoringEvent({ apiUrl, token, attemptId, eventType, assessmentStep }) {
  if (!attemptId || !eventType || !assessmentStep) return Promise.resolve(false)
  return send(monitoringUrl(apiUrl, attemptId, 'events'), token, 'POST', {
    event_type: eventType,
    assessment_step: assessmentStep,
  })
}

export function markCameraEnabled({ apiUrl, token, attemptId, enabled = true }) {
  if (!attemptId) return Promise.resolve(false)
  return send(monitoringUrl(apiUrl, attemptId, 'camera'), token, 'PUT', {
    enabled: Boolean(enabled),
  })
}

export async function fetchAttemptMonitoring({ apiUrl = '', token, attemptId = 'latest', signal } = {}) {
  if (!token) return null
  try {
    const response = await fetch(monitoringUrl(apiUrl, attemptId || 'latest'), {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
      signal,
    })
    if (!response.ok) return null
    return await response.json()
  } catch {
    return null
  }
}
