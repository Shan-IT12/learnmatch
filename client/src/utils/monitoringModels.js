const BASE = `${import.meta.env.BASE_URL || '/'}mediapipe`
const WASM_PATH = `${BASE}/wasm`
const FACE_MODEL = `${BASE}/models/face_landmarker.task`
const OBJECT_MODEL = `${BASE}/models/efficientdet_lite0.tflite`
const DEVICE_SCORE = 0.22
const DEVICE_LABELS = ['cell phone', 'laptop']
const MIN_BOX_SIZE = 45

function createCanvas() {
  return typeof document !== 'undefined' ? document.createElement('canvas') : undefined
}

// Loads MediaPipe lazily (separate chunk) from this site's own files, so no frame or
// model request ever leaves the origin. Each task uses its own canvas to avoid WebGL conflicts.
export async function loadDetectors() {
  const { FilesetResolver, FaceLandmarker, ObjectDetector } = await import('@mediapipe/tasks-vision')
  const vision = await FilesetResolver.forVisionTasks(WASM_PATH)
  const create = async (build) => {
    try { return await build('GPU') } catch { return build('CPU') }
  }
  const faceLandmarker = await create(delegate => FaceLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: FACE_MODEL, delegate },
    canvas: createCanvas(),
    runningMode: 'VIDEO',
    numFaces: 2,
    minFaceDetectionConfidence: 0.4,
    minFacePresenceConfidence: 0.4,
    minTrackingConfidence: 0.4,
    outputFacialTransformationMatrixes: true,
  }))
  let objectDetector = null
  try {
    objectDetector = await create(delegate => ObjectDetector.createFromOptions(vision, {
      baseOptions: { modelAssetPath: OBJECT_MODEL, delegate },
      canvas: createCanvas(),
      runningMode: 'VIDEO',
      scoreThreshold: DEVICE_SCORE,
      categoryAllowlist: DEVICE_LABELS,
      maxResults: 2,
    }))
  } catch (error) {
    console.warn('Cellphone detector unavailable, continuing with face monitoring:', error?.message || error)
  }
  return {
    detectFaces(video, timestamp) {
      const result = faceLandmarker.detectForVideo(video, timestamp)
      return {
        faceCount: result.faceLandmarks?.length || 0,
        landmarks: result.faceLandmarks?.[0] ?? null,
        matrix: result.facialTransformationMatrixes?.[0]?.data ?? null,
      }
    },
    detectPhone(video, timestamp) {
      if (!objectDetector) return false
      const result = objectDetector.detectForVideo(video, timestamp)
      return (result.detections || []).some((detection) => {
        const box = detection.boundingBox
        if (box && (box.width < MIN_BOX_SIZE || box.height < MIN_BOX_SIZE)) return false
        return (detection.categories || []).some(cat =>
          (cat.categoryName === 'cell phone' && cat.score >= DEVICE_SCORE) ||
          (cat.categoryName === 'laptop' && cat.score >= 0.45)
        )
      })
    },
    close() {
      try { faceLandmarker.close() } catch { /* ignore */ }
      try { objectDetector?.close() } catch { /* ignore */ }
    },
  }
}
