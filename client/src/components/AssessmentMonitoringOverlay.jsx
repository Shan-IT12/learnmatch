import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import {
  IconAlertTriangle,
  IconCamera,
  IconCameraOff,
  IconGripHorizontal,
  IconInfoCircle,
  IconShieldCheck,
  IconX,
} from '@tabler/icons-react'
import { useAssessmentMonitoring } from '../hooks/useAssessmentMonitoring'
import { MONITORING_WARNING_MESSAGES } from '../utils/assessmentMonitoringApi'
import {
  ASSESSMENT_SESSION_KEYS,
  MONITORING_CHOICE_KEY,
  getAssessmentAttemptId,
} from '../utils/assessmentSession'
import { EVENT_TYPES } from '../utils/monitoringDetection'
import CameraMonitoringModal from './CameraMonitoringModal'

const STEP_BY_PATH = Object.freeze({
  '/onboarding/profile': 'personal_factors',
  '/onboarding/interests': 'interests',
  '/onboarding/skills': 'academic_skills',
  '/onboarding/personality': 'personality',
})

const VIEWPORT_PADDING = 12
const MIN_PREVIEW_WIDTH = 200
const MAX_PREVIEW_WIDTH = 360
const DEFAULT_PREVIEW_WIDTH = 248

const CONDITION_ALERTS = Object.freeze({
  [EVENT_TYPES.NO_FACE]: {
    title: 'No Face Detected',
    message: 'No face detected. Please return to the camera frame to continue.',
    hint: 'This screen will automatically unblur as soon as your face is back in frame.',
  },
  [EVENT_TYPES.LOOKING_AWAY]: {
    title: 'Looking Away Detected',
    message: 'Looking away detected. Please face the screen to continue.',
    hint: 'This screen will automatically unblur as soon as you face the screen.',
  },
  [EVENT_TYPES.MULTIPLE_FACES]: {
    title: 'Multiple Faces Detected',
    message: 'Multiple faces detected in camera view. Please ensure only you are in the camera frame.',
    hint: 'This screen will automatically unblur once only one face is visible.',
  },
  [EVENT_TYPES.CELLPHONE]: {
    title: 'External Device Detected',
    message: 'Possible external device detected in camera view. Please remove it from the frame to continue.',
    hint: 'This screen will automatically unblur once the external device is out of view.',
  },
  [EVENT_TYPES.TAB_SWITCH]: {
    title: 'Tab Switch Detected',
    message: 'Please stay on the assessment tab while completing your assessment.',
    hint: 'Click Resume Assessment below to continue where you left off.',
  },
  camera_disconnected: {
    title: 'Camera Disconnected',
    message: 'Your camera feed stopped unexpectedly. Reconnect your camera to keep your Verified Assessment status, or switch to a Standard Assessment to continue.',
    hint: 'Make sure your camera is plugged in and allowed in your browser before clicking Reconnect Camera.',
  },
})

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function clampPositionToViewport(x, y, width, height) {
  if (typeof window === 'undefined') return { x, y }
  const maxX = Math.max(VIEWPORT_PADDING, window.innerWidth - width - VIEWPORT_PADDING)
  const maxY = Math.max(VIEWPORT_PADDING, window.innerHeight - height - VIEWPORT_PADDING)
  return {
    x: clamp(Math.round(x), VIEWPORT_PADDING, maxX),
    y: clamp(Math.round(y), VIEWPORT_PADDING, maxY),
  }
}

function readStorageChoice() {
  try {
    return globalThis.sessionStorage?.getItem(MONITORING_CHOICE_KEY) || null
  } catch {
    return null
  }
}

function writeStorageChoice(value) {
  try {
    if (!value) globalThis.sessionStorage?.removeItem(MONITORING_CHOICE_KEY)
    else globalThis.sessionStorage?.setItem(MONITORING_CHOICE_KEY, value)
  } catch { /* Restricted storage must not block the assessment. */ }
}

function cameraErrorMessage(status) {
  if (status === 'denied') {
    return 'Camera permission was blocked by your browser. Allow camera access and try again, or continue without a camera.'
  }
  if (status === 'unavailable') {
    return 'No working camera was found on this device. You can continue without a camera as a Standard Assessment.'
  }
  if (status === 'error') {
    return 'Could not start camera monitoring right now. Please try again or continue without a camera.'
  }
  return ''
}

function describeLiveStatus(frameState) {
  if (!frameState) return { label: 'Monitoring active · Face in frame', alert: false }
  if (frameState[EVENT_TYPES.CELLPHONE]) return { label: 'External device detected in view...', alert: true }
  if (frameState[EVENT_TYPES.MULTIPLE_FACES]) return { label: 'Multiple faces in frame...', alert: true }
  if (frameState[EVENT_TYPES.NO_FACE]) return { label: 'No face detected — please face the camera...', alert: true }
  if (frameState[EVENT_TYPES.LOOKING_AWAY]) return { label: 'Looking away — please face the screen...', alert: true }
  return { label: 'Monitoring active · Face in frame', alert: false }
}

function AssessmentMonitoringOverlay() {
  const location = useLocation()
  const assessmentStep = STEP_BY_PATH[location.pathname] || null
  const inAssessment = Boolean(assessmentStep)
  const apiUrl = import.meta.env.VITE_API_URL || ''
  const token = typeof localStorage === 'undefined' ? null : localStorage.getItem('token')

  const [attemptId, setAttemptId] = useState(() => (
    typeof sessionStorage === 'undefined' ? null : getAssessmentAttemptId(sessionStorage)
  ))
  const [choice, setChoice] = useState(() => readStorageChoice())
  const [showInfoModal, setShowInfoModal] = useState(false)
  const [confirmTurnOffOpen, setConfirmTurnOffOpen] = useState(false)
  const [tabSwitchOpen, setTabSwitchOpen] = useState(false)
  const [cameraOffToast, setCameraOffToast] = useState('')
  const [liveState, setLiveState] = useState(null)
  const [startingCamera, setStartingCamera] = useState(false)
  const [reconnectError, setReconnectError] = useState('')

  // Floating preview drag & resize state (null position = default bottom-right anchor)
  const cardRef = useRef(null)
  const gestureRef = useRef(null)
  const [previewWidth, setPreviewWidth] = useState(DEFAULT_PREVIEW_WIDTH)
  const [previewPos, setPreviewPos] = useState(null)

  const handleFlagEvent = useCallback((eventType) => {
    if (eventType === EVENT_TYPES.TAB_SWITCH) {
      setTabSwitchOpen(true)
      return
    }
    if (eventType === EVENT_TYPES.CAMERA_OFF) {
      setCameraOffToast(MONITORING_WARNING_MESSAGES[EVENT_TYPES.CAMERA_OFF])
    }
  }, [])

  // 'completed' only suppresses the overlay on the post-submit Personality result view.
  // On Steps 1-3 (e.g. a new account or new assessment start), treat 'completed' as no choice yet.
  const effectiveChoice = choice === 'completed' && location.pathname !== '/onboarding/personality'
    ? null
    : choice

  const { videoRef, status, activeCondition, start, turnOff, stop } = useAssessmentMonitoring({
    apiUrl,
    token,
    attemptId,
    assessmentStep: assessmentStep || 'assessment',
    // Keep tab_switch detection active whenever the student is on an active (non-completed) assessment route.
    enabled: inAssessment && Boolean(token) && Boolean(effectiveChoice) && effectiveChoice !== 'completed',
    autoStart: inAssessment && Boolean(token) && effectiveChoice === 'verified',
    onEvent: handleFlagEvent,
    onFrameState: setLiveState,
  })

  // Sync attemptId and consent choice whenever the attempt session or auth changes.
  useEffect(() => {
    const sync = () => {
      const nextId = typeof sessionStorage === 'undefined' ? null : getAssessmentAttemptId(sessionStorage)
      const nextChoice = readStorageChoice()
      setAttemptId(nextId)
      setChoice(nextChoice)
      if (nextChoice === 'completed' || (!nextId && !nextChoice)) {
        stop()
        setLiveState(null)
        setTabSwitchOpen(false)
      }
    }
    window.addEventListener('learnmatch:assessment-attempt', sync)
    window.addEventListener('learnmatch:auth-change', sync)
    return () => {
      window.removeEventListener('learnmatch:assessment-attempt', sync)
      window.removeEventListener('learnmatch:auth-change', sync)
    }
  }, [stop])

  // Guarantee hardware teardown the moment the student leaves the assessment routes,
  // and clear any stale 'completed' marker outside the Personality result screen.
  useEffect(() => {
    if (!inAssessment) {
      stop()
      if (readStorageChoice() === 'completed') {
        writeStorageChoice(null)
      }
    } else if (location.pathname !== '/onboarding/personality' && readStorageChoice() === 'completed') {
      writeStorageChoice(null)
    }
  }, [inAssessment, location.pathname, stop])

  // Auto-dismiss the brief camera-turned-off toast after 4 seconds.
  useEffect(() => {
    if (!cameraOffToast) return undefined
    const timer = window.setTimeout(() => setCameraOffToast(''), 4000)
    return () => window.clearTimeout(timer)
  }, [cameraOffToast])

  // Re-clamp floating preview position whenever the browser window resizes.
  useEffect(() => {
    const onResize = () => {
      setPreviewPos((current) => {
        if (!current) return null
        const rect = cardRef.current?.getBoundingClientRect()
        const width = rect?.width || previewWidth
        const height = rect?.height || Math.round(previewWidth * 1.05)
        return clampPositionToViewport(current.x, current.y, width, height)
      })
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [previewWidth])

  const handleDragPointerDown = (event) => {
    if (event.button !== undefined && event.button !== 0) return
    if (event.target.closest('button, a, [data-resize-handle]')) return
    const card = cardRef.current
    if (!card) return
    const rect = card.getBoundingClientRect()
    event.currentTarget.setPointerCapture?.(event.pointerId)
    gestureRef.current = {
      mode: 'drag',
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: rect.left,
      originY: rect.top,
      width: rect.width,
      height: rect.height,
    }
  }

  const handleResizePointerDown = (event) => {
    if (event.button !== undefined && event.button !== 0) return
    event.stopPropagation()
    const card = cardRef.current
    if (!card) return
    const rect = card.getBoundingClientRect()
    event.currentTarget.setPointerCapture?.(event.pointerId)
    gestureRef.current = {
      mode: 'resize',
      pointerId: event.pointerId,
      startX: event.clientX,
      originX: rect.left,
      originY: rect.top,
      startWidth: rect.width,
      aspectRatio: rect.height / Math.max(1, rect.width),
    }
  }

  const handlePointerMove = (event) => {
    const gesture = gestureRef.current
    if (!gesture || gesture.pointerId !== event.pointerId) return
    if (gesture.mode === 'drag') {
      const nextX = gesture.originX + (event.clientX - gesture.startX)
      const nextY = gesture.originY + (event.clientY - gesture.startY)
      setPreviewPos(clampPositionToViewport(nextX, nextY, gesture.width, gesture.height))
      return
    }
    if (gesture.mode === 'resize') {
      const maxViewportWidth = typeof window === 'undefined'
        ? MAX_PREVIEW_WIDTH
        : Math.min(MAX_PREVIEW_WIDTH, window.innerWidth - VIEWPORT_PADDING * 2)
      const nextWidth = clamp(
        Math.round(gesture.startWidth + (event.clientX - gesture.startX)),
        MIN_PREVIEW_WIDTH,
        Math.max(MIN_PREVIEW_WIDTH, maxViewportWidth)
      )
      const estimatedHeight = Math.round(nextWidth * gesture.aspectRatio)
      setPreviewWidth(nextWidth)
      setPreviewPos(clampPositionToViewport(gesture.originX, gesture.originY, nextWidth, estimatedHeight))
    }
  }

  const handlePointerEnd = (event) => {
    if (gestureRef.current?.pointerId === event.pointerId) {
      gestureRef.current = null
    }
  }

  const ensureAttemptId = async () => {
    const currentId = attemptId || (typeof sessionStorage !== 'undefined' ? getAssessmentAttemptId(sessionStorage) : null)
    if (currentId || !token) return currentId
    try {
      const response = await fetch(`${apiUrl}/api/assessment-attempts/recover`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await response.json().catch(() => null)
      if (response.ok && Number.isSafeInteger(data?.attemptId) && data.attemptId > 0) {
        sessionStorage.setItem(ASSESSMENT_SESSION_KEYS.attemptId, String(data.attemptId))
        setAttemptId(data.attemptId)
        return data.attemptId
      }
    } catch { /* Attempt will still be recovered when Step 1 saves. */ }
    return null
  }

  const handleEnableCameraAndStart = async () => {
    if (startingCamera) return
    setStartingCamera(true)
    try {
      const ok = await start()
      if (ok) {
        writeStorageChoice('verified')
        setChoice('verified')
        await ensureAttemptId()
      }
    } finally {
      setStartingCamera(false)
    }
  }

  const handleContinueWithoutCamera = () => {
    stop()
    writeStorageChoice('standard')
    setChoice('standard')
  }

  const handleRequestTurnOffCamera = () => {
    setConfirmTurnOffOpen(true)
  }

  const handleConfirmTurnOffCamera = () => {
    setConfirmTurnOffOpen(false)
    setReconnectError('')
    turnOff()
    setLiveState(null)
    writeStorageChoice('standard')
    setChoice('standard')
  }

  const handleReconnectCamera = async () => {
    if (startingCamera) return
    setStartingCamera(true)
    setReconnectError('')
    try {
      const ok = await start()
      if (!ok) {
        setReconnectError('Could not reconnect your camera. Please check the camera connection or browser permission and try again, or continue as a Standard Assessment.')
      }
    } finally {
      setStartingCamera(false)
    }
  }

  if (!inAssessment || !token || effectiveChoice === 'completed') return null

  const showConsentScreen = !effectiveChoice
  const showFloatingPreview = effectiveChoice === 'verified' && (status === 'active' || status === 'starting')
  const failureText = cameraErrorMessage(status)
  const liveStatus = describeLiveStatus(liveState)
  const compactPreview = previewWidth < 232

  // Camera condition takes priority; otherwise show tab_switch if triggered.
  const centeredType = activeCondition || (tabSwitchOpen ? EVENT_TYPES.TAB_SWITCH : null)
  const centeredAlert = centeredType ? CONDITION_ALERTS[centeredType] : null
  const isDisconnectedCondition = centeredType === 'camera_disconnected'
  const isCameraCondition = Boolean(activeCondition) && !isDisconnectedCondition

  const previewPositionStyle = showFloatingPreview
    ? {
        width: `${previewWidth}px`,
        ...(previewPos ? { left: `${previewPos.x}px`, top: `${previewPos.y}px` } : {}),
      }
    : undefined

  return (
    <>
      {/* Persistent floating camera preview stays ABOVE the blur overlay (z-[65]) and is draggable + resizable */}
      <div
        ref={cardRef}
        aria-label="Live assessment camera preview"
        style={previewPositionStyle}
        onPointerMove={showFloatingPreview ? handlePointerMove : undefined}
        onPointerUp={showFloatingPreview ? handlePointerEnd : undefined}
        onPointerCancel={showFloatingPreview ? handlePointerEnd : undefined}
        className={showFloatingPreview
          ? `fixed z-[65] select-none overflow-hidden rounded-2xl border border-stone-200/90 bg-white/95 shadow-[0_16px_40px_-16px_rgba(15,23,42,.45)] backdrop-blur-sm ${
              previewPos ? '' : 'bottom-20 right-3 sm:bottom-24 sm:right-6'
            }`
          : 'pointer-events-none fixed bottom-0 right-0 -z-10 h-32 w-40 overflow-hidden opacity-0'}
      >
        <div
          onPointerDown={showFloatingPreview ? handleDragPointerDown : undefined}
          title={showFloatingPreview ? 'Drag to move camera preview' : undefined}
          className={`relative aspect-[4/3] w-full bg-stone-950 ${
            showFloatingPreview ? 'cursor-grab touch-none active:cursor-grabbing' : ''
          }`}
        >
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className="pointer-events-none h-full w-full -scale-x-100 object-cover"
          />
          <span className="pointer-events-none absolute left-2 right-8 top-2 inline-flex max-w-fit items-center gap-1.5 truncate rounded-full bg-stone-950/80 px-2.5 py-1 text-[10px] font-semibold text-white backdrop-blur-sm">
            <span className={`h-2 w-2 shrink-0 rounded-full ${liveStatus.alert ? 'animate-pulse bg-amber-400' : 'bg-emerald-400'}`} aria-hidden="true" />
            <span className="truncate">{compactPreview ? 'No recording' : 'Automated monitoring · No recording'}</span>
          </span>
          {showFloatingPreview && (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-stone-950/70 text-stone-300 backdrop-blur-sm"
            >
              <IconGripHorizontal size={12} />
            </span>
          )}
          {showFloatingPreview && (
            <span className={`pointer-events-none absolute bottom-2 left-2 right-2 truncate rounded-lg px-2 py-1 text-[10px] font-semibold backdrop-blur-sm ${
              liveStatus.alert ? 'bg-amber-500/90 text-white' : 'bg-stone-950/70 text-stone-100'
            }`}>
              {liveStatus.label}
            </span>
          )}
        </div>
        {showFloatingPreview && (
          <div
            onPointerDown={handleDragPointerDown}
            className="relative cursor-grab touch-none space-y-2 p-2.5 active:cursor-grabbing sm:p-3"
          >
            {!compactPreview && (
              <p className="text-[11px] leading-4 text-stone-600">
                Your camera is processed on your device. No one can watch your camera feed.
              </p>
            )}
            <div className={`flex flex-wrap items-center justify-between gap-1.5 pr-4 ${compactPreview ? '' : 'border-t border-stone-100 pt-2'}`}>
              <button
                type="button"
                onClick={() => setShowInfoModal(true)}
                className="text-left text-[11px] font-semibold text-orange-700 underline hover:text-orange-800"
              >
                {compactPreview ? 'How it works' : 'How camera monitoring works'}
              </button>
              <button
                type="button"
                onClick={handleRequestTurnOffCamera}
                className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-stone-200 bg-stone-50 px-2 py-1 text-[11px] font-semibold text-stone-700 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700"
              >
                <IconCameraOff size={12} aria-hidden="true" />
                {compactPreview ? 'Turn Off' : 'Turn Off Camera'}
              </button>
            </div>
            {/* Corner resize handle (200px - 360px) */}
            <div
              data-resize-handle="true"
              role="separator"
              aria-label="Resize camera preview"
              title="Drag to resize camera preview"
              onPointerDown={handleResizePointerDown}
              className="absolute bottom-0 right-0 flex h-5 w-5 cursor-nwse-resize touch-none items-end justify-end p-1 text-stone-400 hover:text-stone-700"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                <path d="M9 1L1 9M9 5L5 9M9 8.5L8.5 9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </div>
          </div>
        )}
      </div>

      {/* Centered Auto-Blur Overlay for Active Camera Conditions and Tab Switch */}
      {!showConsentScreen && centeredAlert && (
        <div
          role="alertdialog"
          aria-modal="false"
          aria-labelledby="monitoring-condition-alert-title"
          className="fixed inset-0 z-[55] flex items-center justify-center bg-stone-900/35 p-4 backdrop-blur-md transition-opacity sm:p-6"
        >
          <div className="w-full max-w-md overflow-hidden rounded-3xl border border-amber-200/90 bg-white shadow-[0_32px_90px_-20px_rgba(15,23,42,.55)]">
            <div className="bg-gradient-to-b from-amber-50/90 via-orange-50/30 to-white px-6 pb-5 pt-7 text-center sm:px-8">
              <div
                aria-hidden="true"
                className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border-4 border-amber-100 bg-amber-500 text-white shadow-sm shadow-amber-200"
              >
                <IconAlertTriangle size={26} stroke={2} />
              </div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-700">
                Focus Reminder · Zero Score Impact
              </p>
              <h2
                id="monitoring-condition-alert-title"
                className="mt-1.5 text-xl font-bold tracking-tight text-stone-950 sm:text-2xl"
              >
                {centeredAlert.title}
              </h2>
              <p className="mt-2.5 text-sm font-medium leading-6 text-stone-700">
                {centeredAlert.message}
              </p>
            </div>

            <div className="space-y-4 px-6 pb-6 pt-2 text-center sm:px-8">
              <div className="rounded-2xl border border-stone-200/80 bg-stone-50/80 px-4 py-3 text-xs leading-5 text-stone-600">
                {centeredAlert.hint}
              </div>

              {isDisconnectedCondition && reconnectError && (
                <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs leading-5 text-red-700">
                  {reconnectError}
                </div>
              )}

              {isDisconnectedCondition && (
                <div className="space-y-2.5 pt-1">
                  <button
                    type="button"
                    onClick={handleReconnectCamera}
                    disabled={startingCamera}
                    className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-orange-200 transition hover:bg-orange-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500 disabled:cursor-wait disabled:opacity-60"
                  >
                    <IconCamera size={17} aria-hidden="true" />
                    {startingCamera ? 'Reconnecting Camera...' : 'Reconnect Camera'}
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmTurnOffCamera}
                    disabled={startingCamera}
                    className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-stone-200 bg-white px-5 py-2.5 text-sm font-semibold text-stone-700 transition hover:border-stone-300 hover:bg-stone-50 hover:text-stone-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500 disabled:opacity-50"
                  >
                    Continue as Standard Assessment
                  </button>
                </div>
              )}

              {!isCameraCondition && !isDisconnectedCondition && (
                <button
                  type="button"
                  onClick={() => setTabSwitchOpen(false)}
                  className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-orange-200 transition hover:bg-orange-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500"
                >
                  Resume Assessment
                </button>
              )}

              {isCameraCondition && (
                <div className="flex items-center justify-between gap-3 border-t border-stone-100 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowInfoModal(true)}
                    className="text-xs font-semibold text-orange-700 underline hover:text-orange-800"
                  >
                    How camera monitoring works
                  </button>
                  <button
                    type="button"
                    onClick={handleRequestTurnOffCamera}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                  >
                    <IconCameraOff size={14} aria-hidden="true" />
                    Turn Off Camera
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Turn Off Camera Confirmation Modal */}
      {confirmTurnOffOpen && (
        <div
          className="fixed inset-0 z-[72] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm sm:p-6"
          role="presentation"
          onClick={(event) => { if (event.target === event.currentTarget) setConfirmTurnOffOpen(false) }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-turn-off-camera-title"
            className="w-full max-w-md overflow-hidden rounded-3xl border border-stone-200/90 bg-white shadow-[0_32px_90px_-20px_rgba(15,23,42,.55)]"
          >
            <div className="bg-gradient-to-b from-amber-50/90 via-orange-50/30 to-white px-6 pb-5 pt-7 text-center sm:px-8">
              <div
                aria-hidden="true"
                className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border-4 border-amber-100 bg-amber-500 text-white shadow-sm shadow-amber-200"
              >
                <IconCameraOff size={26} stroke={2} />
              </div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-700">
                Switch to Standard Assessment?
              </p>
              <h2
                id="confirm-turn-off-camera-title"
                className="mt-1.5 text-xl font-bold tracking-tight text-stone-950 sm:text-2xl"
              >
                Turn Off Camera?
              </h2>
              <p className="mt-2.5 text-sm leading-6 text-stone-600">
                Turning off your camera will switch this attempt to a <strong className="font-semibold text-stone-900">Standard Assessment</strong> (no Verified Badge). Turn off anyway?
              </p>
            </div>
            <div className="grid gap-2.5 px-6 pb-6 pt-2 sm:grid-cols-2 sm:px-8">
              <button
                type="button"
                onClick={() => setConfirmTurnOffOpen(false)}
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-semibold text-stone-700 transition hover:border-stone-300 hover:bg-stone-50 hover:text-stone-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmTurnOffCamera}
                className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500"
              >
                <IconCameraOff size={16} aria-hidden="true" />
                Turn Off Camera
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Brief non-blocking toast when camera is turned off */}
      {cameraOffToast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed right-4 top-20 z-[70] flex max-w-sm items-center gap-3 rounded-2xl border border-stone-200 bg-white/95 px-4 py-3 text-stone-800 shadow-lg backdrop-blur-sm sm:right-6"
        >
          <IconCameraOff size={18} className="shrink-0 text-stone-500" aria-hidden="true" />
          <p className="text-xs font-semibold leading-5 sm:text-sm">{cameraOffToast}</p>
          <button
            type="button"
            onClick={() => setCameraOffToast('')}
            aria-label="Dismiss camera notice"
            className="ml-1 rounded-full p-1 text-stone-500 hover:bg-stone-100 hover:text-stone-800"
          >
            <IconX size={15} aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Pre-Assessment Consent & Camera Check Screen */}
      {showConsentScreen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4 backdrop-blur-sm sm:p-6"
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="assessment-camera-consent-title"
            className="relative max-h-[calc(100dvh-2.5rem)] w-full max-w-lg overflow-y-auto rounded-3xl border border-white/80 bg-white shadow-[0_32px_100px_-24px_rgba(15,23,42,.5)]"
          >
            <div className="bg-gradient-to-b from-orange-50/90 via-orange-50/30 to-white px-6 pb-5 pt-8 text-center sm:px-8 sm:pt-9">
              <div
                aria-hidden="true"
                className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border-4 border-orange-100 bg-orange-500 text-white shadow-sm shadow-orange-200"
              >
                <IconCamera size={28} stroke={1.8} />
              </div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-orange-600">
                Optional Camera Monitoring
              </p>
              <h2 id="assessment-camera-consent-title" className="mt-1.5 text-2xl font-bold tracking-tight text-stone-950">
                Before You Start Your Assessment
              </h2>
              <p className="mx-auto mt-2.5 max-w-md text-sm leading-6 text-stone-600">
                Turn on your camera to earn a <strong className="font-semibold text-stone-900">Verified Assessment Badge</strong> and unlock your <strong className="font-semibold text-stone-900">Personal Focus Summary</strong>.
              </p>
            </div>

            <div className="space-y-4 px-6 pb-7 pt-2 sm:px-8">
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-emerald-100 bg-white text-emerald-600">
                    <IconShieldCheck size={18} stroke={1.9} aria-hidden="true" />
                  </span>
                  <div className="min-w-0 text-xs leading-5 text-emerald-950">
                    <p className="font-bold">Automated monitoring · No recording</p>
                    <p className="mt-1 text-emerald-900/80">
                      Your camera is processed on your device. No video, photos, or audio are ever recorded or uploaded, and focus reminders never deduct from your scores.
                    </p>
                  </div>
                </div>
              </div>

              {failureText && (
                <div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-950">
                  {failureText}
                </div>
              )}

              <div className="space-y-2.5 pt-1">
                <button
                  type="button"
                  onClick={handleEnableCameraAndStart}
                  disabled={startingCamera}
                  className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-5 py-3 text-sm font-semibold text-white shadow-sm shadow-orange-200 transition hover:bg-orange-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500 disabled:cursor-wait disabled:opacity-60"
                >
                  <IconCamera size={18} aria-hidden="true" />
                  {startingCamera ? 'Checking Camera...' : 'Enable Camera & Start'}
                </button>
                <button
                  type="button"
                  onClick={handleContinueWithoutCamera}
                  disabled={startingCamera}
                  className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-stone-200 bg-white px-5 py-2.5 text-sm font-semibold text-stone-700 transition hover:border-stone-300 hover:bg-stone-50 hover:text-stone-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500 disabled:opacity-50"
                >
                  Continue Without Camera
                </button>
                <p className="text-center text-xs text-stone-500">
                  Continuing without a camera will label your result as a <strong className="font-semibold text-stone-700">Standard Assessment</strong>.
                </p>
              </div>

              <div className="border-t border-stone-100 pt-3 text-center">
                <button
                  type="button"
                  onClick={() => setShowInfoModal(true)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-orange-700 underline hover:text-orange-800"
                >
                  <IconInfoCircle size={15} aria-hidden="true" />
                  How camera monitoring works
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <CameraMonitoringModal open={showInfoModal} onClose={() => setShowInfoModal(false)} />
    </>
  )
}

export default AssessmentMonitoringOverlay
