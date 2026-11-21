import { useCallback, useEffect, useRef, useState } from 'react'
import {
  CALIBRATION_FRAMES,
  DETECTION_INTERVAL_MS,
  EVENT_TYPES,
  createEventTracker,
  createPoseBaseline,
  evaluateFrame,
  headPoseFromLandmarks,
  headPoseFromMatrix,
} from '../utils/monitoringDetection.js'
import { loadDetectors } from '../utils/monitoringModels.js'
import { markCameraEnabled, reportMonitoringEvent } from '../utils/assessmentMonitoringApi.js'
import { getAssessmentAttemptId } from '../utils/assessmentSession.js'

// Status values: idle | starting | active | denied | unavailable | error | ended
const CAMERA_CONSTRAINTS = { audio: false, video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } } }
const PHONE_HOLD_MS = 900

function cameraFailureStatus(error) {
  if (error?.name === 'NotAllowedError' || error?.name === 'SecurityError') return 'denied'
  if (error?.name === 'NotFoundError' || error?.name === 'DevicesNotFoundError' || error?.name === 'OverconstrainedError') return 'unavailable'
  return 'error'
}

function waitForVideoFrames(video, timeoutMs = 2500) {
  if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) return Promise.resolve()
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer)
      video.removeEventListener('loadeddata', done)
      video.removeEventListener('playing', done)
      resolve()
    }
    const timer = setTimeout(done, timeoutMs)
    video.addEventListener('loadeddata', done, { once: true })
    video.addEventListener('playing', done, { once: true })
  })
}

// Client-side only: frames are analysed in the browser and discarded. Nothing is recorded or
// uploaded; only event type, step and attempt id are sent to the API.
export function useAssessmentMonitoring({
  apiUrl = '',
  token,
  attemptId,
  assessmentStep,
  enabled = true,
  autoStart = false,
  onEvent,
  onFrameState,
}) {
  const videoRef = useRef(null)
  const [status, setStatus] = useState('idle')
  const [activeCondition, setActiveCondition] = useState(null)
  const latest = useRef({ apiUrl, token, attemptId, assessmentStep, onEvent, onFrameState })
  const pendingEvents = useRef([])
  const runtime = useRef({
    run: 0,
    stream: null,
    startingPromise: null,
    detectors: null,
    timer: null,
    tracker: createEventTracker(),
    faceTs: 0,
    phoneTs: 0,
    status: 'idle',
    activeCondition: null,
  })

  const updateStatus = useCallback((nextStatus) => {
    runtime.current.status = nextStatus
    setStatus(prev => (prev === nextStatus ? prev : nextStatus))
  }, [])

  const updateActiveCondition = useCallback((nextCondition) => {
    runtime.current.activeCondition = nextCondition
    setActiveCondition(prev => (prev === nextCondition ? prev : nextCondition))
  }, [])

  useEffect(() => { latest.current = { apiUrl, token, attemptId, assessmentStep, onEvent, onFrameState } })

  // Always fires the UI event callback immediately, even if attemptId is not yet known or the API call fails.
  const report = useCallback((eventType, { logToApi = true } = {}) => {
    const { apiUrl: url, token: auth, attemptId: propAttemptId, assessmentStep: step, onEvent: notify } = latest.current
    notify?.(eventType)
    if (!logToApi) return
    const resolvedAttemptId = propAttemptId || (typeof sessionStorage !== 'undefined' ? getAssessmentAttemptId(sessionStorage) : null)
    if (resolvedAttemptId) {
      reportMonitoringEvent({ apiUrl: url, token: auth, attemptId: resolvedAttemptId, eventType, assessmentStep: step })
    } else if (pendingEvents.current.length < 20) {
      pendingEvents.current.push({ eventType, assessmentStep: step })
    }
  }, [])

  // Flush any events detected before attemptId was created/recovered.
  useEffect(() => {
    if (!attemptId || !token || !pendingEvents.current.length) return
    const queued = pendingEvents.current.splice(0, pendingEvents.current.length)
    for (const item of queued) {
      reportMonitoringEvent({ apiUrl, token, attemptId, eventType: item.eventType, assessmentStep: item.assessmentStep })
    }
  }, [apiUrl, attemptId, token])

  // Releases the camera hardware and models. Safe to call repeatedly.
  const teardown = useCallback(() => {
    const state = runtime.current
    state.run += 1 // invalidates any start() still awaiting permission or models
    state.startingPromise = null
    clearInterval(state.timer)
    state.timer = null
    state.tracker.clearConditions()
    state.stream?.getTracks().forEach(track => track.stop())
    state.stream = null
    if (videoRef.current) videoRef.current.srcObject = null
    try { state.detectors?.close() } catch { /* already closed */ }
    state.detectors = null
  }, [])

  const stop = useCallback(() => {
    teardown()
  }, [teardown])

  const turnOff = useCallback(() => {
    const state = runtime.current
    const wasOn = Boolean(state.stream) || state.status === 'ended' || state.activeCondition === 'camera_disconnected'
    teardown()
    updateStatus('idle')
    updateActiveCondition(null)
    const { apiUrl: url, token: auth, attemptId: propAttemptId } = latest.current
    const resolvedAttemptId = propAttemptId || (typeof sessionStorage !== 'undefined' ? getAssessmentAttemptId(sessionStorage) : null)
    if (resolvedAttemptId) {
      markCameraEnabled({ apiUrl: url, token: auth, attemptId: resolvedAttemptId, enabled: false })
    }
    if (wasOn) {
      const logToApi = state.tracker.instant(EVENT_TYPES.CAMERA_OFF, Date.now())
      report(EVENT_TYPES.CAMERA_OFF, { logToApi })
    }
  }, [report, teardown, updateActiveCondition, updateStatus])

  const start = useCallback(async () => {
    const state = runtime.current
    if (state.stream && state.stream.getVideoTracks().some(track => track.readyState === 'live')) {
      if (videoRef.current && videoRef.current.srcObject !== state.stream) {
        videoRef.current.srcObject = state.stream
        videoRef.current.play().catch(() => {})
      }
      updateStatus('active')
      return true
    }
    if (state.startingPromise) return state.startingPromise

    const wasDisconnected = state.activeCondition === 'camera_disconnected'
    teardown()
    const run = state.run
    updateStatus('starting')
    if (!wasDisconnected) updateActiveCondition(null)

    const promise = (async () => {
      let stream
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error('No camera API'), { name: 'NotFoundError' })
        stream = await navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS)
      } catch (error) {
        if (state.run === run) {
          updateStatus(cameraFailureStatus(error))
          if (wasDisconnected) updateActiveCondition('camera_disconnected')
        }
        return false
      }
      const abandoned = () => state.run !== run
      if (abandoned()) { stream.getTracks().forEach(track => track.stop()); return false }
      state.stream = stream
      try {
        const video = videoRef.current
        if (!video) throw new Error('No video element')
        video.srcObject = stream
        video.muted = true
        await video.play()
        await waitForVideoFrames(video)
        const detectors = await loadDetectors()
        if (abandoned()) { detectors.close(); return false }
        state.detectors = detectors
      } catch (error) {
        console.warn('Assessment camera initialization failed:', error?.message || error)
        if (!abandoned()) {
          teardown()
          updateStatus('error')
          if (wasDisconnected) updateActiveCondition('camera_disconnected')
        }
        return false
      }

      // The camera can end unexpectedly (unplugged, permission revoked, or hardware glitch).
      // Hold the attempt on a blurred Camera Disconnected prompt so the student can reconnect or downgrade.
      stream.getVideoTracks().forEach(track => track.addEventListener('ended', () => {
        if (abandoned()) return
        teardown()
        updateStatus('ended')
        updateActiveCondition('camera_disconnected')
      }, { once: true }))

      const matrixBaseline = createPoseBaseline(CALIBRATION_FRAMES)
      let phoneLastSeenAt = -Infinity
      let warnedFaceErr = false
      let warnedPhoneErr = false

      state.timer = setInterval(() => {
        const video = videoRef.current
        if (abandoned() || !video) return
        if (state.stream && video.srcObject !== state.stream) {
          video.srcObject = state.stream
        }
        if (video.paused && !video.ended) video.play().catch(() => {})
        if (video.readyState < 2 || video.videoWidth <= 0 || video.videoHeight <= 0) return
        if (document.hidden) {
          state.tracker.clearConditions()
          updateActiveCondition(null)
          return
        }

        const now = performance.now()
        let faceCount = 1
        let pose = null
        let landmarkPose = null

        try {
          state.faceTs = Math.max(state.faceTs + 1, Math.floor(now))
          const faceResult = state.detectors.detectFaces(video, state.faceTs)
          faceCount = faceResult.faceCount
          if (faceCount === 1) {
            landmarkPose = headPoseFromLandmarks(faceResult.landmarks)
            if (!landmarkPose) {
              pose = headPoseFromMatrix(faceResult.matrix)
              if (!matrixBaseline.ready && pose) matrixBaseline.add(pose)
            }
          }
        } catch (error) {
          if (!warnedFaceErr) {
            warnedFaceErr = true
            console.warn('Face detection frame skipped:', error?.message || error)
          }
        }

        try {
          state.phoneTs = Math.max(state.phoneTs + 1, Math.floor(now))
          if (state.detectors.detectPhone(video, state.phoneTs)) {
            phoneLastSeenAt = now
          }
        } catch (error) {
          if (!warnedPhoneErr) {
            warnedPhoneErr = true
            console.warn('Object detection frame skipped:', error?.message || error)
          }
        }

        const phoneVisible = now - phoneLastSeenAt <= PHONE_HOLD_MS
        const active = evaluateFrame({
          faceCount,
          pose,
          baseline: matrixBaseline.value,
          landmarkPose,
          phoneVisible,
        })
        latest.current.onFrameState?.(active)
        const reports = state.tracker.update(active, now)
        const nextCondition = state.tracker.currentCondition(active, now)
        updateActiveCondition(nextCondition)
        reports.forEach(eventType => report(eventType))
      }, DETECTION_INTERVAL_MS)

      updateStatus('active')
      updateActiveCondition(null)
      markCameraEnabled(latest.current)
      return true
    })().finally(() => {
      if (state.startingPromise === promise) {
        state.startingPromise = null
      }
    })

    state.startingPromise = promise
    return promise
  }, [report, teardown, updateActiveCondition, updateStatus])

  // Tab switching or window blur is detected whenever monitoring is enabled, even without a camera or attemptId.
  useEffect(() => {
    if (!enabled) return undefined
    let lastUiToastAt = 0
    const triggerTabSwitch = () => {
      const now = Date.now()
      if (now - lastUiToastAt < 1200) return // deduplicate simultaneous blur + visibilitychange
      lastUiToastAt = now
      const logToApi = runtime.current.tracker.instant(EVENT_TYPES.TAB_SWITCH, now)
      report(EVENT_TYPES.TAB_SWITCH, { logToApi })
    }
    const onVisibility = () => {
      if (document.hidden) triggerTabSwitch()
    }
    const onBlur = () => {
      // Switching to another application or browser window blurs the window.
      if (document.hidden || !document.hasFocus()) triggerTabSwitch()
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('blur', onBlur)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('blur', onBlur)
    }
  }, [enabled, report])

  // Start/resume the camera when entering or returning to the assessment in Verified mode,
  // and only stop the camera when autoStart turns false (leaving the assessment or switching to Standard).
  useEffect(() => {
    if (!autoStart) {
      teardown()
      return undefined
    }
    let cancelled = false
    Promise.resolve().then(() => {
      if (!cancelled) start()
    })
    return () => {
      cancelled = true
    }
  }, [autoStart, start, teardown])

  // Ensure the backend attempt is marked camera_enabled whenever camera is active and attemptId is known.
  useEffect(() => {
    if (status === 'active' && attemptId) {
      markCameraEnabled({ apiUrl, token, attemptId })
    }
  }, [apiUrl, attemptId, status, token])

  // Unmount: always release the webcam.
  useEffect(() => teardown, [teardown])

  return { videoRef, status, activeCondition, start, turnOff, stop }
}
